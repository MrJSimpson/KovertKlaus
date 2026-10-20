/**
 * @file route.ts
 * @description `/api/notifications`: the caller's in-app notifications (self-hosted edition).
 *
 * Tier 1 (what): GET lists the caller's open notifications with a link each. PATCH removes some
 * (`{ ids }`) or all (`{ all: true }`) of them.
 * Tier 2 (why): The edge worker serves the same path in SaaS; both delegate to
 * `@/lib/notifications` so the rules live in one place.
 * Tier 3 (how): Removing marks rows acknowledged for the signed-in agent only.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { dismissNotifications, listMyNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/** Lists the caller's open notifications. */
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const result = await listMyNotifications(db, userId);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[Notifications] list failed:', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}

/** Removes notifications: `{ ids }` or `{ all: true }`. */
export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown; all?: unknown };
    const result = await dismissNotifications(db, { userId, ids: body.ids, all: body.all });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[Notifications] remove failed:', error);
    return NextResponse.json({ error: 'Failed to remove notifications' }, { status: 500 });
  }
}
