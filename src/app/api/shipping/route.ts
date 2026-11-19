import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { closedMissionGuard } from '@/lib/mission-cancel';
import { getSessionUserId } from '@/lib/auth';
import { detectCarrier } from '@/lib/carrier-tracking';
import { notifyOnce } from '@/lib/notifications';
import { NOTICE } from '@/lib/notification-copy';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const activeUserId = await getSessionUserId();

    const { operationId, isLocalDelivery, trackingNumber } = body as {
      operationId: string;
      isLocalDelivery?: boolean;
      trackingNumber?: string;
    };

    if (!activeUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!operationId) {
      return NextResponse.json({ error: 'operationId is required' }, { status: 400 });
    }

    const closed = await closedMissionGuard(db, operationId);
    if (closed) return NextResponse.json(closed.body, { status: closed.status });

    // Find member participation
    const member = await db.exchangeMember.findUnique({
      where: {
        exchangeId_userId: {
          exchangeId: operationId,
          userId: activeUserId,
        },
      },
      include: {
        exchange: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member is not enrolled in this exchange.' },
        { status: 404 }
      );
    }

    let shippingStatus: 'LOCAL_DELIVERY' | 'SHIPPED' = 'LOCAL_DELIVERY';
    let cleanTracking: string | null = null;
    let carrierInfo = null;

    if (!isLocalDelivery) {
      if (!trackingNumber) {
        return NextResponse.json(
          { error: 'Tracking number is required for courier parcel shipments.' },
          { status: 400 }
        );
      }

      const carrierResult = detectCarrier(trackingNumber);
      if (!carrierResult.isValid) {
        return NextResponse.json(
          { error: 'Invalid carrier tracking number format. Must be at least 8 alphanumeric characters (USPS, UPS, FedEx, DHL, or regional).' },
          { status: 400 }
        );
      }

      shippingStatus = 'SHIPPED';
      cleanTracking = carrierResult.normalizedTracking;
      carrierInfo = carrierResult;
    }

    // Update Shipping Confirmation
    const updatedMember = await db.exchangeMember.update({
      where: { id: member.id },
      data: {
        shippingStatus,
        trackingNumber: cleanTracking,
        shippedAt: new Date(),
      },
    });

    // Notify Target Operative (if target is assigned)
    if (member.targetUserId) {
      const delivery = isLocalDelivery
        ? ({ local: true } as const)
        : ({ local: false, carrierName: carrierInfo?.carrierName || 'a courier', tracking: cleanTracking || '' } as const);
      await notifyOnce(db, { userId: member.targetUserId, exchangeId: operationId, ...NOTICE.giftShipped(operationId, delivery) }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: isLocalDelivery
        ? 'Local delivery confirmed. Target operative notified!'
        : `Shipment confirmed via ${carrierInfo?.badgeLabel || 'Carrier'}! Carrier Protection Waiver active.`,
      data: {
        ...updatedMember,
        carrierInfo,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to confirm shipping status';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
