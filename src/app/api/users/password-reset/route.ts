/**
 * @file route.ts
 * @description `POST /api/users/password-reset`: email an agent a password reset link.
 *
 * Tier 1 (what): Takes `{ email }` and always answers 200 with the same message for known and
 * unknown addresses, 429 when a request limit is hit, or 400 for a malformed email.
 * Tier 2 (why): Self-hosted counterpart of the Worker route; both call `requestPasswordReset`.
 * Tier 3 (how): Links use `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` when set, so a forged Host header
 * cannot point a reset link at another site; the request origin is the fallback for local installs.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/adminDb';
import { logWarn } from '@/lib/logger';
import { clientIp } from '@/lib/login-throttle';
import { isDailyEmailQuotaReached, sendPasswordResetEmail } from '@/lib/email/dispatcher';
import { requestPasswordReset } from '@/lib/password-reset';
import { dbUnavailableResponse, isDbConnectionError } from '@/lib/db-errors';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown };
    const result = await requestPasswordReset(
      {
        db,
        adminDb,
        baseUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
        isQuotaReached: () => isDailyEmailQuotaReached(),
        sendEmail: (email) => sendPasswordResetEmail(email),
        onTrip: (message, metadata) => {
          logWarn('AUTH', message, { metadata }).catch(() => {});
        },
      },
      { email: body.email, ip: clientIp(request.headers) }
    );
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (err: unknown) {
    console.error('API Error in POST /api/users/password-reset:', err);
    if (isDbConnectionError(err)) return dbUnavailableResponse();
    return NextResponse.json({ error: 'Could not start the password reset. Please try again.' }, { status: 500 });
  }
}
