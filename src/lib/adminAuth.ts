import { cookies } from 'next/headers';
import { hashPassword } from '@/lib/password';
import { adminDb } from '@/lib/adminDb';
import { IS_SAAS } from '@/lib/config/mode';
import { signToken, verifyToken } from '@/lib/security';
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_USERNAME } from '@/lib/constants/adminDefaults';

export const ADMIN_SESSION_COOKIE_NAME = IS_SAAS ? 'kovert_saas_admin_session' : 'kovertklaus_admin_session';

export { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_USERNAME };

/**
 * Passwords that shipped as installation defaults in earlier releases. They are permanently
 * banned so an upgraded or restored installation can never be left on a published credential.
 * No default password ships any more: see `src/lib/adminSetup.ts`.
 */
const RETIRED_DEFAULT_PASSWORDS = ['g!v!ngsp1r1t', '1secretdel!very'];

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
    ...RETIRED_DEFAULT_PASSWORDS,
    'giv1ngsp1r1t',
    'giving spirit',
    'password1234',
    'admin12345678',
    'santaclaus123',
    'northpoleadmin',
    'kovertklaus123',
  ];

  const lowerPass = password.toLowerCase();
  if (prohibitedList.includes(lowerPass)) {
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
  const isSecure =
    process.env.COOKIE_SECURE === 'true' ||
    (process.env.NODE_ENV === 'production' &&
      process.env.COOKIE_SECURE !== 'false' &&
      process.env.NEXT_PUBLIC_APP_URL?.startsWith('https'));

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours
  });
}

/**
 * Retrieves and cryptographically verifies the current admin session ID from the HTTP-only cookie
 * or fallback x-admin-token authorization header.
 */
export async function getAdminSessionId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get(ADMIN_SESSION_COOKIE_NAME);
    const cookieVerified = verifyToken(session?.value);
    if (cookieVerified) return cookieVerified;
  } catch {
    // Ignore cookie resolution errors during static prerendering
  }

  try {
    const { headers } = await import('next/headers');
    const headerStore = await headers();
    const headerToken =
      headerStore.get('x-admin-token') ||
      headerStore.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (headerToken) {
      return verifyToken(headerToken);
    }
  } catch {
    // Ignore header resolution errors
  }

  return null;
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
 * Reports whether at least one administrator account exists.
 */
export async function adminExists(): Promise<boolean> {
  return (await adminDb.adminUser.count()) > 0;
}

/** Outcome of an automatic bootstrap attempt. */
export type BootstrapResult = 'exists' | 'created-from-env' | 'setup-required';

/**
 * Ensures an administrator exists, using only operator-supplied configuration.
 *
 * Tier 1: If no admin exists and `INITIAL_ADMIN_PASSWORD` is set (SaaS: a Cloudflare secret),
 * creates the admin from `INITIAL_ADMIN_*` with `requiresPasswordReset: true`. Otherwise it
 * creates nothing and reports `setup-required`.
 * Tier 2: No password is ever hard-coded. Self-hosted operators create the first admin
 * through the one-time console token flow (`src/lib/adminSetup.ts`).
 * Tier 3: Safe to call on every login attempt; it is a no-op once an admin exists.
 */
export async function bootstrapInitialAdmin(): Promise<BootstrapResult> {
  if (await adminExists()) return 'exists';

  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!password) return 'setup-required';

  const username = (process.env.INITIAL_ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim().toLowerCase();
  const email = (process.env.INITIAL_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  await adminDb.adminUser.create({
    data: {
      username,
      email,
      name: 'Santa Claus',
      passwordHash: await hashPassword(password),
      role: 'SUPER_ADMIN',
      isActive: true,
      requiresPasswordReset: true, // Mandatory reset on first login
    },
  });
  console.log(`[NorthPole Bootstrap] Initial Admin created from INITIAL_ADMIN_* configuration: username='${username}', requiresPasswordReset=true`);
  return 'created-from-env';
}

/** Input for creating the first administrator through first-run setup. */
export interface FirstAdminInput {
  username: string;
  email: string;
  name: string;
  password: string;
}

/**
 * Creates the first administrator during first-run setup.
 *
 * Tier 1: Validates identity fields and the NIST passphrase policy, then creates a
 * SUPER_ADMIN whose password the operator chose (no forced reset).
 * Tier 2: Re-checks inside a transaction that no admin exists, so setup cannot be replayed
 * to add a second super admin after the first one is created.
 * Tier 3: Returns `{ error }` for validation failures; throws only on database errors.
 */
export async function createFirstAdmin(input: FirstAdminInput): Promise<{ admin?: { id: string; name: string; email: string; username: string | null; role: string }; error?: string }> {
  const username = input.username?.trim().toLowerCase();
  const email = input.email?.trim().toLowerCase();
  const name = input.name?.trim();

  if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) {
    return { error: 'Username must be 3-32 characters: letters, numbers, dot, dash or underscore.' };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { error: 'A valid email address is required.' };
  }
  if (!name || name.length > 80) {
    return { error: 'Display name is required (max 80 characters).' };
  }
  const nist = validateNistPassword(input.password, username);
  if (!nist.isValid) return { error: nist.error };

  const passwordHash = await hashPassword(input.password);
  const admin = await adminDb.$transaction(async (tx) => {
    if ((await tx.adminUser.count()) > 0) return null;
    return tx.adminUser.create({
      data: { username, email, name, passwordHash, role: 'SUPER_ADMIN', isActive: true, requiresPasswordReset: false, lastLoginAt: new Date() },
      select: { id: true, name: true, email: true, username: true, role: true },
    });
  });

  if (!admin) return { error: 'An administrator already exists. First-run setup is closed.' };
  return { admin };
}
