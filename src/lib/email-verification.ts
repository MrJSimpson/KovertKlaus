/**
 * @file email-verification.ts
 * @description Email address verification for new agents: the signed link, resend limits, and the gate.
 *
 * Tier 1 (what): `sendVerificationEmail` mails a new agent a link; `requestVerificationResend` mails
 * another on request; `confirmEmailVerification` marks the address verified from that link.
 * `isUnverified` and `isVerificationRequired` decide whether a signed-in agent may use the app yet.
 * All return `{ status, body }` where a route needs them, so the Next.js routes (self-hosted) and the
 * Worker (SaaS) share one implementation, as `password-reset.ts` does.
 * Tier 2 (why): Sign-up is open in beta and addresses were never checked, so anyone could register
 * with someone else's email. Owner decisions (2026-11-01): verify before the dashboard; links last
 * 24 hours; the 39 accounts that existed before this change are grandfathered (marked verified by
 * the migration); an unverified agent blocks the Secret Santa draw; installs with no real email
 * provider (provider `console`, which only writes mail to the server log) skip verification.
 * Tier 3 (how): `User.emailVerifiedAt` is null until verified. The link carries a signed token: user
 * ID, expiry and a fingerprint of the address, HMAC-signed with a key derived from the session
 * secret (a distinct purpose from sessions and password reset). Confirming is conditional on
 * `emailVerifiedAt` still being null, so a link works once without a token table. Resends are rows in
 * `admin."LoginThrottle"` with scope `VERIFY`, keyed by the user (purged hourly with the rest); the
 * check fails open if that table cannot be read. Workshop (demo) accounts are never gated.
 */

import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { getSessionSecret, signToken, verifyToken } from '@/lib/security';
import type { EmailResult } from '@/lib/email/types';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** How long a verification link works when the email goes out right away. */
export const VERIFY_LINK_TTL_MS = 24 * HOUR_MS;

/**
 * How long a link works when today's email quota is used up and the email is held. Held mail goes
 * out after midnight Pacific, up to a day later, so the link gets an extra day.
 */
export const VERIFY_QUEUED_LINK_TTL_MS = 48 * HOUR_MS;

/** `LoginThrottle.scope` for resend requests. */
export const VERIFY_SCOPE = 'VERIFY';

/** The rule that blocked a resend. */
export type VerifyRule = 'COOLDOWN' | 'ACCOUNT_HOUR';

/** Resends allowed per window. */
export const VERIFY_LIMITS: Record<VerifyRule, number> = { COOLDOWN: 1, ACCOUNT_HOUR: 5 };

const WINDOWS: Record<VerifyRule, number> = { COOLDOWN: 2 * MINUTE_MS, ACCOUNT_HOUR: HOUR_MS };
const RULES: VerifyRule[] = ['COOLDOWN', 'ACCOUNT_HOUR'];

/** `code` on the 403 a signed-in but unverified agent gets from `/api/users/me` (client-safe constant). */
export { EMAIL_UNVERIFIED_CODE } from '@/lib/constants/auth';

/**
 * API paths an unverified agent may still call with their session. Everything else treats the
 * session as signed out until the address is verified.
 */
export const UNVERIFIED_ALLOWED_PATHS: ReadonlySet<string> = new Set([
  '/api/users/me',
  '/api/users/verify-email',
  '/api/users/verify-email/confirm',
  // A mistyped address is a good reason to delete the account; deletion still needs the password.
  '/api/users/delete-account',
]);

/** Reply when a verification email went out. */
export const VERIFY_SENT_MESSAGE = "We've sent a verification link to your email. It expires in 24 hours. Check your spam folder if it doesn't arrive.";

/** Reply when today's email quota is used up (same wording as password reset, owner 2026-10-30). */
export const VERIFY_QUEUED_MESSAGE =
  'Due to email limitations during beta, we are unable to send email currently. Your verification email will reach you tomorrow AM.';

/** Reply for a link that is forged, expired or for an address the account no longer uses. */
export const VERIFY_INVALID_LINK_MESSAGE = 'This verification link is invalid or expired. Sign in and request a new one.';

/** What a route returns. */
export interface VerifyResult {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

/** The user fields the gate reads. */
export interface VerificationState {
  emailVerifiedAt: Date | string | null;
  isWorkshop?: boolean | null;
}

/**
 * True when the install can deliver email, so new agents must verify their address.
 * Provider `console` only writes mail to the server log (a self-hosted install with no email set up).
 */
export function isVerificationRequired(provider: string | null | undefined): boolean {
  return Boolean(provider) && provider !== 'console';
}

/** True when this agent has not verified their address. Workshop (demo) accounts never need to. */
export function isUnverified(user: VerificationState): boolean {
  return user.emailVerifiedAt === null && !user.isWorkshop;
}

// --- signed links ----------------------------------------------------------

/** HMAC key for verification links, distinct from session tokens and password reset links. */
function linkSecret(): string {
  return `${getSessionSecret()}:email-verification`;
}

/** Fingerprint of an address, so a link only verifies the address it was sent to. */
function emailFingerprint(email: string): string {
  return crypto.createHmac('sha256', linkSecret()).update(email.trim().toLowerCase()).digest('hex').slice(0, 16);
}

/** Signed token for a verification link. */
export function issueVerifyToken(userId: string, email: string, expiresAtMs: number): string {
  return signToken(`emailverify:${userId}:${expiresAtMs}:${emailFingerprint(email)}`, linkSecret());
}

/** The token's claims if its signature holds and it has not expired; the fingerprint is checked by the caller. */
export function readVerifyToken(token: string, nowMs = Date.now()): { userId: string; expiresAtMs: number; fingerprint: string } | null {
  const data = verifyToken(token, linkSecret());
  if (!data) return null;
  const [kind, userId, exp, fingerprint] = data.split(':');
  const expiresAtMs = Number(exp);
  if (kind !== 'emailverify' || !userId || !fingerprint || !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return null;
  return { userId, expiresAtMs, fingerprint };
}

/** The link an agent clicks. */
export function verifyLinkUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
}

// --- sending -----------------------------------------------------------------

/** Everything sending a verification email needs from its runtime. */
export interface VerifyEmailDeps {
  /** App-schema client (users). */
  db: PrismaClient;
  /** Owner-role client (`admin."LoginThrottle"`). */
  adminDb: PrismaClient;
  /** Site origin for the link, e.g. `https://kovertklaus.com`. */
  baseUrl: string;
  /** True when today's email quota is used up, so a new email would be held until tomorrow. */
  isQuotaReached: () => Promise<boolean>;
  /** Sends the verification email. */
  sendEmail: (email: { to: string; name: string; verifyUrl: string; expiresText: string }) => Promise<EmailResult>;
}

/**
 * Mails a verification link to an agent. Never throws: a failed send is logged and the agent can resend.
 *
 * @returns Whether the email was held for tomorrow because today's quota is used up.
 */
export async function sendVerificationEmail(
  deps: Pick<VerifyEmailDeps, 'baseUrl' | 'isQuotaReached' | 'sendEmail'>,
  user: { id: string; email: string; name: string },
  nowMs = Date.now()
): Promise<{ queued: boolean }> {
  let queued = false;
  try {
    queued = await deps.isQuotaReached();
  } catch {
    queued = false;
  }
  const expiresAtMs = nowMs + (queued ? VERIFY_QUEUED_LINK_TTL_MS : VERIFY_LINK_TTL_MS);
  const verifyUrl = verifyLinkUrl(deps.baseUrl, issueVerifyToken(user.id, user.email, expiresAtMs));
  try {
    const result = await deps.sendEmail({ to: user.email, name: user.name, verifyUrl, expiresText: queued ? 'in 48 hours' : 'in 24 hours' });
    if (!result.success) console.error('[EmailVerification] verification email failed:', result.error);
  } catch (err) {
    console.error('[EmailVerification] verification email failed:', err);
  }
  return { queued };
}

// --- resend limits -------------------------------------------------------------

function digest(value: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('hex').slice(0, 32);
}

/** Throttle row key for one agent. Resends are signed-in requests, so the account is the key. */
export function verifyThrottleKey(userId: string): string {
  return digest(`${VERIFY_SCOPE}:account:${userId}`);
}

/** Whether a resend may go ahead; a blocked one gets the seconds until it may. */
export async function checkVerifyThrottle(db: PrismaClient, accountHash: string, nowMs = Date.now()) {
  try {
    const counted = await Promise.all(
      RULES.map((rule) => db.loginThrottle.count({ where: { scope: VERIFY_SCOPE, accountHash, createdAt: { gt: new Date(nowMs - WINDOWS[rule]) } } }))
    );
    const rule = RULES.find((r, i) => counted[i] >= VERIFY_LIMITS[r]);
    if (!rule) return { blocked: false as const };
    const oldest = await db.loginThrottle.findFirst({
      where: { scope: VERIFY_SCOPE, accountHash, createdAt: { gt: new Date(nowMs - WINDOWS[rule]) } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const freeAt = oldest ? new Date(oldest.createdAt).getTime() + WINDOWS[rule] : nowMs + WINDOWS[rule];
    return { blocked: true as const, rule, retryAfterSec: Math.max(1, Math.ceil((freeAt - nowMs) / 1000)) };
  } catch (err) {
    console.error('[EmailVerification] throttle check failed, allowing the request:', err);
    return { blocked: false as const };
  }
}

/** The 429 reply, naming the wait. */
export function verifyThrottledResult(rule: VerifyRule, retryAfterSec: number): VerifyResult {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  const wait = `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const error =
    rule === 'COOLDOWN'
      ? `A verification email was just sent. You can request another in ${wait}.`
      : `Too many verification emails requested. Please try again in ${wait}.`;
  return { status: 429, body: { error, retryAfterSec }, headers: { 'Retry-After': String(retryAfterSec) } };
}

// --- the two steps ---------------------------------------------------------------

/**
 * "Send me another link", from the verify-email page. The caller has already checked the session.
 *
 * @param userId - The signed-in agent.
 */
export async function requestVerificationResend(deps: VerifyEmailDeps, userId: string, nowMs = Date.now()): Promise<VerifyResult> {
  const user = await deps.db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true, isWorkshop: true, accountStatus: true },
  });
  if (!user || user.accountStatus === 'DISABLED') return { status: 401, body: { error: 'Please sign in again.' } };
  if (!isUnverified(user)) return { status: 200, body: { success: true, alreadyVerified: true, message: 'Your email is already verified.' } };

  const accountHash = verifyThrottleKey(user.id);
  const throttle = await checkVerifyThrottle(deps.adminDb, accountHash, nowMs);
  if (throttle.blocked) return verifyThrottledResult(throttle.rule, throttle.retryAfterSec);
  try {
    // ipHash is required by the table; resends are keyed by account only.
    await deps.adminDb.loginThrottle.create({ data: { scope: VERIFY_SCOPE, accountHash, ipHash: '-' } });
  } catch (err) {
    console.error('[EmailVerification] could not record a resend:', err);
  }

  const { queued } = await sendVerificationEmail(deps, user, nowMs);
  return { status: 200, body: { success: true, queued, message: queued ? VERIFY_QUEUED_MESSAGE : VERIFY_SENT_MESSAGE } };
}

/**
 * Marks the address verified from the link. No session needed: the signed token is the proof.
 *
 * @param deps.sendWelcome - Sends the welcome email once the address is verified (optional, never fatal).
 */
export async function confirmEmailVerification(
  deps: { db: PrismaClient; sendWelcome?: (user: { email: string; name: string }) => Promise<unknown> },
  input: { token: unknown },
  nowMs = Date.now()
): Promise<VerifyResult> {
  const token = typeof input.token === 'string' ? input.token.trim() : '';
  const claims = token ? readVerifyToken(token, nowMs) : null;
  if (!claims) return { status: 400, body: { error: VERIFY_INVALID_LINK_MESSAGE } };

  const user = await deps.db.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true, accountStatus: true },
  });
  if (!user || user.accountStatus === 'DISABLED' || emailFingerprint(user.email) !== claims.fingerprint) {
    return { status: 400, body: { error: VERIFY_INVALID_LINK_MESSAGE } };
  }
  if (user.emailVerifiedAt !== null) {
    return { status: 200, body: { success: true, alreadyVerified: true, message: 'Your email is already verified.' } };
  }

  // Conditional on still being unverified: two tabs opening the same link verify once.
  const updated = await deps.db.user.updateMany({ where: { id: user.id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date(nowMs) } });
  if (updated.count === 1 && deps.sendWelcome) {
    try {
      await deps.sendWelcome({ email: user.email, name: user.name });
    } catch (err) {
      console.warn('[EmailVerification] welcome email failed:', err);
    }
  }
  return { status: 200, body: { success: true, message: 'Your email is verified. Welcome to KovertKlaus!' } };
}
