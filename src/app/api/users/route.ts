import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/adminDb';
import { sanitizeText, isValidEmail, validatePassword } from '@/lib/security';
import { setSessionCookie } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';
import { RELEASE_STAGE } from '@/lib/version';
import { logInfo, logWarn } from '@/lib/logger';
import { clientIp } from '@/lib/login-throttle';
import { resolveRegistrationCode } from '@/lib/registration-code';
import {
  checkRegistrationThrottle,
  recordRegistration,
  registrationThrottledParts,
  registrationThrottleKeys,
  registrationTripLogMessage,
} from '@/lib/registration-throttle';
import { markInvitationAccepted } from '@/lib/invitations';
import { enrollWithCodename } from '@/lib/codename';
import { memberWishlistCreate } from '@/lib/mission-wishlist';
import { bodyString, readJsonBody } from '@/lib/request-body';

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const name = bodyString(body.name);
    const email = bodyString(body.email);
    const password = bodyString(body.password);

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

    // Alpha gate and invite code (src/lib/registration-code.ts), then the sign-up rate limit.
    const isAlpha = RELEASE_STAGE === 'ALPHA' || RELEASE_STAGE === 'PRE_ALPHA';
    const rawInviteCode =
      bodyString(body.inviteCode) || bodyString(body.operationCode) || bodyString(body.exchangeCode) || bodyString(body.code) || bodyString(body.alphaCode);
    const resolved = await resolveRegistrationCode(db, cleanEmail, rawInviteCode, isAlpha);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { approval: matchedPreLaunchApproval, mission: targetExchange } = resolved;

    const throttleKeys = registrationThrottleKeys(cleanEmail, clientIp(request.headers), Boolean(targetExchange));
    const throttle = await checkRegistrationThrottle(adminDb, throttleKeys);
    if (throttle.blocked) {
      const parts = registrationThrottledParts(throttle.rule, throttle.retryAfterSec);
      return NextResponse.json(parts.body, { status: 429, headers: parts.headers });
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
    await recordRegistration(adminDb, throttleKeys, throttle.counts, (rule) => {
      const { message, metadata } = registrationTripLogMessage(throttleKeys, rule);
      logWarn('AUTH', message, { metadata }).catch(() => {});
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
        await enrollWithCodename(db, targetExchange.id, (codename) =>
          db.exchangeMember.create({
            data: {
              exchangeId: targetExchange.id,
              userId: user.id,
              codename,
              role: 'MEMBER',
              wishlist: memberWishlistCreate(user.id, targetExchange.isWhiteElephant),
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
  } catch (error) {
    if ((error as { code?: string } | null)?.code === 'P2002') {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in.' },
        { status: 400 }
      );
    }
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
