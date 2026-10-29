/**
 * @file registration-throttle.ts
 * @description Rate limiting for agent registration (`POST /api/users`).
 *
 * Tier 1 (what): `registrationThrottleKeys` derives the keys for one sign-up, `checkRegistrationThrottle`
 * says whether it may proceed, and `recordRegistration` counts one that succeeded. Both runtimes use them.
 * Tier 2 (why): Beta opens registration to anyone. Each account is a database row and a welcome email
 * against Brevo's 300/day quota, so a script must not be able to create them without limit. Owner
 * decisions (2026-10-29): per IP 3 an hour and 10 a day; a site-wide ceiling of 200 a day as an emergency
 * brake; a sign-up that joins a real mission skips the ceiling and the hourly IP rule, so a family signing
 * up together on one home network, or after a bot filled the ceiling, is not turned away; one WARN per
 * tripped limit in the system log.
 * Tier 3 (how): Successful sign-ups are rows in `admin."LoginThrottle"` with scope `REGISTER` (the scope
 * is a plain string, so no schema change). The IP is stored only as an HMAC digest. The windows are at
 * most 24 hours, which matches the hourly purge in `purgeLoginThrottle`. An unknown IP (no proxy header,
 * self-hosted) skips the IP rules. If the table cannot be read the check fails open.
 */

import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { getSessionSecret } from '@/lib/security';
import { UNKNOWN_IP } from '@/lib/login-throttle';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** `LoginThrottle.scope` for registration rows. */
export const REGISTER_SCOPE = 'REGISTER';

/** The rule that blocked a sign-up. */
export type RegistrationRule = 'IP_HOUR' | 'IP_DAY' | 'SITE_DAY';

/** Sign-ups allowed per window. */
export const REGISTRATION_LIMITS: Record<RegistrationRule, number> = { IP_HOUR: 3, IP_DAY: 10, SITE_DAY: 200 };

const WINDOWS: Record<RegistrationRule, number> = { IP_HOUR: HOUR_MS, IP_DAY: DAY_MS, SITE_DAY: DAY_MS };

const RULES: RegistrationRule[] = ['IP_HOUR', 'IP_DAY', 'SITE_DAY'];

/** Keys for one sign-up. */
export interface RegistrationThrottleKeys {
  accountHash: string;
  ipHash: string;
  /** False when the client IP is unknown: the IP rules are skipped. */
  ipKnown: boolean;
  /** True when the sign-up joins a recruiting mission: the site-wide ceiling and the hourly IP rule are skipped. */
  joinsMission: boolean;
}

/** Sign-up counts in each window, as `checkRegistrationThrottle` saw them. */
export type RegistrationCounts = Record<RegistrationRule, number>;

/** Outcome of `checkRegistrationThrottle`. */
export type RegistrationDecision =
  | { blocked: false; counts: RegistrationCounts }
  | { blocked: true; rule: RegistrationRule; retryAfterSec: number };

function digest(value: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('hex').slice(0, 32);
}

/** Keys for one sign-up. The email only fills the row's required account column; no rule reads it. */
export function registrationThrottleKeys(email: string, ip: string, joinsMission: boolean): RegistrationThrottleKeys {
  return {
    accountHash: digest(`${REGISTER_SCOPE}:account:${email.trim().toLowerCase()}`),
    ipHash: digest(`${REGISTER_SCOPE}:ip:${ip}`),
    ipKnown: ip !== UNKNOWN_IP,
    joinsMission,
  };
}

/** Rules a mission invite skips. The daily IP rule still applies, so invite links cannot be farmed. */
const INVITE_SKIPS: RegistrationRule[] = ['SITE_DAY', 'IP_HOUR'];

function skipped(keys: RegistrationThrottleKeys, rule: RegistrationRule): boolean {
  if (keys.joinsMission && INVITE_SKIPS.includes(rule)) return true;
  return rule !== 'SITE_DAY' && !keys.ipKnown;
}

function ruleWhere(keys: RegistrationThrottleKeys, rule: RegistrationRule, nowMs: number) {
  const createdAt = { gt: new Date(nowMs - WINDOWS[rule]) };
  return rule === 'SITE_DAY' ? { scope: REGISTER_SCOPE, createdAt } : { scope: REGISTER_SCOPE, ipHash: keys.ipHash, createdAt };
}

/**
 * Whether a sign-up may go ahead. Blocked sign-ups get the seconds until the oldest one in the tripped
 * window ages out.
 *
 * @param db - Owner-role client (`adminDb`): the table is in the admin schema.
 */
export async function checkRegistrationThrottle(
  db: PrismaClient,
  keys: RegistrationThrottleKeys,
  nowMs = Date.now()
): Promise<RegistrationDecision> {
  try {
    const counted = await Promise.all(
      RULES.map((rule) => (skipped(keys, rule) ? 0 : db.loginThrottle.count({ where: ruleWhere(keys, rule, nowMs) })))
    );
    const counts = Object.fromEntries(RULES.map((rule, i) => [rule, counted[i]])) as RegistrationCounts;
    const rule = RULES.find((r) => !skipped(keys, r) && counts[r] >= REGISTRATION_LIMITS[r]);
    if (!rule) return { blocked: false, counts };

    const oldest = await db.loginThrottle.findFirst({ where: ruleWhere(keys, rule, nowMs), orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
    const freeAt = oldest ? new Date(oldest.createdAt).getTime() + WINDOWS[rule] : nowMs + WINDOWS[rule];
    return { blocked: true, rule, retryAfterSec: Math.max(1, Math.ceil((freeAt - nowMs) / 1000)) };
  } catch (err) {
    console.error('[RegistrationThrottle] check failed, allowing the sign-up:', err);
    return { blocked: false, counts: { IP_HOUR: 0, IP_DAY: 0, SITE_DAY: 0 } };
  }
}

/**
 * Counts one successful sign-up. Calls `onTrip` once for each rule this sign-up brings to its limit, so
 * the system log gets one entry per tripped limit. A sign-up that skipped a rule still counts toward
 * it.
 */
export async function recordRegistration(
  db: PrismaClient,
  keys: RegistrationThrottleKeys,
  counts: RegistrationCounts,
  onTrip?: (rule: RegistrationRule) => void
): Promise<void> {
  try {
    await db.loginThrottle.create({ data: { scope: REGISTER_SCOPE, accountHash: keys.accountHash, ipHash: keys.ipHash } });
  } catch (err) {
    console.error('[RegistrationThrottle] could not record a sign-up:', err);
    return;
  }
  for (const rule of RULES) {
    if (skipped(keys, rule)) continue; // not counted at check time, so +1 is unknown
    if (counts[rule] + 1 === REGISTRATION_LIMITS[rule]) onTrip?.(rule);
  }
}

/** `429` body and header for a blocked sign-up. */
export function registrationThrottledParts(rule: RegistrationRule, retryAfterSec: number): {
  body: { error: string; retryAfterSec: number };
  headers: Record<string, string>;
} {
  const error =
    rule === 'SITE_DAY'
      ? 'KovertKlaus has reached its limit of new accounts for today. Please try again tomorrow, or ask your Head Elf for a mission invite link.'
      : 'Too many new accounts from this network. Please try again later.';
  return { body: { error, retryAfterSec }, headers: { 'Retry-After': String(retryAfterSec) } };
}

/** The system-log line for a tripped limit. IP hash prefix only: enough to correlate, not to identify. */
export function registrationTripLogMessage(keys: RegistrationThrottleKeys, rule: RegistrationRule): { message: string; metadata: Record<string, unknown> } {
  const what = rule === 'IP_HOUR' ? 'one IP in an hour' : rule === 'IP_DAY' ? 'one IP in a day' : 'the whole site in a day';
  return {
    message: `Registration limit reached: ${what} (${REGISTRATION_LIMITS[rule]} sign-ups).`,
    metadata: { scope: REGISTER_SCOPE, rule, ip: keys.ipKnown ? keys.ipHash.slice(0, 8) : UNKNOWN_IP },
  };
}
