import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminDb } from '@/lib/adminDb';
import {
  setAdminSessionCookie,
  bootstrapInitialAdmin,
  findAdminByIdentifier,
} from '@/lib/adminAuth';

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

    // Auto-bootstrap initial Super Admin (username: santa, password: 1sEcReTdEl!vErY) if DB is empty
    await bootstrapInitialAdmin();

    const DUMMY_HASH = '$2a$12$eImiTXuWVfxh02WpuU.2Te6/k6G4v0S0i56u.0B.y/0x3d.0x.0x';

    const admin = await findAdminByIdentifier(loginId);

    if (!admin || !admin.isActive) {
      await bcrypt.compare(password, DUMMY_HASH);
      return NextResponse.json({ error: 'Invalid administrative credentials or account disabled' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
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

    // Normal Login: Update last login timestamp & set session cookie
    await adminDb.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await setAdminSessionCookie(admin.id);

    return NextResponse.json({
      success: true,
      requiresPasswordReset: false,
      message: 'North Pole Command clearance granted',
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
