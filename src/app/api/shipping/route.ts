import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const activeUserId = await getSessionUserId();

    const { operationId, isLocalDelivery, trackingNumber } = body as {
      operationId: string;
      isLocalDelivery?: boolean;
      trackingNumber?: string;
    };

    if (!operationId || !activeUserId) {
      return NextResponse.json({ error: 'Authentication and operationId are required' }, { status: 400 });
    }

    // Find member participation
    const member = await db.exchangeMember.findUnique({
      where: {
        exchangeId_userId: {
          exchangeId: operationId,
          userId: activeUserId,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member is not enrolled in this exchange.' },
        { status: 404 }
      );
    }

    const shippingStatus = isLocalDelivery ? 'LOCAL_DELIVERY' : 'SHIPPED';
    const cleanTracking = trackingNumber?.trim() || null;

    // Update Shipping Confirmation
    const updatedMember = await db.exchangeMember.update({
      where: { id: member.id },
      data: {
        shippingStatus,
        trackingNumber: cleanTracking,
        shippedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: isLocalDelivery
        ? 'Local delivery confirmed for exchange.'
        : 'Shipment & tracking number confirmed!',
      data: updatedMember,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to confirm shipping status' }, { status: 500 });
  }
}
