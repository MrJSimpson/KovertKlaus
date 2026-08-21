import { cookies } from 'next/headers';
import { signToken, verifyToken } from '@/lib/security';

/**
 * Cookie identifier key for authenticated session persistence.
 */
const SESSION_COOKIE_NAME = 'kovertklaus_session';

/**
 * Duration in seconds before session token invalidation (24 Hours).
 */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

/**
 * Issues a cryptographically signed, HTTP-only session cookie for the authenticated operative.
 * 
 * Security Invariants:
 * - HMAC-SHA256 signature attached to prevent cookie tampering and spoofing.
 * - `httpOnly: true`: Blocks client-side DOM & XSS script access.
 * - `secure`: Automatically set in production to require TLS encryption.
 * - `sameSite: 'lax'`: Provides CSRF protection for cross-site navigation while preserving seamless direct link joins.
 * 
 * @param userId - Unique database identifier of the authenticated user
 */
export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const signedToken = signToken(userId);
  cookieStore.set(SESSION_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Reads and cryptographically verifies the current active user ID from the incoming session cookie.
 * 
 * @returns The authenticated operative's `userId`, or `null` if unauthenticated, tampered, or expired.
 */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  return verifyToken(session?.value);
}

/**
 * Destroys the active session by removing the HTTP-only authentication cookie.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

