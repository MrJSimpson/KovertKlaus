import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { operationId, requesterUserId } = body as {
      operationId: string;
      requesterUserId: string;
    };

    if (!operationId || !requesterUserId) {
      return NextResponse.json(
        { error: 'operationId and requesterUserId are required' },
        { status: 400 }
      );
    }

    // 1. Fetch Operation
    const operation = await db.mission.findUnique({
      where: { id: operationId },
      include: {
        agents: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    if (operation.opsLeaderId !== requesterUserId) {
      return NextResponse.json(
        { error: 'Only the designated OpsLeader can execute the audit engine.' },
        { status: 403 }
      );
    }

    // 2. Audit Execution Date
    const now = new Date();
    if (now < new Date(operation.executionDate)) {
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
      newDemeritCount: number;
      accountStatus: string;
    }> = [];

    // 3. Process Each Field Agent
    for (const agent of operation.agents) {
      // White Elephant operations do not track individual shipping deliveries
      if (operation.isWhiteElephant) continue;

      const isUnfulfilled = agent.shippingStatus === 'PENDING' && !agent.deliveredConfirmed;
      const hasTrackingProof = !!agent.trackingNumber;

      if (isUnfulfilled) {
        if (hasTrackingProof) {
          // Carrier Protection Waiver: User provided tracking number, waiving demerit penalty
          auditResults.push({
            userId: agent.user.id,
            userName: agent.user.name,
            penalized: false,
            carrierWaived: true,
            newDemeritCount: agent.user.demerits,
            accountStatus: agent.user.accountStatus,
          });
        } else {
          // Unfulfilled without tracking proof: Issue Demerit Penalty
          const newDemerits = agent.user.demerits + 1;
          let newAccountStatus: 'ACTIVE' | 'REMOTE_RESTRICTED' | 'DISABLED' = 'ACTIVE';

          if (newDemerits >= 4) {
            newAccountStatus = 'DISABLED';
          } else if (newDemerits === 3) {
            newAccountStatus = 'REMOTE_RESTRICTED';
          }

          // Update User Record
          await db.user.update({
            where: { id: agent.user.id },
            data: {
              demerits: newDemerits,
              accountStatus: newAccountStatus,
            },
          });

          // Issue Internal System Notification (cannot be turned off, only acknowledged)
          await db.notification.create({
            data: {
              userId: agent.user.id,
              operationId: operation.id,
              title: '⚠️ Demerit Issued: Unfulfilled Gift Operation',
              message: `You were issued 1 demerit for failing to ship/deliver your assigned gift in operation "${operation.title}". Current Demerits: ${newDemerits}. Account Status: ${newAccountStatus}.`,
              isAcknowledged: false,
            },
          });

          auditResults.push({
            userId: agent.user.id,
            userName: agent.user.name,
            penalized: true,
            carrierWaived: false,
            newDemeritCount: newDemerits,
            accountStatus: newAccountStatus,
          });
        }
      }
    }

    // 4. Mark Operation as EXECUTED / COMPLETED
    await db.mission.update({
      where: { id: operation.id },
      data: { status: 'COMPLETED' },
    });

    return NextResponse.json({
      success: true,
      message: 'Execution Day audit completed successfully.',
      data: {
        operationId: operation.id,
        auditResults,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to process execution day audit' }, { status: 500 });
  }
}
