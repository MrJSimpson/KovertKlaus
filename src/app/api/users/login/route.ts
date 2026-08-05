import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { isValidEmail } from '@/lib/security';
import { setSessionCookie } from '@/lib/auth';

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

    // Dummy hash for constant-time comparison to prevent timing attacks
    const DUMMY_HASH = '$2a$12$eImiTXuWVfxh02WpuU.2Te6/k6G4v0S0i56u.0B.y/0x3d.0x.0x';

    // Fetch User from DB
    const user = await db.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Verify Password using bcrypt
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Set HTTP-Only Short-Lived Session Cookie
    await setSessionCookie(user.id);

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        codename: user.codename,
      },
    });
  } catch (error) {
    console.error('Login authentication error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
