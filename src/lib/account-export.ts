/**
 * @file account-export.ts
 * @description The copy of an agent's data made when they delete their account: build, encrypt, link.
 *
 * Tier 1 (what): `buildAccountExport` gathers the agent's own data into one JSON document.
 * `encryptExport` / `decryptExport` seal it for storage. `issueExportToken` / `readExportToken` make
 * the emailed download link. `downloadAccountExport` serves that link for both runtimes.
 * Tier 2 (why): Owner decision (2026-11-01): when an agent deletes their account, KovertKlaus keeps a
 * copy of their data for 30 days (R2 `user_backups/` on SaaS, local disk self-hosted) and emails them
 * a link to download it from kovertklaus. Only the agent's own data goes in: other agents' real names,
 * addresses, dossiers and messages stay out (their target appears by codename only).
 * Tier 3 (how): AES-256-GCM through WebCrypto (both runtimes), with a key derived from the session
 * secret for this purpose only. The nightly-backup R2 token can read the whole bucket, so exports are
 * sealed with a key only the app holds. Rotating `SESSION_SECRET` voids outstanding links. The link is
 * a signed token (export ID and expiry, 30 days) with its own key; no session is needed because the
 * account no longer exists. Downloads are limited per IP (`LoginThrottle` scope `EXPORT`).
 */

import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { getSessionSecret, signToken, verifyToken } from '@/lib/security';
import { EXPORT_RETENTION_MS, exportKeyFor, isExportId, type ExportStore } from '@/lib/export-store';

/** Bump when the document's shape changes. */
export const EXPORT_SCHEMA_VERSION = 1;

/** `LoginThrottle.scope` for download attempts. */
export const EXPORT_SCOPE = 'EXPORT';

/** Download attempts allowed per IP per hour. */
export const EXPORT_DOWNLOADS_PER_HOUR = 20;

/** Reply for a link that is forged, expired, or whose copy was already deleted. */
export const EXPORT_GONE_MESSAGE = 'This download link has expired or is invalid. Copies are kept for 30 days after an account is deleted.';

// --- build -------------------------------------------------------------------------

/**
 * The agent's own data as one JSON-ready object.
 *
 * @param db - App-schema client.
 * @returns `null` when the user does not exist.
 */
export async function buildAccountExport(db: PrismaClient, userId: string, nowMs = Date.now()): Promise<Record<string, unknown> | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  // Never export credentials or internal session state.
  const { passwordHash: _passwordHash, sessionsRevokedAt: _revoked, isWorkshop: _workshop, ...profile } = user;
  void _passwordHash;
  void _revoked;
  void _workshop;

  const memberships = await db.exchangeMember.findMany({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
    include: {
      exchange: {
        select: {
          title: true, code: true, status: true, isWhiteElephant: true, isLocalOnly: true, budgetMin: true, budgetMax: true,
          currency: true, inviteCutoffDate: true, assignmentDate: true, shippingDate: true, executionDate: true,
        },
      },
      wishlist: { select: { name: true, type: true, wishlistItems: { select: { quantity: true, item: true } } } },
    },
  });

  // The target appears by codename only: their real name and address are theirs, not the agent's.
  const targetCodenames = new Map<string, string | null>();
  for (const m of memberships) {
    if (!m.targetUserId) continue;
    const target = await db.exchangeMember.findFirst({
      where: { exchangeId: m.exchangeId, userId: m.targetUserId },
      select: { codename: true },
    });
    targetCodenames.set(m.id, target?.codename ?? null);
  }

  const [messages, reports, feedback, notifications, items] = await Promise.all([
    db.exchangeMessage.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'asc' },
      select: { channel: true, messageText: true, isFromSanta: true, createdAt: true, exchange: { select: { title: true, code: true } } },
    }),
    db.exchangeReport.findMany({
      where: { userId },
      select: { thankYouText: true, photoUrl: true, createdAt: true, exchange: { select: { title: true, code: true } } },
    }),
    db.feedback.findMany({ where: { userId }, select: { type: true, status: true, message: true, pagePath: true, createdAt: true } }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { title: true, message: true, createdAt: true } }),
    db.item.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
  ]);

  const item = (i: { name: string; url: string; price: unknown; description: string | null; createdAt: Date }) => ({
    name: i.name,
    url: i.url,
    price: String(i.price),
    description: i.description,
    addedAt: i.createdAt,
  });

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: new Date(nowMs).toISOString(),
    about: 'Your KovertKlaus data, exported when you deleted your account. Other agents\' personal details are not included.',
    account: { ...profile, coalCitations: user.penaltyPoints },
    missions: memberships.map((m) => ({
      title: m.exchange.title,
      code: m.exchange.code,
      status: m.exchange.status,
      type: m.exchange.isWhiteElephant ? 'WHITE_ELEPHANT' : 'SECRET_SANTA',
      localOnly: m.exchange.isLocalOnly,
      budget: { min: String(m.exchange.budgetMin ?? ''), max: String(m.exchange.budgetMax), currency: m.exchange.currency },
      dates: {
        inviteCutoff: m.exchange.inviteCutoffDate,
        assignment: m.exchange.assignmentDate,
        shipping: m.exchange.shippingDate,
        exchange: m.exchange.executionDate,
      },
      role: m.role,
      yourCodename: m.codename,
      joinedAt: m.joinedAt,
      yourTargetCodename: targetCodenames.get(m.id) ?? null,
      yourGift: {
        shippingStatus: m.shippingStatus,
        trackingNumber: m.trackingNumber,
        shippedAt: m.shippedAt,
        deliveredConfirmed: m.deliveredConfirmed,
      },
      wishlist: m.wishlist
        ? { name: m.wishlist.name, type: m.wishlist.type, items: m.wishlist.wishlistItems.map((w) => ({ quantity: w.quantity, ...item(w.item) })) }
        : null,
    })),
    allWishlistItems: items.map(item),
    messagesYouSent: messages.map((x) => ({
      mission: x.exchange.title,
      missionCode: x.exchange.code,
      channel: x.channel,
      asSanta: x.isFromSanta,
      text: x.messageText,
      sentAt: x.createdAt,
    })),
    afterActionReports: reports.map((r) => ({ mission: r.exchange.title, missionCode: r.exchange.code, text: r.thankYouText, photoUrl: r.photoUrl, createdAt: r.createdAt })),
    feedback,
    notifications,
  };
}

// --- encryption ------------------------------------------------------------------------

const IV_BYTES = 12;

/** AES-256-GCM key for exports: SHA-256 of the session secret plus this purpose. */
async function exportKey(): Promise<CryptoKey> {
  const raw = crypto.createHash('sha256').update(`${getSessionSecret()}:data-export`).digest();
  return globalThis.crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Seals a document for storage: 12-byte IV followed by the AES-GCM ciphertext (with its tag). */
export async function encryptExport(doc: unknown): Promise<Uint8Array> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = new TextEncoder().encode(JSON.stringify(doc, null, 2));
  const sealed = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await exportKey(), plain));
  const out = new Uint8Array(IV_BYTES + sealed.length);
  out.set(iv, 0);
  out.set(sealed, IV_BYTES);
  return out;
}

/** Opens a sealed export back into its JSON text; `null` if it was tampered with or the key changed. */
export async function decryptExport(blob: Uint8Array): Promise<string | null> {
  if (blob.length <= IV_BYTES) return null;
  try {
    const plain = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: blob.slice(0, IV_BYTES) }, await exportKey(), blob.slice(IV_BYTES));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

// --- link --------------------------------------------------------------------------------

function linkSecret(): string {
  return `${getSessionSecret()}:data-export-link`;
}

/** Signed token for a download link. */
export function issueExportToken(exportId: string, expiresAtMs: number): string {
  return signToken(`export:${exportId}:${expiresAtMs}`, linkSecret());
}

/** The export ID if the token's signature holds and it has not expired. */
export function readExportToken(token: string, nowMs = Date.now()): { exportId: string; expiresAtMs: number } | null {
  const data = verifyToken(token, linkSecret());
  if (!data) return null;
  const [kind, exportId, exp] = data.split(':');
  const expiresAtMs = Number(exp);
  if (kind !== 'export' || !isExportId(exportId) || !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return null;
  return { exportId, expiresAtMs };
}

/** The emailed link. */
export function exportLinkUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/users/data-export?token=${encodeURIComponent(token)}`;
}

/**
 * Builds, seals and stores an agent's export, and returns its download link.
 * Throws if the copy cannot be stored, so the caller can refuse the deletion.
 */
export async function createAccountExport(
  db: PrismaClient,
  store: ExportStore,
  userId: string,
  baseUrl: string,
  nowMs = Date.now()
): Promise<{ exportId: string; url: string; expiresAtMs: number } | null> {
  const doc = await buildAccountExport(db, userId, nowMs);
  if (!doc) return null;
  const exportId = crypto.randomUUID();
  await store.put(exportKeyFor(exportId), await encryptExport(doc));
  const expiresAtMs = nowMs + EXPORT_RETENTION_MS;
  return { exportId, url: exportLinkUrl(baseUrl, issueExportToken(exportId, expiresAtMs)), expiresAtMs };
}

// --- download ----------------------------------------------------------------------------

/** What the download route returns: the file, or a status with a message. */
export type DownloadResult =
  | { status: 200; body: string; headers: Record<string, string> }
  | { status: number; body: { error: string }; headers?: Record<string, string> };

function ipKey(ip: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(`${EXPORT_SCOPE}:ip:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Serves a download link. No session: the signed token is the proof.
 *
 * @param input.ip - Client IP (`clientIp(headers)`), for the per-IP limit.
 */
export async function downloadAccountExport(
  deps: { adminDb: PrismaClient; store: ExportStore },
  input: { token: string | null; ip: string },
  nowMs = Date.now()
): Promise<DownloadResult> {
  const ipHash = ipKey(input.ip);
  try {
    const recent = await deps.adminDb.loginThrottle.count({ where: { scope: EXPORT_SCOPE, ipHash, createdAt: { gt: new Date(nowMs - 60 * 60 * 1000) } } });
    if (recent >= EXPORT_DOWNLOADS_PER_HOUR) {
      return { status: 429, body: { error: 'Too many download attempts. Please try again in an hour.' }, headers: { 'Retry-After': '3600' } };
    }
    await deps.adminDb.loginThrottle.create({ data: { scope: EXPORT_SCOPE, accountHash: '-', ipHash } });
  } catch (err) {
    console.error('[AccountExport] throttle check failed, allowing the download:', err);
  }

  const claims = input.token ? readExportToken(input.token, nowMs) : null;
  if (!claims) return { status: 410, body: { error: EXPORT_GONE_MESSAGE } };
  const blob = await deps.store.get(exportKeyFor(claims.exportId));
  if (!blob) return { status: 410, body: { error: EXPORT_GONE_MESSAGE } };
  const json = await decryptExport(blob);
  if (json === null) return { status: 410, body: { error: EXPORT_GONE_MESSAGE } };
  const day = new Date(nowMs).toISOString().slice(0, 10);
  return {
    status: 200,
    body: json,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="kovertklaus-data-${day}.json"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  };
}
