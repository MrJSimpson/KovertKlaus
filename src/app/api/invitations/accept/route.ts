import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { markInvitationAccepted } from '@/lib/invitations';
import { enrollWithCodename } from '@/lib/codename';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const activeUserId = await getSessionUserId();

    const { operationCode, wishlistId } = body as {
      operationCode: string;
      wishlistId?: string;
    };

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
    if (exchange.maxParticipants && exchange.members.length >= exchange.maxParticipants) {
      return NextResponse.json(
        { error: 'Exchange participant capacity has been reached.' },
        { status: 400 }
      );
    }

    // 3. Verify user is not already enrolled
    const existingMember = exchange.members.find((a: { userId: string }) => a.userId === activeUserId);
    if (existingMember) {
      return NextResponse.json(
        { error: 'You are already enrolled in this exchange.' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: activeUserId }, select: { email: true } });

    // 5. Auto-Link or Provision Master Wishlist Manifest
    let linkedWishlistId: string | null = null;
    if (wishlistId) {
      // Only a manifest the caller owns may be attached.
      const owned = await db.wishlist.findFirst({ where: { id: wishlistId, userId: activeUserId }, select: { id: true } });
      if (!owned) return NextResponse.json({ error: 'Wishlist Manifest not found' }, { status: 404 });
      linkedWishlistId = owned.id;
    }
    if (!linkedWishlistId) {
      const targetType = exchange.isWhiteElephant ? 'WHITE_ELEPHANT' : 'STANDARD';
      const existingWishlist = await db.wishlist.findFirst({
        where: { userId: activeUserId, type: targetType },
        orderBy: { updatedAt: 'desc' },
      });

      if (existingWishlist) {
        linkedWishlistId = existingWishlist.id;
      } else {
        const createdManifest = await db.wishlist.create({
          data: {
            userId: activeUserId,
            name: exchange.isWhiteElephant ? 'White Elephant Gift' : 'Master Wishlist Manifest',
            type: targetType,
          },
        });
        linkedWishlistId = createdManifest.id;
      }
    }

    // 6. Enroll with a codename drawn for this mission (the agent can reroll it until they accept).
    const newMember = await enrollWithCodename(db, exchange.id, (codename) =>
      db.exchangeMember.create({
        data: {
          exchangeId: exchange.id,
          userId: activeUserId,
          codename,
          wishlistId: linkedWishlistId,
          role: 'MEMBER',
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
