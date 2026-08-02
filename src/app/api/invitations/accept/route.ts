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

    // 1. Verify Operation
    const operation = await db.mission.findUnique({
      where: { code: operationCode.trim().toUpperCase() },
      include: { agents: true },
    });

    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    // 2. Check Participant Limit
    if (operation.maxParticipants && operation.agents.length >= operation.maxParticipants) {
      return NextResponse.json(
        { error: 'Operation participant capacity has been reached.' },
        { status: 400 }
      );
    }

    // 3. Verify user is not already enrolled
    const existingAgent = operation.agents.find((a: { userId: string }) => a.userId === activeUserId);
    if (existingAgent) {
      return NextResponse.json(
        { error: 'You are already enrolled in this operation.' },
        { status: 400 }
      );
    }

    // 4. Enroll Field Agent into Operation
    const newAgent = await db.missionAgent.create({
      data: {
        missionId: operation.id,
        userId: activeUserId,
        wishlistId: wishlistId || null,
        role: 'FIELD_AGENT',
      },
      include: {
        mission: {
          select: { title: true, code: true, assignmentDate: true, executionDate: true },
        },
        wishlist: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Field Agent successfully enlisted in operation!',
      data: newAgent,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
