import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sanitizeText, isValidEmail } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, codename } = body as {
      name: string;
      email: string;
      codename?: string;
    };

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Strict Email Validation
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    // Input Sanitization (XSS Prevention)
    const cleanName = sanitizeText(name);
    const cleanEmail = email.trim().toLowerCase();
    const cleanCodename = codename
      ? sanitizeText(codename)
      : `Agent-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Upsert User by Email (SQL Injection safe via Prisma)
    const user = await db.user.upsert({
      where: { email: cleanEmail },
      update: {
        name: cleanName,
        codename: cleanCodename,
      },
      create: {
        email: cleanEmail,
        name: cleanName,
        codename: cleanCodename,
        passwordHash: 'PASSTHROUGH_ANONYMOUS_SESSION',
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

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('User creation security error:', error);
    return NextResponse.json(
      { error: 'Failed to create or update user account' },
      { status: 500 }
    );
  }
}
