import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { operationId, userId, isLocalDelivery, trackingNumber } = body as {
      operationId: string;
      userId: string;
      isLocalDelivery?: boolean;
      trackingNumber?: string;
    };

    if (!operationId || !userId) {
      return NextResponse.json({ error: 'operationId and userId are required' }, { status: 400 });
    }

    // Find agent participation
    const agent = await db.missionAgent.findUnique({
      where: {
        missionId_userId: {
          missionId: operationId,
          userId,
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
