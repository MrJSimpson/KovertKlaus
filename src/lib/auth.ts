import { cookies } from 'next/headers';
import { issueSessionToken, readSessionToken, shouldRenewSession, SESSION_TTL_SECONDS } from '@/lib/session-token';
import { IS_SAAS } from '@/lib/config/mode';

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
 * @returns The authenticated operative's `userId`, or `null` if unauthenticated, tampered, or expired.
 */
export async function getSessionUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE_NAME);
    const cookieClaims = readSessionToken(session?.value, 'user');
    if (cookieClaims) return cookieClaims.subjectId;
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
      return readSessionToken(headerToken, 'user')?.subjectId ?? null;
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

