import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { db } from '@/lib/db';
import { sanitizeText, isValidEmail, validatePassword } from '@/lib/security';
import { setSessionCookie } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';
import { RELEASE_STAGE } from '@/lib/version';
import { logInfo } from '@/lib/logger';
import { markInvitationAccepted } from '@/lib/invitations';
import { enrollWithCodename } from '@/lib/codename';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body as {
      name?: string;
      email: string;
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
    const rawInviteCode = (body as any).inviteCode || (body as any).operationCode || (body as any).exchangeCode || (body as any).code || (body as any).alphaCode;

    let targetExchange: any = null;
    let matchedPreLaunchApproval: any = null;

    if (isAlpha) {
      if (!rawInviteCode) {
        return NextResponse.json(
          {
            error:
              'Direct registration is closed during Alpha. You must be invited to a Secret Santa mission, or enter your approved Pre-Launch Alpha activation cipher.',
          },
          { status: 403 }
        );
      }

      const cleanCode = String(rawInviteCode).trim().toUpperCase();

      // 1. Check if the code matches an active PreLaunchApproval for this email address
      matchedPreLaunchApproval = await db.preLaunchApproval.findFirst({
        where: {
          email: { equals: cleanEmail, mode: 'insensitive' },
          inviteCode: cleanCode,
        },
      });

      // 2. If not a pre-launch clearance cipher, check if it is a valid Exchange invitation code
      if (!matchedPreLaunchApproval) {
        targetExchange = await db.exchange.findUnique({
          where: { code: cleanCode },
          include: { members: true },
        });

        if (!targetExchange) {
          return NextResponse.json(
            { error: 'Invalid invitation code or pre-launch alpha cipher. Please verify your activation link.' },
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
      }
    } else if (rawInviteCode) {
      const cleanCode = String(rawInviteCode).trim().toUpperCase();
      matchedPreLaunchApproval = await db.preLaunchApproval.findFirst({
        where: {
          email: { equals: cleanEmail, mode: 'insensitive' },
          inviteCode: cleanCode,
        },
      });

      if (!matchedPreLaunchApproval) {
        targetExchange = await db.exchange.findUnique({
          where: { code: cleanCode },
          include: { members: true },
        });
      }
    }

    const cleanName = sanitizeText(name);

    // Hash Password with native scrypt
    const passwordHash = await hashPassword(password);

    // Create User in DB
    const user = await db.user.create({
      data: {
        email: cleanEmail,
        name: cleanName,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        accountStatus: true,
        penaltyPoints: true,
      },
    });

    // If registered via PreLaunchApproval, immediately consume & remove the code to prevent reuse
    if (matchedPreLaunchApproval) {
      try {
        await db.preLaunchApproval.delete({
          where: { id: matchedPreLaunchApproval.id },
        });
        await logInfo('AUTH', `Operative ${user.email} successfully completed Alpha registration using PreLaunchApproval cipher ${matchedPreLaunchApproval.inviteCode}`, {
          dbClient: db,
          metadata: { userId: user.id, email: user.email, inviteCode: matchedPreLaunchApproval.inviteCode },
          path: '/api/users',
          statusCode: 201,
        }).catch(() => {});
      } catch (cleanupErr) {
        console.warn('Failed to delete used PreLaunchApproval record:', cleanupErr);
      }
    }

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

        await enrollWithCodename(db, targetExchange.id, (codename) =>
          db.exchangeMember.create({
            data: {
              exchangeId: targetExchange.id,
              userId: user.id,
              codename,
              role: 'MEMBER',
              wishlistId: userManifest.id,
            },
          })
        );
        await markInvitationAccepted(db, targetExchange.id, user.email, user.id);
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
