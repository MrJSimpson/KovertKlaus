/**
 * @file route.ts
 * @description `POST /api/users/password-reset/confirm`: set a new password from a reset link.
 *
 * Tier 1 (what): Takes `{ token, password }`; answers 200 when the password changed, or 400 for a
 * bad, expired or used link or a password that fails the complexity rules.
 * Tier 2 (why): Self-hosted counterpart of the Worker route; both call `confirmPasswordReset`.
 * Tier 3 (how): The change sets `sessionsRevokedAt`, so every existing session ends. The agent then
 * signs in with the new password; no session is issued here.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { confirmPasswordReset } from '@/lib/password-reset';
import { dbUnavailableResponse, isDbConnectionError } from '@/lib/db-errors';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: unknown; password?: unknown };
    const result = await confirmPasswordReset(db, { token: body.token, password: body.password });
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (err: unknown) {
    console.error('API Error in POST /api/users/password-reset/confirm:', err);
    if (isDbConnectionError(err)) return dbUnavailableResponse();
    return NextResponse.json({ error: 'Could not change the password. Please try again.' }, { status: 500 });
  }
}
