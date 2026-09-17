import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';

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

    // 2. Check Participant Limit
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

    // 4. Resolve Unique Event-Scoped Codename
    const user = await db.user.findUnique({
      where: { id: activeUserId },
      select: { name: true, codename: true, preferredCodename: true, autoRandomizeCodename: true },
    });

    const existingRosterCodenames = exchange.members
      .map((m: any) => m.codename)
      .filter(Boolean) as string[];

    const { customCodename, randomizeCodename } = body as { customCodename?: string; randomizeCodename?: boolean };
    const preferred = customCodename || user?.preferredCodename || user?.codename || user?.name || 'Agent';
    const shouldRandomize = Boolean(randomizeCodename || user?.autoRandomizeCodename);

    const { resolveUniqueCodename } = await import('@/lib/codename');
    const resolution = resolveUniqueCodename(preferred, existingRosterCodenames, shouldRandomize);

    // 5. Auto-Link or Provision Master Wishlist Manifest
    let linkedWishlistId = wishlistId || null;
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

    // 6. Enroll Member into Exchange with Unique Codename and Linked Wishlist
    const newMember = await db.exchangeMember.create({
      data: {
        exchangeId: exchange.id,
        userId: activeUserId,
        codename: resolution.codename,
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
    });

    return NextResponse.json({
      success: true,
      message: 'Member successfully enrolled in exchange!',
      data: {
        ...newMember,
        assignedCodename: resolution.codename,
        wasCollided: resolution.wasCollided,
        isRandomized: resolution.isRandomized,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
