import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { adminDb } from '@/lib/adminDb';
import { IS_SAAS } from '@/lib/config/mode';
import { signToken, verifyToken } from '@/lib/security';

const ADMIN_SESSION_COOKIE_NAME = 'kovertklaus_admin_session';

export const DEFAULT_ADMIN_USERNAME = 'santa';
export const DEFAULT_ADMIN_EMAIL = 'admin@kovertklaus.com';
export const DEFAULT_INITIAL_PASSWORD = '1sEcReTdEl!vErY';

/**
 * Validates a password against NIST SP 800-63B Digital Identity Guidelines:
 * 1. Minimum length: 12 characters (supports passphrases).
 * 2. Maximum length: 128 characters (no arbitrary truncation).
 * 3. Disallows easily guessable, common, or default bootstrap passwords.
 * 4. Disallows passwords containing the admin's username or email prefix.
 * 5. Permissive character set: allows all printable ASCII, Unicode, spaces, and punctuation.
 */
export function validateNistPassword(
  password: string,
  identifier?: string
): { isValid: boolean; error?: string } {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 12) {
    return {
      isValid: false,
      error: 'NIST SP 800-63B standard requires a minimum of 12 characters for administrative passphrases.',
    };
  }

  if (password.length > 128) {
    return {
      isValid: false,
      error: 'Password exceeds maximum length limit of 128 characters.',
    };
  }

  // Check against prohibited default / trivial passwords
  const prohibitedList = [
    DEFAULT_INITIAL_PASSWORD.toLowerCase(),
    '1secret delivery',
    'password1234',
    'admin12345678',
    'santaclaus123',
    'northpoleadmin',
    'kovertklaus123',
  ];

  const lowerPass = password.toLowerCase();
  if (prohibitedList.includes(lowerPass) || lowerPass === DEFAULT_INITIAL_PASSWORD.toLowerCase()) {
    return {
      isValid: false,
      error: 'Password cannot be a default installation password or known common phrase.',
    };
  }

  if (identifier) {
    const cleanId = identifier.trim().toLowerCase().split('@')[0];
    if (cleanId.length >= 3 && lowerPass.includes(cleanId)) {
      return {
        isValid: false,
        error: 'Password cannot contain your administrative username or email address.',
      };
    }
  }

  return { isValid: true };
}

/**
 * Sets a short-lived, HTTP-only, cryptographically signed admin session cookie.
 * Expiration: 12 hours (43,200 seconds).
 */
export async function setAdminSessionCookie(adminId: string) {
  const cookieStore = await cookies();
  const signedToken = signToken(adminId);
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours
  });
}

/**
 * Retrieves and cryptographically verifies the current admin session ID from the HTTP-only cookie.
 */
export async function getAdminSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE_NAME);
  return verifyToken(session?.value);
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
    const admin = await adminDb.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        requiresPasswordReset: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!admin || !admin.isActive || admin.requiresPasswordReset) return null;
    return admin;
  } catch (error) {
    console.error('Error verifying admin session:', error);
    return null;
  }
}

/**
 * Finds an administrator by either username or email address.
 */
export async function findAdminByIdentifier(identifier: string) {
  const cleanId = identifier.trim().toLowerCase();
  return adminDb.adminUser.findFirst({
    where: {
      OR: [
        { username: { equals: cleanId, mode: 'insensitive' } },
        { email: { equals: cleanId, mode: 'insensitive' } },
      ],
    },
  });
}

/**
 * Bootstraps an initial Super Admin if the AdminUser table is completely empty.
 * Default admin username: 'santa', initial password: '1sEcReTdEl!vErY', requiresPasswordReset: true.
 */
export async function bootstrapInitialAdmin() {
  try {
    const adminCount = await adminDb.adminUser.count();
    if (adminCount === 0) {
      const username = (process.env.INITIAL_ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim().toLowerCase();
      const email = (process.env.INITIAL_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
      const password = process.env.INITIAL_ADMIN_PASSWORD || DEFAULT_INITIAL_PASSWORD;
      const passwordHash = await bcrypt.hash(password, 12);

      const admin = await adminDb.adminUser.create({
        data: {
          username,
          email,
          name: 'Santa Claus',
          passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
          requiresPasswordReset: true, // Mandatory reset on first login
        },
      });

      console.log(`[NorthPole Bootstrap] Initial Admin created: username='${username}', email='${email}', requiresPasswordReset=true`);
      return admin;
    }
  } catch (error) {
    console.error('[NorthPole Bootstrap] Error bootstrapping initial admin:', error);
  }
  return null;
}
