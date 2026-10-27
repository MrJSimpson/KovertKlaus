/**
 * @file login-throttle.ts
 * @description Rate limiting for the agent and North Pole sign-in routes.
 *
 * Tier 1 (what): `loginThrottleKeys` derives the keys for one attempt, `checkLoginThrottle` says
 * whether it may proceed, `recordLoginFailure` counts a failed attempt, `clearLoginFailures`
 * forgets an account + IP pair after a successful sign-in, and `purgeLoginThrottle` drops old rows
 * (hourly cron). `/api/users/login` and `/api/northpole/login` use them in both runtimes.
 * Tier 2 (why): Neither sign-in route limited password guessing (W39 #4, never done), and an
 * in-memory counter does not work on Workers, where requests spread over isolates that share
 * nothing. Owner decisions (2026-10-27): counts in the database; layered limits with no hard
 * account lockout, so a stranger cannot keep an agent out by guessing wrong on purpose; the
 * North Pole is tighter; one WARN per tripped limit in the system log, failures themselves are
 * not logged.
 * Tier 3 (how): One `admin."LoginThrottle"` row per failure. Accounts and IPs are stored only as
 * HMAC-SHA256 digests keyed with the session secret. Three sliding windows are checked before the
 * password is: account + IP and IP over 15 minutes, account over an hour. An unknown IP (no proxy
 * header, self-hosted) skips the IP rule so all such agents do not share one counter. Unknown
 * accounts count like known ones, so limits reveal nothing about which emails exist. If the table
 * cannot be read the check fails open: an outage must not lock everyone out.
 */

import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { getSessionSecret } from '@/lib/security';

const MINUTE_MS = 60 * 1000;

/** Window for the account + IP and IP rules. */
export const SHORT_WINDOW_MS = 15 * MINUTE_MS;

/** Window for the account rule. */
export const LONG_WINDOW_MS = 60 * MINUTE_MS;

/** Rows older than this are purged. */
export const THROTTLE_RETENTION_MS = 24 * 60 * MINUTE_MS;

/** Which sign-in a row belongs to. */
export type LoginScope = 'USER' | 'ADMIN';

/** The rule that blocked an attempt. */
export type ThrottleRule = 'ACCOUNT_IP' | 'IP' | 'ACCOUNT';

/** Failures allowed per window before further attempts wait. */
export const LOGIN_LIMITS: Record<LoginScope, Record<ThrottleRule, number>> = {
  USER: { ACCOUNT_IP: 5, IP: 20, ACCOUNT: 50 },
  ADMIN: { ACCOUNT_IP: 3, IP: 10, ACCOUNT: 20 },
};

/** Stand-in when the client IP is not known. */
export const UNKNOWN_IP = 'unknown';

/** Keys for one sign-in attempt. */
export interface LoginThrottleKeys {
  scope: LoginScope;
  accountHash: string;
  ipHash: string;
  /** False when the client IP is unknown: the IP rule is skipped. */
  ipKnown: boolean;
}

/** Failure counts in each window, as `checkLoginThrottle` saw them. */
export type ThrottleCounts = Record<ThrottleRule, number>;

/** Outcome of `checkLoginThrottle`. */
export type ThrottleDecision =
  | { blocked: false; counts: ThrottleCounts }
  | { blocked: true; rule: ThrottleRule; retryAfterSec: number };

/** The client IP: Cloudflare's header first, then the first forwarded address. */
export function clientIp(headers: Headers): string {
  const ip =
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0] ||
    headers.get('x-real-ip') ||
    '';
  return ip.trim() || UNKNOWN_IP;
}

function digest(value: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('hex').slice(0, 32);
}

/**
 * Keys for one attempt. The account is the typed identifier (email or username), trimmed and
 * lower-cased, so it works the same whether or not the account exists.
 */
export function loginThrottleKeys(scope: LoginScope, identifier: string, ip: string): LoginThrottleKeys {
  return {
    scope,
    accountHash: digest(`${scope}:account:${identifier.trim().toLowerCase()}`),
    ipHash: digest(`${scope}:ip:${ip}`),
    ipKnown: ip !== UNKNOWN_IP,
  };
}

/** The windowed `where` clause for each rule. */
function ruleWhere(keys: LoginThrottleKeys, rule: ThrottleRule, nowMs: number) {
  const since = (ms: number) => ({ gt: new Date(nowMs - ms) });
  if (rule === 'ACCOUNT_IP') return { scope: keys.scope, accountHash: keys.accountHash, ipHash: keys.ipHash, createdAt: since(SHORT_WINDOW_MS) };
  if (rule === 'IP') return { scope: keys.scope, ipHash: keys.ipHash, createdAt: since(SHORT_WINDOW_MS) };
  return { scope: keys.scope, accountHash: keys.accountHash, createdAt: since(LONG_WINDOW_MS) };
}

const RULES: ThrottleRule[] = ['ACCOUNT_IP', 'IP', 'ACCOUNT'];

/**
 * Whether an attempt may go on to the password check. Blocked attempts get the seconds until the
 * oldest failure in the tripped window ages out.
 *
 * @param db - Owner-role client (`adminDb`): the table is in the admin schema.
 */
export async function checkLoginThrottle(db: PrismaClient, keys: LoginThrottleKeys, nowMs = Date.now()): Promise<ThrottleDecision> {
  const limits = LOGIN_LIMITS[keys.scope];
  try {
    const counted = await Promise.all(
      RULES.map((rule) => (rule === 'IP' && !keys.ipKnown ? 0 : db.loginThrottle.count({ where: ruleWhere(keys, rule, nowMs) })))
    );
    const counts = Object.fromEntries(RULES.map((rule, i) => [rule, counted[i]])) as ThrottleCounts;
    const rule = RULES.find((r) => counts[r] >= limits[r]);
    if (!rule) return { blocked: false, counts };

    const oldest = await db.loginThrottle.findFirst({ where: ruleWhere(keys, rule, nowMs), orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
    const window = rule === 'ACCOUNT' ? LONG_WINDOW_MS : SHORT_WINDOW_MS;
    const freeAt = oldest ? new Date(oldest.createdAt).getTime() + window : nowMs + window;
    return { blocked: true, rule, retryAfterSec: Math.max(1, Math.ceil((freeAt - nowMs) / 1000)) };
  } catch (err) {
    console.error('[LoginThrottle] check failed, allowing the attempt:', err);
    return { blocked: false, counts: { ACCOUNT_IP: 0, IP: 0, ACCOUNT: 0 } };
  }
}

/**
 * Counts one failed attempt. Calls `onTrip` once for each rule this failure brings to its limit,
 * so the system log gets one entry per tripped limit, not one per failure.
 */
export async function recordLoginFailure(
  db: PrismaClient,
  keys: LoginThrottleKeys,
  counts: ThrottleCounts,
  onTrip?: (rule: ThrottleRule) => void
): Promise<void> {
  try {
    await db.loginThrottle.create({ data: { scope: keys.scope, accountHash: keys.accountHash, ipHash: keys.ipHash } });
  } catch (err) {
    console.error('[LoginThrottle] could not record a failure:', err);
    return;
  }
  const limits = LOGIN_LIMITS[keys.scope];
  for (const rule of RULES) {
    if (rule === 'IP' && !keys.ipKnown) continue;
    if (counts[rule] + 1 === limits[rule]) onTrip?.(rule);
  }
}

/** Forgets this account + IP pair's failures after a successful sign-in. */
export async function clearLoginFailures(db: PrismaClient, keys: LoginThrottleKeys): Promise<void> {
  await db.loginThrottle
    .deleteMany({ where: { scope: keys.scope, accountHash: keys.accountHash, ipHash: keys.ipHash } })
    .catch((err: unknown) => console.error('[LoginThrottle] could not clear failures:', err));
}

/** Deletes rows older than `THROTTLE_RETENTION_MS`. Returns how many went. */
export async function purgeLoginThrottle(db: PrismaClient, nowMs = Date.now()): Promise<number> {
  const result = await db.loginThrottle.deleteMany({ where: { createdAt: { lt: new Date(nowMs - THROTTLE_RETENTION_MS) } } });
  return result.count;
}

/** `429` body and header for a blocked attempt. */
export function throttledResponseParts(retryAfterSec: number): { body: { error: string; retryAfterSec: number }; headers: Record<string, string> } {
  const minutes = Math.ceil(retryAfterSec / 60);
  return {
    body: { error: `Too many sign-in attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`, retryAfterSec },
    headers: { 'Retry-After': String(retryAfterSec) },
  };
}

/** The system-log line for a tripped limit. Hash prefixes only: enough to correlate, not to identify. */
export function tripLogMessage(keys: LoginThrottleKeys, rule: ThrottleRule): { message: string; metadata: Record<string, unknown> } {
  const what = rule === 'ACCOUNT_IP' ? 'one account from one IP' : rule === 'IP' ? 'one IP across accounts' : 'one account across IPs';
  return {
    message: `${keys.scope === 'ADMIN' ? 'North Pole' : 'Agent'} sign-in limit reached: ${what} (${LOGIN_LIMITS[keys.scope][rule]} failures).`,
    metadata: { scope: keys.scope, rule, account: keys.accountHash.slice(0, 8), ip: keys.ipKnown ? keys.ipHash.slice(0, 8) : UNKNOWN_IP },
  };
}
