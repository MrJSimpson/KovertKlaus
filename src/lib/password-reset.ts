/**
 * @file password-reset.ts
 * @description Agent password reset by emailed link, with limits on how often a link can be sent.
 *
 * Tier 1 (what): `requestPasswordReset` handles "email me a reset link" and `confirmPasswordReset`
 * sets the new password from that link. Both return `{ status, body }` so the Next.js routes
 * (self-hosted) and the Worker (SaaS) share one implementation, as `intel-messages.ts` does.
 * Tier 2 (why): Agents had no way back into an account after forgetting a password. Owner decisions
 * (2026-10-30): the reset must be verified through email; links last 30 minutes and work once; one
 * email per account every 5 minutes, 3 an hour, and 10 an hour from one IP; the same reply whether
 * or not the email has an account. When the daily email quota is used up the email is queued and
 * the agent is told it arrives tomorrow morning, so that link must still work then.
 * Tier 3 (how): The link carries a signed token: user ID, expiry and a fingerprint of the current
 * password hash, HMAC-signed with a key derived from the session secret. Setting a new password
 * changes the hash, which voids every outstanding link, so a link works once without a token table.
 * Requests are rows in `admin."LoginThrottle"` with scope `RESET` (purged hourly with the rest).
 * The quota check runs before the account lookup, so the "arrives tomorrow" reply reveals nothing
 * about which emails have accounts. If the throttle table cannot be read the check fails open.
 */

import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { getSessionSecret, isValidEmail, signToken, validatePassword, verifyToken } from '@/lib/security';
import { UNKNOWN_IP } from '@/lib/login-throttle';
import { quotaDayStart } from '@/lib/email/daily-limit';
import { hashPassword } from '@/lib/password';
import type { EmailResult } from '@/lib/email/types';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** How long a reset link works when the email goes out right away. */
export const RESET_LINK_TTL_MS = 30 * MINUTE_MS;

/** A queued link works until noon Pacific on the next quota day: midnight plus this, corrected for DST. */
export const QUEUED_LINK_GRACE_MS = 12 * HOUR_MS;

/** `LoginThrottle.scope` for reset requests. */
export const RESET_SCOPE = 'RESET';

/** The rule that blocked a request. */
export type ResetRule = 'COOLDOWN' | 'ACCOUNT_HOUR' | 'IP_HOUR';

/** Requests allowed per window. */
export const RESET_LIMITS: Record<ResetRule, number> = { COOLDOWN: 1, ACCOUNT_HOUR: 3, IP_HOUR: 10 };

const WINDOWS: Record<ResetRule, number> = { COOLDOWN: 5 * MINUTE_MS, ACCOUNT_HOUR: HOUR_MS, IP_HOUR: HOUR_MS };

const RULES: ResetRule[] = ['COOLDOWN', 'ACCOUNT_HOUR', 'IP_HOUR'];

/** Reply when the email went out (or would have, for an unknown address). */
export const RESET_SENT_MESSAGE =
  "If an account uses that email, we've sent it a password reset link. The link works once and expires in 30 minutes. Check your spam folder if it doesn't arrive.";

/** Reply when today's email quota is used up (owner wording, 2026-10-30). */
export const RESET_QUEUED_MESSAGE =
  'Due to email limitations during beta, we are unable to send email currently. Your password reset email will reach you tomorrow AM.';

/** Reply for a link that is forged, expired or already used. */
export const RESET_INVALID_LINK_MESSAGE = 'This reset link is invalid, expired or already used. Request a new one from the sign-in page.';

/** What a route returns. */
export interface ResetResult {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

/** Everything a reset request needs from its runtime. */
export interface ResetRequestDeps {
  /** App-schema client (users). */
  db: PrismaClient;
  /** Owner-role client (`admin."LoginThrottle"`). */
  adminDb: PrismaClient;
  /** Site origin for the link, e.g. `https://kovertklaus.com`. */
  baseUrl: string;
  /** True when today's email quota is used up, so a new email would be held until tomorrow. */
  isQuotaReached: () => Promise<boolean>;
  /** Sends the reset email. */
  sendEmail: (email: { to: string; name: string; resetUrl: string; expiresText: string }) => Promise<EmailResult>;
  /** One WARN per tripped limit, for the system log. */
  onTrip?: (message: string, metadata: Record<string, unknown>) => void;
}

// --- signed links ----------------------------------------------------------

/** HMAC key for reset links: derived from the session secret, so a session token never verifies as a link. */
function linkSecret(): string {
  return `${getSessionSecret()}:password-reset`;
}

/** Fingerprint of a password hash: changes whenever the password does. */
function hashFingerprint(passwordHash: string): string {
  return crypto.createHmac('sha256', linkSecret()).update(passwordHash).digest('hex').slice(0, 16);
}

/** Signed token for a reset link. */
export function issueResetToken(userId: string, passwordHash: string, expiresAtMs: number): string {
  return signToken(`pwreset:${userId}:${expiresAtMs}:${hashFingerprint(passwordHash)}`, linkSecret());
}

/** The token's claims if its signature holds and it has not expired; the fingerprint is checked by the caller. */
export function readResetToken(token: string, nowMs = Date.now()): { userId: string; expiresAtMs: number; fingerprint: string } | null {
  const data = verifyToken(token, linkSecret());
  if (!data) return null;
  const [kind, userId, exp, fingerprint] = data.split(':');
  const expiresAtMs = Number(exp);
  if (kind !== 'pwreset' || !userId || !fingerprint || !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return null;
  return { userId, expiresAtMs, fingerprint };
}

/** When a link sent now expires: 30 minutes, or noon Pacific tomorrow when the email is queued. */
export function resetLinkExpiry(queued: boolean, nowMs = Date.now()): number {
  if (!queued) return nowMs + RESET_LINK_TTL_MS;
  const nextQuotaDay = quotaDayStart(new Date(nowMs + 24 * HOUR_MS)).getTime();
  // Midnight + 12h is 11:00 or 13:00 on a daylight-saving change day; correct it to the wall clock.
  const guess = nextQuotaDay + QUEUED_LINK_GRACE_MS;
  return guess + (12 - pacificHour(guess)) * HOUR_MS;
}

/** The hour (0-23) on the Pacific wall clock at `ms`. */
function pacificHour(ms: number): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hourCycle: 'h23' }).format(new Date(ms)));
}

// --- request limits ------------------------------------------------------------

function digest(value: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('hex').slice(0, 32);
}

/** Keys for one request. Unknown emails are keyed the same way, so limits reveal nothing. */
export function resetThrottleKeys(email: string, ip: string) {
  return {
    accountHash: digest(`${RESET_SCOPE}:account:${email.trim().toLowerCase()}`),
    ipHash: digest(`${RESET_SCOPE}:ip:${ip}`),
    ipKnown: ip !== UNKNOWN_IP,
  };
}
type ResetKeys = ReturnType<typeof resetThrottleKeys>;

function ruleWhere(keys: ResetKeys, rule: ResetRule, nowMs: number) {
  const createdAt = { gt: new Date(nowMs - WINDOWS[rule]) };
  return rule === 'IP_HOUR'
    ? { scope: RESET_SCOPE, ipHash: keys.ipHash, createdAt }
    : { scope: RESET_SCOPE, accountHash: keys.accountHash, createdAt };
}

/** Whether a request may go ahead; a blocked one gets the seconds until it may. */
export async function checkResetThrottle(db: PrismaClient, keys: ResetKeys, nowMs = Date.now()) {
  try {
    const active = RULES.filter((r) => r !== 'IP_HOUR' || keys.ipKnown);
    const counted = await Promise.all(active.map((rule) => db.loginThrottle.count({ where: ruleWhere(keys, rule, nowMs) })));
    const rule = active.find((r, i) => counted[i] >= RESET_LIMITS[r]);
    if (!rule) return { blocked: false as const, counts: Object.fromEntries(active.map((r, i) => [r, counted[i]])) as Partial<Record<ResetRule, number>> };
    const oldest = await db.loginThrottle.findFirst({ where: ruleWhere(keys, rule, nowMs), orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
    const freeAt = oldest ? new Date(oldest.createdAt).getTime() + WINDOWS[rule] : nowMs + WINDOWS[rule];
    return { blocked: true as const, rule, retryAfterSec: Math.max(1, Math.ceil((freeAt - nowMs) / 1000)) };
  } catch (err) {
    console.error('[PasswordReset] throttle check failed, allowing the request:', err);
    return { blocked: false as const, counts: {} };
  }
}

/** The 429 reply. The cooldown names its wait so a person who clicked twice knows when to retry. */
export function resetThrottledResult(rule: ResetRule, retryAfterSec: number): ResetResult {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  const wait = `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const error =
    rule === 'COOLDOWN'
      ? `A reset email was just requested for this address. You can request another in ${wait}.`
      : `Too many reset requests. Please try again in ${wait}.`;
  return { status: 429, body: { error, retryAfterSec }, headers: { 'Retry-After': String(retryAfterSec) } };
}

// --- the two steps ---------------------------------------------------------------

/**
 * Step 1: "email me a reset link". Always answers the same way for known and unknown emails.
 *
 * @param input.email - The address typed on the form.
 * @param input.ip - Client IP (`clientIp(headers)`).
 */
export async function requestPasswordReset(deps: ResetRequestDeps, input: { email: unknown; ip: string }, nowMs = Date.now()): Promise<ResetResult> {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!email || !isValidEmail(email)) return { status: 400, body: { error: 'Enter the email address you use to sign in.' } };

  const keys = resetThrottleKeys(email, input.ip);
  const throttle = await checkResetThrottle(deps.adminDb, keys, nowMs);
  if (throttle.blocked) return resetThrottledResult(throttle.rule, throttle.retryAfterSec);

  try {
    await deps.adminDb.loginThrottle.create({ data: { scope: RESET_SCOPE, accountHash: keys.accountHash, ipHash: keys.ipHash } });
    for (const rule of RULES) {
      const before = throttle.counts[rule];
      if (before !== undefined && before + 1 === RESET_LIMITS[rule] && rule !== 'COOLDOWN') {
        deps.onTrip?.(`Password reset limit reached: ${rule === 'IP_HOUR' ? 'one IP' : 'one account'} in an hour (${RESET_LIMITS[rule]} requests).`, {
          scope: RESET_SCOPE,
          rule,
          ip: keys.ipKnown ? keys.ipHash.slice(0, 8) : UNKNOWN_IP,
        });
      }
    }
  } catch (err) {
    console.error('[PasswordReset] could not record a request:', err);
  }

  // Decided before the account lookup, so this reply is the same for every address.
  let queued = false;
  try {
    queued = await deps.isQuotaReached();
  } catch {
    queued = false;
  }

  const user = await deps.db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, passwordHash: true, accountStatus: true } });
  if (user && user.accountStatus !== 'DISABLED') {
    const expiresAtMs = resetLinkExpiry(queued, nowMs);
    const token = issueResetToken(user.id, user.passwordHash, expiresAtMs);
    const resetUrl = `${deps.baseUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    const expiresText = queued ? 'at noon Pacific time today' : 'in 30 minutes';
    try {
      const result = await deps.sendEmail({ to: user.email, name: user.name, resetUrl, expiresText });
      if (!result.success) console.error('[PasswordReset] reset email failed:', result.error);
      else if (result.held && !queued) {
        // Rare race: the quota ran out between the check and the send, so this 30-minute link
        // arrives expired tomorrow. The agent can request a new one then.
        console.warn('[PasswordReset] reset email held after the quota check passed; its link will have expired on delivery.');
      }
    } catch (err) {
      console.error('[PasswordReset] reset email failed:', err);
    }
  }

  return { status: 200, body: { success: true, queued, message: queued ? RESET_QUEUED_MESSAGE : RESET_SENT_MESSAGE } };
}

/**
 * Step 2: set the new password from the link. Signs the agent out everywhere.
 *
 * @param db - App-schema client.
 */
export async function confirmPasswordReset(db: PrismaClient, input: { token: unknown; password: unknown }, nowMs = Date.now()): Promise<ResetResult> {
  const token = typeof input.token === 'string' ? input.token.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const claims = token ? readResetToken(token, nowMs) : null;
  if (!claims) return { status: 400, body: { error: RESET_INVALID_LINK_MESSAGE } };

  const check = validatePassword(password);
  if (!check.isValid) return { status: 400, body: { error: check.error } };

  const user = await db.user.findUnique({ where: { id: claims.userId }, select: { id: true, passwordHash: true, accountStatus: true } });
  if (!user || user.accountStatus === 'DISABLED' || hashFingerprint(user.passwordHash) !== claims.fingerprint) {
    return { status: 400, body: { error: RESET_INVALID_LINK_MESSAGE } };
  }

  const passwordHash = await hashPassword(password);
  // Conditional on the old hash: two tabs submitting the same link cannot both succeed.
  const updated = await db.user.updateMany({
    where: { id: user.id, passwordHash: user.passwordHash },
    data: { passwordHash, sessionsRevokedAt: new Date(nowMs) },
  });
  if (updated.count !== 1) return { status: 400, body: { error: RESET_INVALID_LINK_MESSAGE } };

  return { status: 200, body: { success: true, message: 'Your password has been changed. Sign in with your new password.' } };
}
