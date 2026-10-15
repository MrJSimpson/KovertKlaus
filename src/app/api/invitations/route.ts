/**
 * @file route.ts
 * @description `/api/invitations`: emailed mission invitations (self-hosted edition).
 *
 * Tier 1 (what): POST sends an invitation (Head Elf only). GET lists the caller's open
 * invitations, or with `?operationId=` every invitation of a mission for its Head Elf. PATCH
 * declines (invitee) or revokes (Head Elf) one: `{ invitationId, action: 'decline' | 'revoke' }`.
 * Tier 2 (why): The edge worker serves the same path in SaaS; both delegate to
 * `@/lib/invitations` so the rules live in one place.
 * Tier 3 (how): Accepting is enrolling, via `POST /api/invitations/accept` or registration with the
 * mission code; both mark the invitation accepted.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { sendInvitationEmail } from '@/lib/email';
import { listMissionInvitations, listMyInvitations, sendMissionInvitation, updateInvitation } from '@/lib/invitations';

export const dynamic = 'force-dynamic';

/** Lists the caller's open invitations, or a mission's invitations for its Head Elf. */
export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const operationId = new URL(request.url).searchParams.get('operationId');
    const result = operationId ? await listMissionInvitations(db, operationId, userId) : await listMyInvitations(db, userId);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[Invitations] list failed:', error);
    return NextResponse.json({ error: 'Failed to load invitations' }, { status: 500 });
  }
}

/** Sends an invitation: `{ operationId, recipientEmail, isLatePass? }`. */
export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { operationId?: unknown; recipientEmail?: unknown; isLatePass?: unknown };
    const result = await sendMissionInvitation(
      db,
      {
        baseUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://kovertklaus.com',
        sendEmail: (email) => sendInvitationEmail(email),
      },
      { exchangeId: body.operationId, inviterId: userId, email: body.recipientEmail, isLatePass: body.isLatePass }
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[Invitations] send failed:', error);
    return NextResponse.json({ error: 'Failed to process invitation' }, { status: 500 });
  }
}

/** Declines or revokes an invitation: `{ invitationId, action }`. */
export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { invitationId?: unknown; action?: unknown };
    const result = await updateInvitation(db, { invitationId: body.invitationId, userId, action: body.action });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[Invitations] update failed:', error);
    return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 });
  }
}
