/**
 * @file route.ts
 * @description `/api/wishlist`: the caller's Wishlist Manifest for one Holiday Mission (self-hosted edition).
 *
 * Tier 1 (what): GET `?exchangeId=` returns `{ wishlist, rules }`; POST adds an item, PATCH edits
 * one (`itemId`), DELETE `?exchangeId=&itemId=` removes one.
 * Tier 2 (why): Lists belong to a mission membership, not the account. The edge worker serves the
 * same path in SaaS, and both delegate to `handleWishlistRequest` in `@/lib/mission-wishlist`.
 * Tier 3 (how): Every write checks the mission's price rules: a price is required, no item may
 * exceed `budgetMax`, and the total (price × quantity) may not exceed it unless the Head Elf allows
 * it. The item count and quantity limits are platform settings, read from `SystemConfig`.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/adminDb';
import { getSessionUserId } from '@/lib/auth';
import { handleWishlistRequest } from '@/lib/mission-wishlist';
import { getPlatformSettings } from '@/lib/platform-limits';

export const dynamic = 'force-dynamic';

/** Shared handler for every method this route serves. */
async function handle(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const result = await handleWishlistRequest(db, userId, request.method, new URL(request.url).searchParams,
      () => request.json().catch(() => ({})), await getPlatformSettings(adminDb));
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[Wishlist] request failed:', error);
    return NextResponse.json({ error: 'Failed to update your wishlist' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
