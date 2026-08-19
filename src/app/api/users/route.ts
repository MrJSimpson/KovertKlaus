import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { sanitizeText, isValidEmail, validatePassword } from '@/lib/security';
import { setSessionCookie } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, codename, password } = body as {
      name?: string;
      email: string;
      codename?: string;
      password?: string;
    };

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!name || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    // Validate 10-Character Complex Password Policy
    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
      return NextResponse.json({ error: passCheck.error }, { status: 400 });
    }

    const cleanName = sanitizeText(name);
    const cleanCodename = codename ? sanitizeText(codename) : undefined;

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
        penaltyPoints: true,
      },
    });

    // Set HTTP-Only Short-Lived Session Cookie
    await setSessionCookie(user.id);

    // Dispatch Welcome Email via Cloudflare Email Engine
    await sendWelcomeEmail({
      to: user.email,
      name: user.name,
      codename: user.codename || undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        demerits: user.penaltyPoints,
      },
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
