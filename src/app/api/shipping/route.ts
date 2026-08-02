import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionUserId = await getSessionUserId();

    const { operationId, userId: bodyUserId, isLocalDelivery, trackingNumber } = body as {
      operationId: string;
      userId?: string;
      isLocalDelivery?: boolean;
      trackingNumber?: string;
    };

    const activeUserId = sessionUserId || bodyUserId;

    if (!operationId || !activeUserId) {
      return NextResponse.json({ error: 'Authentication and operationId are required' }, { status: 400 });
    }

    // Find agent participation
    const agent = await db.missionAgent.findUnique({
      where: {
        missionId_userId: {
          missionId: operationId,
          userId: activeUserId,
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Field Agent is not enrolled in this operation.' },
        { status: 404 }
      );
    }

    const shippingStatus = isLocalDelivery ? 'LOCAL_DELIVERY' : 'SHIPPED';
    const cleanTracking = trackingNumber?.trim() || null;

    // Update Shipping Confirmation
    const updatedAgent = await db.missionAgent.update({
      where: { id: agent.id },
      data: {
        shippingStatus,
        trackingNumber: cleanTracking,
        shippedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: isLocalDelivery
        ? 'Local delivery confirmed for operation.'
        : 'Shipment & tracking number confirmed!',
      data: updatedAgent,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to confirm shipping status' }, { status: 500 });
  }
}
