import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanCodename = codename?.trim() || `Agent-${Math.floor(1000 + Math.random() * 9000)}`;

    // Upsert User by Email
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
        passwordHash: 'PASSTHROUGH_ANONYMOUS_SESSION', // Simplified session auth
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
    console.error('User creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create or update user account' },
      { status: 500 }
    );
  }
}
