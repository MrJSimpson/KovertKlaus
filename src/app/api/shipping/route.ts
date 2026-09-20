import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { detectCarrier } from '@/lib/carrier-tracking';

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
      const exchangeTitle = member.exchange?.title || 'Operation';
      const notificationTitle = isLocalDelivery
        ? `🎁 Hand Delivery Dispatched: ${exchangeTitle}`
        : `📦 Parcel In Transit (${carrierInfo?.badgeLabel || 'Carrier'}): ${exchangeTitle}`;

      const notificationMsg = isLocalDelivery
        ? 'Your secret giver has confirmed personal hand delivery / local drop-off for your gift! Keep your eyes peeled.'
        : `Your secret giver has dispatched your parcel via ${carrierInfo?.carrierName || 'Courier'}! Tracking Number: ${cleanTracking}.`;

      await db.notification.create({
        data: {
          userId: member.targetUserId,
          exchangeId: operationId,
          title: notificationTitle,
          message: notificationMsg,
          isAcknowledged: false,
        },
      }).catch(() => {});
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
