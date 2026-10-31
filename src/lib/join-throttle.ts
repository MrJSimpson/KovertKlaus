/**
 * @file join-throttle.ts
 * @description Limits how many wrong mission codes one agent or one network may try.
 *
 * Tier 1 (what): `checkJoinThrottle` says whether a mission-code lookup or join may go ahead;
 * `recordWrongCode` counts a code that matched no mission. Used by `GET /api/operations?code=`
 * and `POST /api/invitations/accept` in both the edge worker (SaaS) and the Next routes.
 * Tier 2 (why): Mission codes are public-facing (invite links), so a script could try codes until
 * one matches (owner report 2026-10-31). Codes are 8 random Base32 characters (~1.1 trillion), so
 * a hit takes many guesses; capping wrong guesses makes that impractical.
 * Tier 3 (how): Rows go in the existing `admin."LoginThrottle"` table under scope `JOIN` (the scope
 * column is free text, so no schema change). Only wrong codes are counted; opening a real mission
 * never is. Identifiers are HMAC digests, never raw IDs or addresses. A storage error allows the
 * attempt (fail open), like the sign-in throttle.
 */

import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { getSessionSecret } from '@/lib/security';
import { clientIp, UNKNOWN_IP } from '@/lib/login-throttle';
import { logSystemEvent } from '@/lib/logger';

const MINUTE_MS = 60 * 1000;

/** Scope value in `LoginThrottle.scope`. */
export const JOIN_SCOPE = 'JOIN';

/** `ACCOUNT`: one signed-in agent, any network. `IP`: one network, signed in or not. */
export type JoinRule = 'ACCOUNT' | 'IP';

/** Wrong codes allowed per window before further lookups wait. */
export const JOIN_LIMITS: Record<JoinRule, number> = { ACCOUNT: 10, IP: 30 };

/** Window per rule: an hour per agent, 15 minutes per network. */
export const JOIN_WINDOWS_MS: Record<JoinRule, number> = { ACCOUNT: 60 * MINUTE_MS, IP: 15 * MINUTE_MS };

const RULES: JoinRule[] = ['ACCOUNT', 'IP'];

/** Account placeholder for signed-out lookups: it fills the required column; the ACCOUNT rule skips it. */
const ANONYMOUS = 'anonymous';

/** Keys for one lookup. */
export interface JoinThrottleKeys {
  accountHash: string;
  ipHash: string;
  /** False when signed out: the ACCOUNT rule is skipped. */
  hasAccount: boolean;
  /** False when the client IP is unknown: the IP rule is skipped. */
  ipKnown: boolean;
}

export type JoinCounts = Record<JoinRule, number>;

export type JoinDecision = { blocked: false; counts: JoinCounts } | { blocked: true; rule: JoinRule; retryAfterSec: number };

function digest(value: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('hex').slice(0, 32);
}

/**
 * Keys for one mission-code lookup.
 *
 * @param userId - The signed-in agent, or `null` when signed out.
 * @param ip - From `clientIp(request.headers)`.
 */
export function joinThrottleKeys(userId: string | null | undefined, ip: string): JoinThrottleKeys {
  return {
    accountHash: digest(`${JOIN_SCOPE}:account:${userId || ANONYMOUS}`),
    ipHash: digest(`${JOIN_SCOPE}:ip:${ip}`),
    hasAccount: Boolean(userId),
    ipKnown: ip !== UNKNOWN_IP,
  };
}

function skipped(keys: JoinThrottleKeys, rule: JoinRule): boolean {
  return rule === 'ACCOUNT' ? !keys.hasAccount : !keys.ipKnown;
}

function ruleWhere(keys: JoinThrottleKeys, rule: JoinRule, nowMs: number) {
  const createdAt = { gt: new Date(nowMs - JOIN_WINDOWS_MS[rule]) };
  return rule === 'ACCOUNT'
    ? { scope: JOIN_SCOPE, accountHash: keys.accountHash, createdAt }
    : { scope: JOIN_SCOPE, ipHash: keys.ipHash, createdAt };
}

/**
 * Whether a lookup may go ahead. Blocked lookups get the seconds until the oldest wrong code in the
 * tripped window ages out.
 *
 * @param db - Owner-role client (`adminDb`): the table is in the admin schema.
 */
export async function checkJoinThrottle(db: PrismaClient, keys: JoinThrottleKeys, nowMs = Date.now()): Promise<JoinDecision> {
  try {
    const counted = await Promise.all(RULES.map((rule) => (skipped(keys, rule) ? 0 : db.loginThrottle.count({ where: ruleWhere(keys, rule, nowMs) }))));
    const counts = Object.fromEntries(RULES.map((rule, i) => [rule, counted[i]])) as JoinCounts;
    const rule = RULES.find((r) => !skipped(keys, r) && counts[r] >= JOIN_LIMITS[r]);
    if (!rule) return { blocked: false, counts };

    const oldest = await db.loginThrottle.findFirst({ where: ruleWhere(keys, rule, nowMs), orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
    const freeAt = oldest ? new Date(oldest.createdAt).getTime() + JOIN_WINDOWS_MS[rule] : nowMs + JOIN_WINDOWS_MS[rule];
    return { blocked: true, rule, retryAfterSec: Math.max(1, Math.ceil((freeAt - nowMs) / 1000)) };
  } catch (err) {
    console.error('[JoinThrottle] check failed, allowing the lookup:', err);
    return { blocked: false, counts: { ACCOUNT: 0, IP: 0 } };
  }
}

/**
 * Counts one code that matched no mission. Calls `onTrip` once for each rule this brings to its
 * limit, so the system log gets one entry per tripped limit, not one per guess.
 */
export async function recordWrongCode(db: PrismaClient, keys: JoinThrottleKeys, counts: JoinCounts, onTrip?: (rule: JoinRule) => void): Promise<void> {
  try {
    await db.loginThrottle.create({ data: { scope: JOIN_SCOPE, accountHash: keys.accountHash, ipHash: keys.ipHash } });
  } catch (err) {
    console.error('[JoinThrottle] could not record a wrong code:', err);
    return;
  }
  for (const rule of RULES) {
    if (!skipped(keys, rule) && counts[rule] + 1 === JOIN_LIMITS[rule]) onTrip?.(rule);
  }
}

/** `429` body and header for a blocked lookup. */
export function joinThrottledResponseParts(retryAfterSec: number): { body: { error: string; retryAfterSec: number }; headers: Record<string, string> } {
  const minutes = Math.ceil(retryAfterSec / 60);
  return {
    body: { error: `Too many mission codes that didn't match. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`, retryAfterSec },
    headers: { 'Retry-After': String(retryAfterSec) },
  };
}

/** The system-log line for a tripped limit. Hash prefixes only: enough to correlate, not to identify. */
export function joinTripLogMessage(keys: JoinThrottleKeys, rule: JoinRule): { message: string; metadata: Record<string, unknown> } {
  const what = rule === 'ACCOUNT' ? 'one agent across networks' : 'one network';
  return {
    message: `Mission code guessing limit reached: ${what} (${JOIN_LIMITS[rule]} wrong codes).`,
    metadata: { scope: JOIN_SCOPE, rule, account: keys.hasAccount ? keys.accountHash.slice(0, 8) : ANONYMOUS, ip: keys.ipKnown ? keys.ipHash.slice(0, 8) : UNKNOWN_IP },
  };
}

/** Outcome of `openJoinGate`: a ready `429` response, or a callback to count a wrong code. */
export type JoinGate = { blocked: Response } | { blocked: null; wrongCode: () => Promise<void> };

/**
 * One call for a route that looks up a mission by code: checks the limits, and returns either the
 * `429` to send or a `wrongCode` callback to run when the code matches no mission. A tripped limit
 * writes one warning to the North Pole system log.
 *
 * @param db - Owner-role client (`adminDb`).
 * @param userId - The signed-in agent, or `null`.
 * @param headers - The request headers (for the client IP).
 */
export async function openJoinGate(db: PrismaClient, userId: string | null | undefined, headers: Headers): Promise<JoinGate> {
  const keys = joinThrottleKeys(userId, clientIp(headers));
  const decision = await checkJoinThrottle(db, keys);
  if (decision.blocked) {
    const parts = joinThrottledResponseParts(decision.retryAfterSec);
    return { blocked: Response.json(parts.body, { status: 429, headers: parts.headers }) };
  }
  return {
    blocked: null,
    wrongCode: () =>
      recordWrongCode(db, keys, decision.counts, (rule) => {
        const { message, metadata } = joinTripLogMessage(keys, rule);
        logSystemEvent({ level: 'WARN', category: 'AUTH', message, metadata }).catch(() => {});
      }),
  };
}
