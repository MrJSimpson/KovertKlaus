import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { sanitizeText, isValidEmail, validatePassword } from '@/lib/security';
import { setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, codename, password, action } = body as {
      name?: string;
      email: string;
      codename?: string;
      password?: string;
      action?: 'check' | 'register';
    };

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Action: User Account Registration with 10-Character Password
    if (!name || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    // Validate 10-Character Complex Password Policy
    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
      return NextResponse.json({ error: passCheck.error }, { status: 400 });
    }

    const cleanName = sanitizeText(name);
    const cleanCodename = codename
      ? sanitizeText(codename)
      : `Agent-${Math.floor(1000 + Math.random() * 9000)}`;

    // Hash Password with bcrypt salt rounds = 12
    const passwordHash = await bcrypt.hash(password, 12);

    // Create User in DB
    const user = await db.user.create({
      data: {
        email: cleanEmail,
        name: cleanName,
        codename: cleanCodename,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        codename: true,
        accountStatus: true,
        demerits: true,
      },
    });

    // Set HTTP-Only Short-Lived Session Cookie
    await setSessionCookie(user.id);

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in.' },
        { status: 400 }
      );
    }
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
