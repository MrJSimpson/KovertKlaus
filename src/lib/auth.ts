import { cookies } from 'next/headers';
import { isSessionRevoked, issueSessionToken, readSessionToken, shouldRenewSession, SESSION_TTL_SECONDS, type SessionClaims } from '@/lib/session-token';
import { db } from '@/lib/db';
import { IS_SAAS } from '@/lib/config/mode';
import { isUnverified, isVerificationRequired } from '@/lib/email-verification';

/**
 * Cookie identifier key for authenticated session persistence.
 * Namespace-isolated between Self-Hosted and SaaS multi-tenant environments.
 */
export const SESSION_COOKIE_NAME = IS_SAAS ? 'kovert_saas_session' : 'kovertklaus_session';

/**
 * Issues a cryptographically signed, HTTP-only session cookie for the authenticated operative.
 * 
 * Security Invariants:
 * - HMAC-SHA256 signed token carrying the session kind and expiry (`@/lib/session-token`).
 * - `httpOnly: true`: Blocks client-side DOM & XSS script access.
 * - `secure`: Automatically set in production to require TLS encryption.
 * - `sameSite: 'lax'`: Provides CSRF protection for cross-site navigation while preserving seamless direct link joins.
 * 
 * @param userId - Unique database identifier of the authenticated user
 */
export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const signedToken = issueSessionToken('user', userId);
  const isSecure =
    process.env.COOKIE_SECURE === 'true' ||
    (process.env.NODE_ENV === 'production' &&
      process.env.COOKIE_SECURE !== 'false' &&
      process.env.NEXT_PUBLIC_APP_URL?.startsWith('https'));

  cookieStore.set(SESSION_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS.user,
  });
}

/**
 * Reads and cryptographically verifies the current active user ID from the incoming session cookie
 * or fallback x-session-token authorization header.
 *
 * A token issued before the user's last password change (`User.sessionsRevokedAt`) is rejected.
 * An agent who has not verified their email reads as signed out too, unless the caller passes
 * `allowUnverified` (only `/api/users/me` and the verify-email routes do; see
 * `src/lib/email-verification.ts`). Verification is only required when a real email provider is set up.
 *
 * @param options.allowUnverified - Return the ID even if the agent's email is not verified yet.
 * @returns The authenticated operative's `userId`, or `null` if unauthenticated, tampered, expired, revoked or unverified.
 */
export async function getSessionUserId(options: { allowUnverified?: boolean } = {}): Promise<string | null> {
  const session = await getSessionUserState();
  if (!session) return null;
  if (session.unverified && !options.allowUnverified) return null;
  return session.userId;
}

/**
 * The signed-in agent and whether they still have to verify their email, or `null` when signed out.
 * The email provider is only looked up for an unverified agent, so verified agents pay nothing extra.
 */
export async function getSessionUserState(): Promise<{ userId: string; unverified: boolean } | null> {
  const claims = await readRequestUserClaims();
  if (!claims) return null;
  const user = await db.user.findUnique({
    where: { id: claims.subjectId },
    select: { sessionsRevokedAt: true, emailVerifiedAt: true, isWorkshop: true },
  });
  if (!user || isSessionRevoked(claims, user.sessionsRevokedAt)) return null;
  if (!isUnverified(user)) return { userId: claims.subjectId, unverified: false };
  return { userId: claims.subjectId, unverified: await emailVerificationRequired() };
}

/** True when this install can deliver email, so unverified agents are gated (self-hosted runtime). */
export async function emailVerificationRequired(): Promise<boolean> {
  try {
    // Imported lazily: the email module loads system settings, which auth.ts must not pull in eagerly.
    const { getResolvedEmailConfig } = await import('@/lib/email/config');
    return isVerificationRequired((await getResolvedEmailConfig()).provider);
  } catch (err) {
    // Fail closed only when we know email works; an unreadable config is treated as "no email".
    console.warn('[Auth] could not resolve the email provider; not requiring verification:', err);
    return false;
  }
}

/** Verified user-token claims from the session cookie, or else the x-session-token / Bearer header. */
async function readRequestUserClaims(): Promise<SessionClaims | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE_NAME);
    const cookieClaims = readSessionToken(session?.value, 'user');
    if (cookieClaims) return cookieClaims;
  } catch {
    // Ignore cookie resolution errors during static prerendering
  }

  try {
    const { headers } = await import('next/headers');
    const headerStore = await headers();
    const headerToken =
      headerStore.get('x-session-token') ||
      headerStore.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (headerToken) {
      return readSessionToken(headerToken, 'user');
    }
  } catch {
    // Ignore header resolution errors
  }

  return null;
}

/**
 * Re-issues the session cookie when the current one has used more than half its lifetime.
 *
 * Called from `/api/users/me` (loaded on every page) so an active agent is never signed out
 * mid-season, while an idle session still lapses 24 hours after the last visit.
 */
export async function renewSessionCookieIfStale(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const claims = readSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value, 'user');
    if (claims && shouldRenewSession(claims, 'user')) {
      await setSessionCookie(claims.subjectId);
    }
  } catch {
    // Cookies are read-only outside route handlers; renewal is best-effort.
  }
}

/**
 * Destroys the active session by removing the HTTP-only authentication cookie.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

