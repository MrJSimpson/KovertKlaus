/**
 * @file daily-limit.ts
 * @description Keeps Brevo sends under the sending allowance (per day or per month) and holds the overflow.
 *
 * Tier 1 (what): Counts the current period's Brevo recipients, holds any email that would pass the
 * sending cap in the `EmailOutbox` table, and sends held mail oldest first once the period (or, in
 * monthly mode, the day's cap) resets. Logs one warning per period at 80% of the quota.
 * Tier 2 (why): Brevo's free tier allows 300 transactional emails a day and rejects the rest; its
 * requeue covers campaigns only, so an over-quota send was lost (owner decision 2026-10-26: hold
 * the overflow, one cap for every email, oldest first, warning in the North Pole log only).
 * The cap sits 10 below the quota to cover sends the ledger misses (two sends racing at the cap,
 * a ledger write that fails after a send). Since 2026-11-01 the allowance is a North Pole setting
 * (`quota-config.ts`): DAY (midnight Pacific) or MONTH (from a reset day), with an optional daily
 * cap in monthly mode. A quota rejection from Brevo no longer counts as a failed attempt, so mail
 * held for weeks in monthly mode is not given up on.
 * Tier 3 (how): Pure helpers plus an `EmailQuotaStore` interface; `prismaQuotaStore` is the
 * database implementation and tests use an in-memory one. The dispatcher calls these; the hourly
 * cron (Worker) and the 60-second scheduler tick (self-hosted) call `flushHeldEmails`.
 */

import type { EmailMessage, EmailResult } from './types';
import { DEFAULT_QUOTA_CONFIG, type EmailQuotaPeriod, type QuotaConfig } from './quota-config';

/** The allowance, the sending cap below it, the warning point, and how the period is counted. */
export interface QuotaSettings {
  period: EmailQuotaPeriod;
  quota: number;
  cap: number;
  warnAt: number;
  /** Day of the month a MONTH period starts (1-28). */
  resetDay: number;
  /** Per-day cap in MONTH mode; 0 means none. Always 0 in DAY mode. */
  dailyCap: number;
}

/** Brevo free tier: 300 a day, reset at midnight Pacific (per the owner). */
export const DEFAULT_DAILY_QUOTA = 300;
/** Sends kept spare below the quota for anything the ledger misses. */
export const QUOTA_RESERVE = 10;
/** A held email is marked failed after this many failed flush attempts (real errors, not quota). */
export const MAX_FLUSH_ATTEMPTS = 5;
/** Sent and failed ledger rows are deleted after this many days (longer than any monthly period). */
export const LEDGER_RETENTION_DAYS = 35;

const QUOTA_TIME_ZONE = 'America/Los_Angeles';

/** Settings for the North Pole allowance (`quota-config.ts`); defaults to 300 a day. */
export function quotaSettings(config: Partial<QuotaConfig> = {}): QuotaSettings {
  const c = { ...DEFAULT_QUOTA_CONFIG, ...config };
  const period: EmailQuotaPeriod = c.period === 'MONTH' ? 'MONTH' : 'DAY';
  const quota = c.quota > 0 ? c.quota : DEFAULT_DAILY_QUOTA;
  return {
    period,
    quota,
    cap: Math.max(1, quota - QUOTA_RESERVE),
    warnAt: Math.floor(quota * 0.8),
    resetDay: Math.min(28, Math.max(1, Math.round(c.resetDay))),
    dailyCap: period === 'MONTH' && c.dailyCap > 0 ? c.dailyCap : 0,
  };
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

/** The Pacific wall-clock date (year, 0-based month, day) at `at`. */
function pacificDate(at: Date): { y: number; m: number; d: number } {
  const wall = new Date(at.getTime() + pacificOffsetMs(at));
  return { y: wall.getUTCFullYear(), m: wall.getUTCMonth(), d: wall.getUTCDate() };
}

/** The instant of midnight Pacific on a wall-clock date (month and day may overflow; Date.UTC normalises). */
function pacificMidnight(y: number, m: number, d: number): Date {
  const wallMidnight = Date.UTC(y, m, d);
  // The offset at midnight can differ from noon's on a daylight-saving change day, so refine once.
  const guess = new Date(wallMidnight - pacificOffsetMs(new Date(wallMidnight)));
  return new Date(wallMidnight - pacificOffsetMs(guess));
}

/** When the current quota period began: midnight Pacific today (DAY) or on the latest reset day (MONTH). */
export function periodStart(settings: Pick<QuotaSettings, 'period' | 'resetDay'>, now: Date = new Date()): Date {
  if (settings.period !== 'MONTH') return quotaDayStart(now);
  const { y, m, d } = pacificDate(now);
  return d >= settings.resetDay ? pacificMidnight(y, m, settings.resetDay) : pacificMidnight(y, m - 1, settings.resetDay);
}

/** When the next quota period begins. */
export function nextPeriodStart(settings: Pick<QuotaSettings, 'period' | 'resetDay'>, now: Date = new Date()): Date {
  const start = periodStart(settings, now);
  const { y, m, d } = pacificDate(new Date(start.getTime() + 12 * 60 * 60 * 1000));
  return settings.period === 'MONTH' ? pacificMidnight(y, m + 1, settings.resetDay) : pacificMidnight(y, m, d + 1);
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

/** Decides whether an email of `recipients` fits under the period's cap (and the day's, in monthly mode). */
export async function checkQuota(store: EmailQuotaStore, recipients: number, settings: QuotaSettings, now: Date = new Date()): Promise<QuotaDecision> {
  const usedBefore = await store.sentSince(periodStart(settings, now));
  if (usedBefore + recipients > settings.cap) return { send: false, usedBefore };
  if (settings.dailyCap > 0) {
    const usedToday = await store.sentSince(quotaDayStart(now));
    if (usedToday + recipients > settings.dailyCap) return { send: false, usedBefore };
  }
  return { send: true, usedBefore };
}

/**
 * When held mail can go out again, or `null` when one more email would send now: the next period
 * when the period's cap is reached, otherwise the next day when only the daily cap is.
 */
export async function quotaResumesAt(store: EmailQuotaStore, settings: QuotaSettings, now: Date = new Date()): Promise<Date | null> {
  const usedPeriod = await store.sentSince(periodStart(settings, now));
  if (usedPeriod + 1 > settings.cap) return nextPeriodStart(settings, now);
  if (settings.dailyCap > 0 && (await store.sentSince(quotaDayStart(now))) + 1 > settings.dailyCap) {
    return nextPeriodStart({ period: 'DAY', resetDay: 1 }, now);
  }
  return null;
}

/** True when a send moved the period's count from below the warning point to at or above it. */
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

  let used = await store.sentSince(periodStart(settings, now));
  let usedToday = settings.dailyCap > 0 ? await store.sentSince(quotaDayStart(now)) : 0;
  const room = Math.max(0, Math.min(settings.cap - used, settings.dailyCap > 0 ? settings.dailyCap - usedToday : Infinity));
  const held = await store.listHeld(room);
  for (const email of held) {
    if (used + email.recipients > settings.cap) break;
    if (settings.dailyCap > 0 && usedToday + email.recipients > settings.dailyCap) break;
    const result = await deliver(email.message);
    if (result.success) {
      await store.markSent(email.id);
      used += email.recipients;
      usedToday += email.recipients;
      summary.sent++;
    } else if (isQuotaRejection(result.error)) {
      // Still over quota at the provider: wait for the next run. Not an attempt, so mail held for
      // weeks in monthly mode is never given up on because of the quota.
      summary.failed++;
      break;
    } else {
      const { gaveUp } = await store.markAttemptFailed(email.id, result.error || 'unknown error');
      summary.failed++;
      if (gaveUp) summary.gaveUp++;
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
