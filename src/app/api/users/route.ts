import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { sanitizeText, isValidEmail, validatePassword } from '@/lib/security';
import { setSessionCookie } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';
import { RELEASE_STAGE } from '@/lib/version';

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

    // -------------------------------------------------------------------------
    // Alpha Gate: Closed Friend-of-a-Friend Secret Santa Invitation Invariant
    // -------------------------------------------------------------------------
    const isAlpha = RELEASE_STAGE === 'ALPHA' || RELEASE_STAGE === 'PRE_ALPHA';
    const rawInviteCode = (body as any).inviteCode || (body as any).operationCode || (body as any).exchangeCode;

    let targetExchange: any = null;
    if (isAlpha) {
      if (!rawInviteCode) {
        return NextResponse.json(
          {
            error:
              'Direct registration is closed during Alpha. You must be invited to a Secret Santa mission, or request early clearance on the home page.',
          },
          { status: 403 }
        );
      }

      targetExchange = await db.exchange.findUnique({
        where: { code: String(rawInviteCode).trim().toUpperCase() },
        include: { members: true },
      });

      if (!targetExchange) {
        return NextResponse.json(
          { error: 'Invalid mission invite code. Please verify your invitation link.' },
          { status: 404 }
        );
      }

      if (targetExchange.status !== 'RECRUITING') {
        return NextResponse.json(
          { error: 'Recruitment for this mission has closed. Operatives cannot join active or completed missions.' },
          { status: 400 }
        );
      }

      if (targetExchange.maxParticipants && targetExchange.members.length >= targetExchange.maxParticipants) {
        return NextResponse.json(
          { error: 'This exchange has reached its maximum operative capacity.' },
          { status: 400 }
        );
      }
    } else if (rawInviteCode) {
      // In Beta/GA, if an invite code was provided, look it up for auto-enrollment
      targetExchange = await db.exchange.findUnique({
        where: { code: String(rawInviteCode).trim().toUpperCase() },
        include: { members: true },
      });
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

    // If joining via an exchange invite, automatically enroll the new operative
    if (targetExchange) {
      try {
        const targetType = targetExchange.isWhiteElephant ? 'WHITE_ELEPHANT' : 'STANDARD';
        const userManifest = await db.wishlist.create({
          data: {
            userId: user.id,
            name: targetExchange.isWhiteElephant ? 'White Elephant Gift' : 'Master Wishlist Manifest',
            type: targetType,
          },
        });

        await db.exchangeMember.create({
          data: {
            exchangeId: targetExchange.id,
            userId: user.id,
            codename: user.codename,
            role: 'MEMBER',
            wishlistId: userManifest.id,
          },
        });
      } catch (enrollErr) {
        console.warn('[Auto-Enroll Warning]', enrollErr);
      }
    }

    // Set HTTP-Only Short-Lived Session Cookie
    await setSessionCookie(user.id);

    // Dispatch Welcome Email via Cloudflare Email Engine
    try {
      await sendWelcomeEmail({
        to: user.email,
        name: user.name,
        codename: user.codename || undefined,
      });
    } catch (emailErr) {
      console.warn('[Welcome Email Non-Fatal]', emailErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        demerits: user.penaltyPoints,
        enrolledExchange: targetExchange ? { id: targetExchange.id, code: targetExchange.code, title: targetExchange.title } : null,
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
