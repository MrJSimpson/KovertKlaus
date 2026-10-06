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
import { signToken } from '@/lib/security';

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

    // Auto-bootstrap initial Super Admin (username: santa, password: G!v!nGSp1r1t) if DB is empty
    await bootstrapInitialAdmin();

    const admin = await findAdminByIdentifier(loginId);

    if (!admin || !admin.isActive) {
      await verifyDummyPassword(password);
      return NextResponse.json({ error: 'Invalid administrative credentials or account disabled' }, { status: 401 });
    }

    const passwordMatch = await comparePassword(password, admin.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid administrative credentials' }, { status: 401 });
    }

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
      token: signToken(admin.id),
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
