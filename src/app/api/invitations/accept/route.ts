import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionUserId = await getSessionUserId();

    const { userId: bodyUserId, operationCode, wishlistId } = body as {
      userId?: string;
      operationCode: string;
      wishlistId?: string;
    };

    const activeUserId = sessionUserId || bodyUserId;

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

    // 4. Enroll Member into Exchange
    const newMember = await db.exchangeMember.create({
      data: {
        exchangeId: exchange.id,
        userId: activeUserId,
        wishlistId: wishlistId || null,
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
      data: newMember,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
