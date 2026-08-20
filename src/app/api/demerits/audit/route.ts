import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionUserId = await getSessionUserId();

    const { operationId, requesterUserId } = body as {
      operationId: string;
      requesterUserId?: string;
    };

    const activeUserId = sessionUserId || requesterUserId;

    if (!operationId || !activeUserId) {
      return NextResponse.json(
        { error: 'Authentication and operationId are required' },
        { status: 400 }
      );
    }

    // 1. Fetch Exchange
    const exchange = await db.exchange.findUnique({
      where: { id: operationId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!exchange) {
      return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
    }

    if (exchange.organizerId !== activeUserId) {
      return NextResponse.json(
        { error: 'Only the designated Organizer can execute the audit engine.' },
        { status: 403 }
      );
    }

    // 2. Audit Execution Date
    const now = new Date();
    if (now < new Date(exchange.executionDate)) {
      return NextResponse.json(
        { error: 'Audit engine can only be run on or after Execution Day.' },
        { status: 400 }
      );
    }

    const auditResults: Array<{
      userId: string;
      userName: string;
      penalized: boolean;
      carrierWaived: boolean;
      demeritCleared: boolean;
      newDemeritCount: number;
      accountStatus: string;
    }> = [];

    // 3. Process Each Member
    for (const member of exchange.members) {
      // White Elephant operations: all participating members fulfill their event obligation
      if (exchange.isWhiteElephant) {
        if (member.user.penaltyPoints > 0) {
          const newPenaltyPoints = Math.max(0, member.user.penaltyPoints - 1);
          let newAccountStatus: 'ACTIVE' | 'REMOTE_RESTRICTED' | 'DISABLED' = member.user.accountStatus as any;
          if (newPenaltyPoints < 3 && member.user.accountStatus === 'REMOTE_RESTRICTED') {
            newAccountStatus = 'ACTIVE';
          }

          await db.user.update({
            where: { id: member.user.id },
            data: {
              penaltyPoints: newPenaltyPoints,
              accountStatus: newAccountStatus,
            },
          });

          await db.notification.create({
            data: {
              userId: member.user.id,
              exchangeId: exchange.id,
              title: '🌟 Demerit Cleared: Mission Completed',
              message: `You successfully completed exchange "${exchange.title}". 1 demerit has been removed from your record. Current Points: ${newPenaltyPoints}. Account Status: ${newAccountStatus}.`,
              isAcknowledged: false,
            },
          });

          auditResults.push({
            userId: member.user.id,
            userName: member.user.name,
            penalized: false,
            carrierWaived: false,
            demeritCleared: true,
            newDemeritCount: newPenaltyPoints,
            accountStatus: newAccountStatus,
          });
        }
        continue;
      }

      const isUnfulfilled = member.shippingStatus === 'PENDING' && !member.deliveredConfirmed;
      const hasTrackingProof = !!member.trackingNumber;

      if (isUnfulfilled) {
        if (hasTrackingProof) {
          // Carrier Protection Waiver: User provided tracking number, waiving penalty
          auditResults.push({
            userId: member.user.id,
            userName: member.user.name,
            penalized: false,
            carrierWaived: true,
            demeritCleared: false,
            newDemeritCount: member.user.penaltyPoints,
            accountStatus: member.user.accountStatus,
          });
        } else {
          // Unfulfilled without tracking proof: Issue Penalty Point
          const newPenaltyPoints = member.user.penaltyPoints + 1;
          let newAccountStatus: 'ACTIVE' | 'REMOTE_RESTRICTED' | 'DISABLED' = 'ACTIVE';

          if (newPenaltyPoints >= 4) {
            newAccountStatus = 'DISABLED';
          } else if (newPenaltyPoints === 3) {
            newAccountStatus = 'REMOTE_RESTRICTED';
          }

          // Update User Record
          await db.user.update({
            where: { id: member.user.id },
            data: {
              penaltyPoints: newPenaltyPoints,
              accountStatus: newAccountStatus,
            },
          });

          // Issue Internal System Notification (cannot be turned off, only acknowledged)
          await db.notification.create({
            data: {
              userId: member.user.id,
              exchangeId: exchange.id,
              title: '⚠️ Penalty Issued: Unfulfilled Gift Exchange',
              message: `You were issued 1 penalty point for failing to ship/deliver your assigned gift in exchange "${exchange.title}". Current Points: ${newPenaltyPoints}. Account Status: ${newAccountStatus}.`,
              isAcknowledged: false,
            },
          });

          auditResults.push({
            userId: member.user.id,
            userName: member.user.name,
            penalized: true,
            carrierWaived: false,
            demeritCleared: false,
            newDemeritCount: newPenaltyPoints,
            accountStatus: newAccountStatus,
          });
        }
      } else {
        // Fulfilled Member: Check for Demerit Redemption / Rehabilitation
        if (member.user.penaltyPoints > 0) {
          const newPenaltyPoints = Math.max(0, member.user.penaltyPoints - 1);
          let newAccountStatus: 'ACTIVE' | 'REMOTE_RESTRICTED' | 'DISABLED' = member.user.accountStatus as any;
          if (newPenaltyPoints < 3 && member.user.accountStatus === 'REMOTE_RESTRICTED') {
            newAccountStatus = 'ACTIVE';
          }

          await db.user.update({
            where: { id: member.user.id },
            data: {
              penaltyPoints: newPenaltyPoints,
              accountStatus: newAccountStatus,
            },
          });

          await db.notification.create({
            data: {
              userId: member.user.id,
              exchangeId: exchange.id,
              title: '🌟 Demerit Cleared: Mission Completed',
              message: `You successfully fulfilled your gift assignment in exchange "${exchange.title}". 1 demerit has been removed from your record. Current Points: ${newPenaltyPoints}. Account Status: ${newAccountStatus}.`,
              isAcknowledged: false,
            },
          });

          auditResults.push({
            userId: member.user.id,
            userName: member.user.name,
            penalized: false,
            carrierWaived: false,
            demeritCleared: true,
            newDemeritCount: newPenaltyPoints,
            accountStatus: newAccountStatus,
          });
        }
      }
    }

    // 4. Mark Exchange as COMPLETED
    await db.exchange.update({
      where: { id: exchange.id },
      data: { status: 'COMPLETED' },
    });

    return NextResponse.json({
      success: true,
      message: 'Execution Day audit completed successfully.',
      data: {
        operationId: exchange.id,
        auditResults,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to process execution day audit' }, { status: 500 });
  }
}
