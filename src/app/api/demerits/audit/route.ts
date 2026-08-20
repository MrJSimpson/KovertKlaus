import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { evaluateMemberAudit, AuditOutcome } from '@/lib/demerits';

/**
 * Execution Day Demerit & Auto-Rehabilitation Audit Engine
 * 
 * Governance Invariants:
 * 1. Platform Non-Intermediary Principle:
 *    KovertKlaus admins and support NEVER adjudicate, modify, or manually intervene in personal demerit disputes.
 *    Citations and redemptions are governed 100% deterministically by automated system rules and the Head Elf.
 * 
 * 2. Intentional Neglect Standard:
 *    Demerits are only assigned when a participant demonstrates intentional neglect or abandonment (unfulfilled
 *    delivery with zero carrier tracking proof provided by Execution Day).
 * 
 * 3. Carrier Protection Waiver:
 *    Any operative who enters a valid package tracking number (USPS, FedEx, UPS, DHL) is granted automated immunity
 *    from penalties, even if carrier delivery is delayed.
 * 
 * 4. Automatic Rehabilitation & Redemption Engine:
 *    When an operative with penalty points (`penaltyPoints > 0`) successfully fulfills their gift in a subsequent
 *    exchange (or participates in White Elephant), the system automatically decrements their penalty points by 1
 *    (`-1`), restoring `accountStatus: 'ACTIVE'` when penalty points drop below 3.
 * 
 * @security Only executable on or after Execution Day by the designated Head Elf (`exchange.organizerId`).
 */
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

    const auditResults: AuditOutcome[] = [];

    // 3. Process Each Member using pure evaluateMemberAudit helper
    for (const member of exchange.members) {
      const outcome = evaluateMemberAudit({
        userId: member.user.id,
        userName: member.user.name,
        shippingStatus: member.shippingStatus as any,
        deliveredConfirmed: member.deliveredConfirmed,
        trackingNumber: member.trackingNumber,
        currentPenaltyPoints: member.user.penaltyPoints,
        currentAccountStatus: member.user.accountStatus as any,
        isWhiteElephant: exchange.isWhiteElephant,
      });

      // If penalty points or account status changed, update database
      if (
        outcome.newDemeritCount !== member.user.penaltyPoints ||
        outcome.newAccountStatus !== member.user.accountStatus
      ) {
        await db.user.update({
          where: { id: member.user.id },
          data: {
            penaltyPoints: outcome.newDemeritCount,
            accountStatus: outcome.newAccountStatus,
          },
        });

        // Issue notification
        if (outcome.penalized) {
          await db.notification.create({
            data: {
              userId: member.user.id,
              exchangeId: exchange.id,
              title: '⚠️ Penalty Issued: Unfulfilled Gift Exchange',
              message: `You were issued 1 Coal Citation for failing to ship/deliver your assigned gift in mission "${exchange.title}". Current Points: ${outcome.newDemeritCount}. Account Status: ${outcome.newAccountStatus}.`,
              isAcknowledged: false,
            },
          });
        } else if (outcome.demeritCleared) {
          await db.notification.create({
            data: {
              userId: member.user.id,
              exchangeId: exchange.id,
              title: '🌟 Demerit Cleared: Mission Completed',
              message: `You successfully fulfilled your obligation in mission "${exchange.title}". 1 Coal Citation has been removed from your record. Current Points: ${outcome.newDemeritCount}. Account Status: ${outcome.newAccountStatus}.`,
              isAcknowledged: false,
            },
          });
        }
      }

      auditResults.push(outcome);
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
