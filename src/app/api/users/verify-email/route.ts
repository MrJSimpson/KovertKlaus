/**
 * @file route.ts
 * @description `POST /api/users/verify-email`: email the signed-in agent another verification link.
 *
 * Tier 1 (what): Signed-in agents only (unverified allowed, that is the point). Answers 200 with a
 * message, 200 `alreadyVerified` when there is nothing to do, 429 when a resend limit is hit, or 401.
 * Tier 2 (why): Self-hosted counterpart of the Worker route; both call `requestVerificationResend`.
 * Tier 3 (how): Links use `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` when set, so a forged Host header
 * cannot point a link at another site; the request origin is the fallback for local installs.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/adminDb';
import { getSessionUserId } from '@/lib/auth';
import { isDailyEmailQuotaReached, sendEmailVerificationEmail } from '@/lib/email/dispatcher';
import { requestVerificationResend } from '@/lib/email-verification';
import { dbUnavailableResponse, isDbConnectionError } from '@/lib/db-errors';

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId({ allowUnverified: true });
    if (!userId) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const result = await requestVerificationResend(
      {
        db,
        adminDb,
        baseUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
        isQuotaReached: () => isDailyEmailQuotaReached(),
        sendEmail: (email) => sendEmailVerificationEmail(email),
      },
      userId
    );
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (err: unknown) {
    console.error('API Error in POST /api/users/verify-email:', err);
    if (isDbConnectionError(err)) return dbUnavailableResponse();
    return NextResponse.json({ error: 'Could not send the verification email. Please try again.' }, { status: 500 });
  }
}
