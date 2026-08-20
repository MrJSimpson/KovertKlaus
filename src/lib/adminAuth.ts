import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const ADMIN_SESSION_COOKIE_NAME = 'kovertklaus_admin_session';

/**
 * Sets a short-lived, HTTP-only, secure admin session cookie.
 * Expiration: 12 hours (43,200 seconds).
 */
export async function setAdminSessionCookie(adminId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, adminId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours
  });
}

/**
 * Retrieves the current admin session ID from the HTTP-only cookie.
 */
export async function getAdminSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE_NAME);
  return session?.value || null;
}

/**
 * Clears the admin session cookie.
 */
export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);
}

/**
 * Verifies if the current request has a valid, active AdminUser session.
 */
export async function verifyAdminSession() {
  const adminId = await getAdminSessionId();
  if (!adminId) return null;

  try {
    const admin = await db.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!admin || !admin.isActive) return null;
    return admin;
  } catch (error) {
    console.error('Error verifying admin session:', error);
    return null;
  }
}

/**
 * Bootstraps an initial Super Admin if the AdminUser table is completely empty.
 * Uses environment variable INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD or secure defaults.
 */
export async function bootstrapInitialAdmin() {
  try {
    const adminCount = await db.adminUser.count();
    if (adminCount === 0) {
      const email = (process.env.INITIAL_ADMIN_EMAIL || 'admin@kovertklaus.com').trim().toLowerCase();
      const password = process.env.INITIAL_ADMIN_PASSWORD || 'AdminPassword123!';
      const passwordHash = await bcrypt.hash(password, 12);

      const admin = await db.adminUser.create({
        data: {
          email,
          name: 'North Pole HQ Administrator',
          passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });

      console.log(`[NorthPole Bootstrap] Initial Super Admin created: ${email}`);
      return admin;
    }
  } catch (error) {
    console.error('[NorthPole Bootstrap] Error bootstrapping initial admin:', error);
  }
  return null;
}
