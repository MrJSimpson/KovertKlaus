import { NextResponse } from 'next/server';
import {
  comparePassword,
  verifyDummyPassword,
  isLegacyBcryptHash,
  hashPassword,
} from '@/lib/password';
import { db } from '@/lib/db';
import { isValidEmail, signToken } from '@/lib/security';
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

    // Fetch User from DB
    const user = await db.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      await verifyDummyPassword(password);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Verify Password using scrypt (with legacy bcrypt fallback)
    const passwordMatch = await comparePassword(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Seamlessly upgrade legacy bcrypt hash to native scrypt format
    if (isLegacyBcryptHash(user.passwordHash)) {
      try {
        const upgradedHash = await hashPassword(password);
        await db.user.update({
          where: { id: user.id },
          data: { passwordHash: upgradedHash },
        });
      } catch (rehashErr) {
        console.error('Background password hash upgrade error:', rehashErr);
      }
    }

    // Set HTTP-Only Short-Lived Session Cookie
    await setSessionCookie(user.id);

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      token: signToken(user.id),
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
