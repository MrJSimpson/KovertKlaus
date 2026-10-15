/**
 * @file route.ts
 * @description `/api/messages`: anonymous Intel messaging (self-hosted edition).
 *
 * Tier 1 (what): GET lists the signed-in agent's conversations in a mission; POST sends one
 * message to their target or Secret Santa.
 * Tier 2 (why): The edge worker serves the same path in SaaS; both delegate to
 * `@/lib/intel-messages` so the anonymity rules live in one place.
 * Tier 3 (how): GET takes `?exchangeId=`; POST takes `{ exchangeId, channel, text }`.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { listIntelMessages, sendIntelMessage } from '@/lib/intel-messages';

export const dynamic = 'force-dynamic';

/** Lists the caller's Intel conversations for `?exchangeId=`. */
export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const exchangeId = new URL(request.url).searchParams.get('exchangeId');
    if (!exchangeId) return NextResponse.json({ error: 'exchangeId is required' }, { status: 400 });
    const result = await listIntelMessages(db, exchangeId, userId);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[Intel Messages] list failed:', error);
    return NextResponse.json({ error: 'Failed to load Intel messages' }, { status: 500 });
  }
}

/** Sends one Intel message: `{ exchangeId, channel: 'target' | 'santa', text }`. */
export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { exchangeId?: unknown; channel?: unknown; text?: unknown };
    if (typeof body.exchangeId !== 'string' || !body.exchangeId) {
      return NextResponse.json({ error: 'exchangeId is required' }, { status: 400 });
    }
    const result = await sendIntelMessage(db, { exchangeId: body.exchangeId, userId, channel: body.channel, text: body.text });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[Intel Messages] send failed:', error);
    return NextResponse.json({ error: 'Failed to send Intel message' }, { status: 500 });
  }
}
