import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/adminDb';
import { getPlatformSettings, missionFullError } from '@/lib/platform-limits';
import { getSessionUserId } from '@/lib/auth';
import { markInvitationAccepted } from '@/lib/invitations';
import { enrollWithCodename } from '@/lib/codename';
import { memberWishlistCreate } from '@/lib/mission-wishlist';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const activeUserId = await getSessionUserId();

    const { operationCode } = body as { operationCode: string };

    if (!activeUserId || !operationCode) {
      return NextResponse.json(
        { error: 'Authentication and operationCode are required' },
        { status: 400 }
      );
    }

    // 1. Verify Exchange
    const exchange = await db.exchange.findUnique({
      where: { code: operationCode.trim().toUpperCase() },
      include: { members: true },
    });

    if (!exchange) {
      return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
    }

    // 2. Check Mission Phase Status (Enforce Recruiting Stage)
    if (exchange.status !== 'RECRUITING') {
      return NextResponse.json(
        { error: 'Recruitment for this mission has closed. Operatives cannot join active or completed operations.' },
        { status: 400 }
      );
    }

    // 3. Check Participant Limit
    const full = missionFullError(exchange.maxParticipants, exchange.members.length, await getPlatformSettings(adminDb));
    if (full) return NextResponse.json({ error: full }, { status: 400 });

    // 3. Verify user is not already enrolled
    const existingMember = exchange.members.find((a: { userId: string }) => a.userId === activeUserId);
    if (existingMember) {
      return NextResponse.json(
        { error: 'You are already enrolled in this exchange.' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: activeUserId }, select: { email: true } });

    // 5. Enroll with a codename drawn for this mission (the agent can reroll it until they accept).
    const newMember = await enrollWithCodename(db, exchange.id, (codename) =>
      db.exchangeMember.create({
        data: {
          exchangeId: exchange.id,
          userId: activeUserId,
          codename,
          role: 'MEMBER',
          // Every agent gets a fresh Wishlist Manifest for this mission.
          wishlist: memberWishlistCreate(activeUserId, exchange.isWhiteElephant),
        },
        include: {
          exchange: {
            select: { title: true, code: true, assignmentDate: true, executionDate: true },
          },
          wishlist: {
            select: { id: true, name: true },
          },
        },
      })
    );
    if (user?.email) await markInvitationAccepted(db, exchange.id, user.email, activeUserId);

    return NextResponse.json({
      success: true,
      message: 'Member successfully enrolled in exchange!',
      data: {
        ...newMember,
        assignedCodename: newMember.codename,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
