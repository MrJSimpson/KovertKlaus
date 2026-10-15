/**
 * @file session-token.ts
 * @description Expiring, typed session tokens for Elf Agents and North Pole admins.
 *
 * Tier 1 (what): `issueSessionToken` signs `<kind>.<subjectId>.<expiresAtSeconds>`, and
 * `readSessionToken` returns the subject only when the signature, kind and expiry all check out.
 * Tier 2 (why): Tokens used to be a bare signed ID. They never expired, so a copied cookie
 * worked forever, and user and admin tokens were interchangeable at the signature level. Putting
 * the kind and expiry inside the signed payload fixes both without a session table.
 * Tier 3 (how): User sessions slide: each `/api/users/me` call re-issues the token once less than
 * half its lifetime remains, so an active agent stays signed in and an idle one is signed out
 * 24 hours after their last visit (the AGENTS.md session standard). Admin sessions are fixed at
 * 8 hours and never renewed. Tokens from before this format have no kind or expiry and are
 * rejected, forcing one fresh login. Changing a password sets `User.sessionsRevokedAt`; user
 * tokens issued before it are rejected (`isSessionRevoked`), which signs out every other device.
 */

import { signToken, verifyToken } from '@/lib/security';

/** Which login a token belongs to. */
export type SessionKind = 'user' | 'admin';

/** Lifetime of a newly issued token, in seconds. */
export const SESSION_TTL_SECONDS: Record<SessionKind, number> = {
  user: 60 * 60 * 24, // 24 hours (AGENTS.md §5), renewed while the agent keeps visiting
  admin: 60 * 60 * 8, // one working day, never renewed
};

const KIND_PREFIX: Record<SessionKind, string> = { user: 'u', admin: 'a' };
const SUBJECT_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** A verified token's claims. */
export interface SessionClaims {
  /** User ID or AdminUser ID. */
  subjectId: string;
  /** Unix time (seconds) after which the token is rejected. */
  expiresAt: number;
}

/**
 * Signs a new session token.
 *
 * @param kind - `user` or `admin`.
 * @param subjectId - The user or admin ID (cuid).
 * @param nowMs - Current time, injectable for tests.
 * @returns The signed token, or '' when `subjectId` is not a plain ID.
 */
export function issueSessionToken(kind: SessionKind, subjectId: string, nowMs = Date.now()): string {
  if (!SUBJECT_PATTERN.test(subjectId)) return '';
  const expiresAt = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS[kind];
  return signToken(`${KIND_PREFIX[kind]}.${subjectId}.${expiresAt}`);
}

/**
 * Verifies a token and returns its claims.
 *
 * @param token - Cookie or bearer value.
 * @param kind - The kind the caller requires; a token of the other kind is rejected.
 * @param nowMs - Current time, injectable for tests.
 * @returns The claims, or null when the token is missing, forged, the wrong kind, legacy or expired.
 */
export function readSessionToken(token: string | null | undefined, kind: SessionKind, nowMs = Date.now()): SessionClaims | null {
  const payload = verifyToken(token);
  if (!payload) return null;
  const parts = payload.split('.');
  if (parts.length !== 3 || parts[0] !== KIND_PREFIX[kind]) return null;
  const [, subjectId, expRaw] = parts;
  if (!SUBJECT_PATTERN.test(subjectId) || !/^\d{1,12}$/.test(expRaw)) return null;
  const expiresAt = Number(expRaw);
  if (expiresAt <= Math.floor(nowMs / 1000)) return null;
  return { subjectId, expiresAt };
}

/**
 * Returns the subject ID of a valid token, or null. Shorthand for `readSessionToken(...)?.subjectId`.
 */
export function verifySessionToken(token: string | null | undefined, kind: SessionKind, nowMs = Date.now()): string | null {
  return readSessionToken(token, kind, nowMs)?.subjectId ?? null;
}

/**
 * True when a user session has used more than half its lifetime and should be re-issued.
 * Admin sessions are never renewed.
 */
export function shouldRenewSession(claims: SessionClaims, kind: SessionKind, nowMs = Date.now()): boolean {
  if (kind !== 'user') return false;
  const remaining = claims.expiresAt - Math.floor(nowMs / 1000);
  return remaining < SESSION_TTL_SECONDS.user / 2;
}

/**
 * When a user token was issued, in Unix seconds.
 *
 * User tokens are always issued (and re-issued on renewal) with a full `SESSION_TTL_SECONDS.user`
 * lifetime, so the issue time is the expiry minus that lifetime. No token format change is needed.
 */
export function sessionIssuedAt(claims: SessionClaims, kind: SessionKind): number {
  return claims.expiresAt - SESSION_TTL_SECONDS[kind];
}

/**
 * True when a user's sessions were revoked (`User.sessionsRevokedAt`, set on password change)
 * after this token was issued.
 *
 * Compared at whole-second precision, so the token re-issued in the same request that changed the
 * password stays valid while every earlier token is rejected.
 */
export function isSessionRevoked(claims: SessionClaims, revokedAt: Date | null | undefined): boolean {
  if (!revokedAt) return false;
  return sessionIssuedAt(claims, 'user') < Math.floor(revokedAt.getTime() / 1000);
}
