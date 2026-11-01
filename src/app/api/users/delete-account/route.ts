/**
 * @file route.ts
 * @description `GET|POST /api/users/delete-account`: preview and perform self-service account deletion.
 *
 * Tier 1 (what): GET returns what blocks the deletion and what goes with it (`deletionPreview`).
 * POST takes `{ password, confirm: "DELETE" }` and deletes the account (200), or answers 400 (wrong
 * input or password), 409 (blocked, with the missions to close first), 429 (too many wrong passwords).
 * Tier 2 (why): Self-hosted counterpart of the Worker route; both call `src/lib/account-deletion.ts`.
 * An agent who has not verified their email may delete too (a mistyped address is a good reason to).
 * Tier 3 (how): The session cookie is cleared after a successful delete; the account no longer
 * exists, so any other device's session stops working on its next request.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/adminDb';
import { clearSessionCookie, getSessionUserId } from '@/lib/auth';
import { deleteAccount, deletionPreview } from '@/lib/account-deletion';
import { logInfo } from '@/lib/logger';
import { readJsonBody } from '@/lib/request-body';
import { dbUnavailableResponse, isDbConnectionError } from '@/lib/db-errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getSessionUserId({ allowUnverified: true });
    if (!userId) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    return NextResponse.json({ success: true, ...(await deletionPreview(db, userId)) });
  } catch (err: unknown) {
    console.error('API Error in GET /api/users/delete-account:', err);
    if (isDbConnectionError(err)) return dbUnavailableResponse();
    return NextResponse.json({ error: 'Could not check your account. Please try again.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId({ allowUnverified: true });
    if (!userId) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const body = await readJsonBody(request);
    const result = await deleteAccount(
      {
        db,
        adminDb,
        onDeleted: (message, metadata) => {
          logInfo('AUTH', message, { metadata }).catch(() => {});
        },
      },
      userId,
      { password: body.password, confirm: body.confirm }
    );
    if (result.status === 200) await clearSessionCookie();
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (err: unknown) {
    console.error('API Error in POST /api/users/delete-account:', err);
    if (isDbConnectionError(err)) return dbUnavailableResponse();
    return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 });
  }
}
