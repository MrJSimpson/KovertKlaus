/**
 * @file route.ts
 * @description `POST /api/users/verify-email/confirm`: mark an agent's email verified from the emailed link.
 *
 * Tier 1 (what): Takes `{ token }`. Answers 200 (verified, or already verified) or 400 for a link
 * that is forged, expired or for an address the account no longer uses.
 * Tier 2 (why): Self-hosted counterpart of the Worker route; both call `confirmEmailVerification`.
 * Tier 3 (how): No session needed: the signed token is the proof, so the link also works in a
 * browser where the agent is not signed in. The welcome email goes out once, on first verification.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendWelcomeEmail } from '@/lib/email/dispatcher';
import { confirmEmailVerification } from '@/lib/email-verification';
import { readJsonBody } from '@/lib/request-body';
import { dbUnavailableResponse, isDbConnectionError } from '@/lib/db-errors';

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const result = await confirmEmailVerification(
      { db, sendWelcome: (user) => sendWelcomeEmail({ to: user.email, name: user.name }) },
      { token: body.token }
    );
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (err: unknown) {
    console.error('API Error in POST /api/users/verify-email/confirm:', err);
    if (isDbConnectionError(err)) return dbUnavailableResponse();
    return NextResponse.json({ error: 'Could not verify your email. Please try again.' }, { status: 500 });
  }
}
