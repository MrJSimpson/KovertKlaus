import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { isValidEmail } from '@/lib/security';
import { setAdminSessionCookie, bootstrapInitialAdmin } from '@/lib/adminAuth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if initial super admin needs to be bootstrapped
    await bootstrapInitialAdmin();

    const DUMMY_HASH = '$2a$12$eImiTXuWVfxh02WpuU.2Te6/k6G4v0S0i56u.0B.y/0x3d.0x.0x';

    const admin = await db.adminUser.findUnique({
      where: { email: cleanEmail },
    });

    if (!admin || !admin.isActive) {
      await bcrypt.compare(password, DUMMY_HASH);
      return NextResponse.json({ error: 'Invalid administrative credentials or account disabled' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid administrative credentials' }, { status: 401 });
    }

    // Update last login timestamp
    await db.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Set dedicated Admin HTTP-Only Session Cookie
    await setAdminSessionCookie(admin.id);

    return NextResponse.json({
      success: true,
      message: 'North Pole Command clearance granted',
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('North Pole login error:', error);
    return NextResponse.json({ error: 'Admin authentication failed' }, { status: 500 });
  }
}
