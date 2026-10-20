/**
 * @file route.ts
 * @description `/api/codename`: reroll or accept the caller's mission codename (self-hosted edition).
 *
 * Tier 1 (what): POST `{ exchangeId, action: 'reroll' | 'accept' }` returns `{ codename, accepted }`.
 * Tier 2 (why): Codenames are assigned per mission at join. Agents may reroll until they accept;
 * the edge worker serves the same path in SaaS, and both delegate to `@/lib/codename`.
 * Tier 3 (how): Reroll is refused once accepted or once recruiting closes (409).
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { acceptCodename, rerollCodename } from '@/lib/codename';

export const dynamic = 'force-dynamic';

/** Rerolls or accepts the caller's codename in one mission. */
export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { exchangeId?: unknown; action?: unknown };
    if (typeof body.exchangeId !== 'string' || !body.exchangeId) {
      return NextResponse.json({ error: 'exchangeId is required' }, { status: 400 });
    }
    if (body.action !== 'reroll' && body.action !== 'accept') {
      return NextResponse.json({ error: "action must be 'reroll' or 'accept'" }, { status: 400 });
    }
    const result = body.action === 'reroll'
      ? await rerollCodename(db, body.exchangeId, userId)
      : await acceptCodename(db, body.exchangeId, userId);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[Codename] update failed:', error);
    return NextResponse.json({ error: 'Failed to update codename' }, { status: 500 });
  }
}
