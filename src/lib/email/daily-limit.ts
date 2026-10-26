/**
 * @file daily-limit.ts
 * @description Keeps Brevo sends under the free tier's daily quota and holds the overflow.
 *
 * Tier 1 (what): Counts today's Brevo recipients, holds any email that would pass the sending cap
 * in the `EmailOutbox` table, and sends held mail oldest first once the quota day resets
 * (midnight Pacific). Logs one warning per day at 80% of the quota.
 * Tier 2 (why): Brevo's free tier allows 300 transactional emails a day and rejects the rest; its
 * requeue covers campaigns only, so an over-quota send was lost (owner decision 2026-10-26: hold
 * the overflow, one cap for every email, oldest first, warning in the North Pole log only).
 * The cap sits 10 below the quota to cover sends the ledger misses (two sends racing at the cap,
 * a ledger write that fails after a send).
 * Tier 3 (how): Pure helpers plus an `EmailQuotaStore` interface; `prismaQuotaStore` is the
 * database implementation and tests use an in-memory one. The dispatcher calls these; the hourly
 * cron (Worker) and the 60-second scheduler tick (self-hosted) call `flushHeldEmails`.
 */

import type { EmailMessage, EmailResult } from './types';

/** Brevo's daily quota, the sending cap below it and the warning point. */
export interface QuotaSettings {
  quota: number;
  cap: number;
  warnAt: number;
}

/** Brevo free tier: 300 a day, reset at midnight Pacific (per the owner). */
export const DEFAULT_DAILY_QUOTA = 300;
/** Sends kept spare below the quota for anything the ledger misses. */
export const QUOTA_RESERVE = 10;
/** A held email is marked failed after this many failed flush attempts. */
export const MAX_FLUSH_ATTEMPTS = 5;
/** Sent and failed ledger rows are deleted after this many days. */
export const LEDGER_RETENTION_DAYS = 30;

const QUOTA_TIME_ZONE = 'America/Los_Angeles';

/** Settings for a quota; `EMAIL_DAILY_QUOTA` overrides 300 (for example after a plan upgrade). */
export function quotaSettings(env?: Record<string, string | undefined>): QuotaSettings {
  const parsed = parseInt(env?.EMAIL_DAILY_QUOTA || '', 10);
  const quota = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_QUOTA;
  return { quota, cap: Math.max(1, quota - QUOTA_RESERVE), warnAt: Math.floor(quota * 0.8) };
}

/** Milliseconds the Pacific wall clock is ahead of UTC at `at` (negative: behind). */
function pacificOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: QUOTA_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant the current quota day began: the most recent midnight in Pacific time. */
export function quotaDayStart(now: Date = new Date()): Date {
  const wallNow = new Date(now.getTime() + pacificOffsetMs(now));
  const wallMidnight = Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), wallNow.getUTCDate());
  // Midnight's offset can differ from now's on a daylight-saving change day, so measure it there.
  const guess = new Date(wallMidnight - pacificOffsetMs(now));
  return new Date(wallMidnight - pacificOffsetMs(guess));
}

/** Number of recipients in a message: Brevo counts each one against the quota. */
export function recipientCount(message: EmailMessage): number {
  return Array.isArray(message.to) ? Math.max(1, message.to.length) : 1;
}

/** True when a provider error means the daily quota is used up, so the email should wait. */
export function isQuotaRejection(error?: string): boolean {
  const e = (error || '').toLowerCase();
  return e.includes('http 429') || e.includes('http 402') || e.includes('quota') || e.includes('limit exceeded');
}

/** One email waiting for the next quota day. */
export interface HeldEmail {
  id: string;
  message: EmailMessage;
  recipients: number;
  attempts: number;
}

/** Where sends are counted and held mail is kept. */
export interface EmailQuotaStore {
  /** Recipients sent since `since`. */
  sentSince(since: Date): Promise<number>;
  /** Number of emails currently held. */
  heldCount(): Promise<number>;
  /** Records a delivered email. */
  recordSent(recipients: number, subject: string): Promise<void>;
  /** Holds an email for the next quota day. */
  hold(message: EmailMessage, recipients: number, reason: string): Promise<void>;
  /** Held emails, oldest first. */
  listHeld(take: number): Promise<HeldEmail[]>;
  /** Marks a held email as delivered and drops its content. */
  markSent(id: string): Promise<void>;
  /** Counts a failed flush attempt; after `MAX_FLUSH_ATTEMPTS` the email is marked failed. */
  markAttemptFailed(id: string, error: string): Promise<{ gaveUp: boolean }>;
  /** Deletes sent and failed rows created before `before`. */
  prune(before: Date): Promise<void>;
}

/** What `checkQuota` decided for one email. */
export interface QuotaDecision {
  send: boolean;
  usedBefore: number;
}

/** Decides whether an email of `recipients` fits under today's cap. */
export async function checkQuota(store: EmailQuotaStore, recipients: number, settings: QuotaSettings, now: Date = new Date()): Promise<QuotaDecision> {
  const usedBefore = await store.sentSince(quotaDayStart(now));
  return { send: usedBefore + recipients <= settings.cap, usedBefore };
}

/** True when a send moved today's count from below the warning point to at or above it. */
export function crossedWarning(usedBefore: number, recipients: number, settings: QuotaSettings): boolean {
  return usedBefore < settings.warnAt && usedBefore + recipients >= settings.warnAt;
}

/** Result of one flush run. */
export interface FlushSummary {
  sent: number;
  failed: number;
  gaveUp: number;
  remaining: number;
}

/**
 * Sends held emails, oldest first, while today's cap allows. Stops at the first email that does not
 * fit, so order is kept. `deliver` sends one message without the quota check.
 */
export async function flushHeldEmails(
  store: EmailQuotaStore,
  deliver: (message: EmailMessage) => Promise<EmailResult>,
  settings: QuotaSettings,
  now: Date = new Date()
): Promise<FlushSummary> {
  const summary: FlushSummary = { sent: 0, failed: 0, gaveUp: 0, remaining: 0 };
  await store.prune(new Date(now.getTime() - LEDGER_RETENTION_DAYS * 24 * 60 * 60 * 1000));

  let used = await store.sentSince(quotaDayStart(now));
  const held = await store.listHeld(Math.max(0, settings.cap - used));
  for (const email of held) {
    if (used + email.recipients > settings.cap) break;
    const result = await deliver(email.message);
    if (result.success) {
      await store.markSent(email.id);
      used += email.recipients;
      summary.sent++;
    } else {
      const { gaveUp } = await store.markAttemptFailed(email.id, result.error || 'unknown error');
      summary.failed++;
      if (gaveUp) summary.gaveUp++;
      // Still over quota at the provider: wait for the next run instead of burning attempts.
      if (isQuotaRejection(result.error)) break;
    }
  }
  summary.remaining = await store.heldCount();
  return summary;
}

/** The fields of an `EmailMessage` that are stored with a held email. */
function storedMessage(message: EmailMessage): EmailMessage {
  const { to, subject, html, text, from, fromName, replyTo, tags } = message;
  return { to, subject, html, text, from, fromName, replyTo, tags };
}

/**
 * `EmailQuotaStore` over the `EmailOutbox` table (admin schema). `client` is an admin Prisma
 * client; the table holds email content, so the app role cannot read it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Worker and Node pass differently typed Prisma clients
export function prismaQuotaStore(client: any): EmailQuotaStore {
  const outbox = client.emailOutbox;
  return {
    async sentSince(since) {
      const result = await outbox.aggregate({ where: { status: 'SENT', sentAt: { gte: since } }, _sum: { recipients: true } });
      return result?._sum?.recipients ?? 0;
    },
    async heldCount() {
      return outbox.count({ where: { status: 'HELD' } });
    },
    async recordSent(recipients, subject) {
      await outbox.create({ data: { status: 'SENT', recipients, subject: subject.slice(0, 255), sentAt: new Date() } });
    },
    async hold(message, recipients, reason) {
      await outbox.create({
        data: { status: 'HELD', recipients, subject: message.subject.slice(0, 255), message: JSON.stringify(storedMessage(message)), lastError: reason.slice(0, 500) },
      });
    },
    async listHeld(take) {
      if (take <= 0) return [];
      const rows = await outbox.findMany({ where: { status: 'HELD' }, orderBy: { createdAt: 'asc' }, take });
      return rows.map((r: { id: string; message: string; recipients: number; attempts: number }) => ({
        id: r.id, message: JSON.parse(r.message) as EmailMessage, recipients: r.recipients, attempts: r.attempts,
      }));
    },
    async markSent(id) {
      await outbox.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), message: null, lastError: null } });
    },
    async markAttemptFailed(id, error) {
      const row = await outbox.update({ where: { id }, data: { attempts: { increment: 1 }, lastError: error.slice(0, 500) } });
      if (row.attempts < MAX_FLUSH_ATTEMPTS) return { gaveUp: false };
      await outbox.update({ where: { id }, data: { status: 'FAILED', message: null } });
      return { gaveUp: true };
    },
    async prune(before) {
      await outbox.deleteMany({ where: { status: { in: ['SENT', 'FAILED'] }, createdAt: { lt: before } } });
    },
  };
}
