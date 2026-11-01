/**
 * @file route.ts
 * @description `POST /api/invitations/accept`: join a mission by its code (or an emailed invitation link).
 *
 * Tier 1 (what): Takes `{ operationCode, inviteToken? }`. With a valid invitation link the agent is
 * enrolled (`joined: true`); otherwise a request goes to the Head Elf (`pending: true`). 404 for an
 * unknown code (rate-limited), 409 when already enrolled, 400/403 when closed or declined.
 * Tier 2 (why): Joining by code needs Head Elf approval (owner decision 2026-10-31). Self-hosted
 * counterpart of the Worker route; both call `joinMission` (src/lib/join-requests.ts).
 * Tier 3 (how): Wrong codes are rate-limited by `openJoinGate` before the lookup.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/adminDb';
import { getSessionUserId } from '@/lib/auth';
import { openJoinGate } from '@/lib/join-throttle';
import { joinMission } from '@/lib/join-requests';
import { bodyString, readJsonBody } from '@/lib/request-body';

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const activeUserId = await getSessionUserId();
    const operationCode = bodyString(body.operationCode);

    if (!activeUserId || !operationCode) {
      return NextResponse.json({ error: 'Authentication and operationCode are required' }, { status: 400 });
    }

    // Codes can be guessed: wrong codes are rate-limited.
    const gate = await openJoinGate(adminDb, activeUserId, request.headers);
    if (gate.blocked) return gate.blocked;
    const exchange = await db.exchange.findUnique({ where: { code: operationCode.trim().toUpperCase() } });
    if (!exchange) {
      await gate.wrongCode();
      return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
    }

    const result = await joinMission({ db, adminDb }, exchange, { userId: activeUserId, inviteToken: bodyString(body.inviteToken) });
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error('API Error in POST /api/invitations/accept:', err);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
