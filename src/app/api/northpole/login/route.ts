import { NextResponse } from 'next/server';
import {
  comparePassword,
  verifyDummyPassword,
  isLegacyBcryptHash,
  hashPassword,
} from '@/lib/password';
import { adminDb } from '@/lib/adminDb';
import {
  setAdminSessionCookie,
  bootstrapInitialAdmin,
  findAdminByIdentifier,
} from '@/lib/adminAuth';
import { issueSessionToken } from '@/lib/session-token';
import { announceSetupToken } from '@/lib/adminSetup';
import { logWarn } from '@/lib/logger';
import { checkLoginThrottle, clearLoginFailures, clientIp, loginThrottleKeys, recordLoginFailure, throttledResponseParts, tripLogMessage } from '@/lib/login-throttle';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, email, username, password } = body as {
      identifier?: string;
      email?: string;
      username?: string;
      password?: string;
    };

    const loginId = (identifier || username || email || '').trim();

    if (!loginId || !password) {
      return NextResponse.json({ error: 'Username/email and password are required' }, { status: 400 });
    }

    // Apply INITIAL_ADMIN_* configuration if present; otherwise first-run setup is required.
    if ((await bootstrapInitialAdmin()) === 'setup-required') {
      announceSetupToken();
      await verifyDummyPassword(password);
      return NextResponse.json(
        { error: 'No administrator exists yet. Complete first-run setup at /northpole/setup.', setupRequired: true },
        { status: 409 }
      );
    }

    // Sign-in rate limit (src/lib/login-throttle.ts): checked before any password work.
    const throttleKeys = loginThrottleKeys('ADMIN', loginId, clientIp(request.headers));
    const throttle = await checkLoginThrottle(adminDb, throttleKeys);
    if (throttle.blocked) {
      const parts = throttledResponseParts(throttle.retryAfterSec);
      return NextResponse.json(parts.body, { status: 429, headers: parts.headers });
    }
    const recordFailure = () =>
      recordLoginFailure(adminDb, throttleKeys, throttle.counts, (rule) => {
        const { message, metadata } = tripLogMessage(throttleKeys, rule);
        logWarn('AUTH', message, { metadata }).catch(() => {});
      });

    const admin = await findAdminByIdentifier(loginId);

    if (!admin || !admin.isActive) {
      await verifyDummyPassword(password);
      await recordFailure();
      return NextResponse.json({ error: 'Invalid administrative credentials or account disabled' }, { status: 401 });
    }

    const passwordMatch = await comparePassword(password, admin.passwordHash);
    if (!passwordMatch) {
      await recordFailure();
      return NextResponse.json({ error: 'Invalid administrative credentials' }, { status: 401 });
    }
    await clearLoginFailures(adminDb, throttleKeys);

    // Mandatory First-Login Password Reset Flow (NIST SP 800-63B)
    if (admin.requiresPasswordReset) {
      return NextResponse.json({
        success: true,
        requiresPasswordReset: true,
        adminId: admin.id,
        identifier: admin.username || admin.email,
        name: admin.name,
        message: 'Initial installation login detected. NIST SP 800-63B mandatory password reset required before clearance activation.',
      });
    }

    // Normal Login: Update last login timestamp & set session cookie (and upgrade legacy hash if needed)
    const updateData: { lastLoginAt: Date; passwordHash?: string } = { lastLoginAt: new Date() };
    if (isLegacyBcryptHash(admin.passwordHash)) {
      updateData.passwordHash = await hashPassword(password);
    }
    await adminDb.adminUser.update({
      where: { id: admin.id },
      data: updateData,
    });

    await setAdminSessionCookie(admin.id);

    return NextResponse.json({
      success: true,
      requiresPasswordReset: false,
      message: 'North Pole Command clearance granted',
      token: issueSessionToken('admin', admin.id),
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('North Pole login error:', error);
    return NextResponse.json({ error: 'Admin authentication failed' }, { status: 500 });
  }
}
