import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { processExchangeAudit } from '@/lib/audit-runner';

/**
 * Execution Day Demerit & Auto-Rehabilitation Audit Engine
 * 
 * Governance Invariants:
 * 1. Head-Elf Controlled Standard:
 *    Demerits are NEVER automatically assigned across operations by unattended background cron daemons.
 *    Demerit evaluation is strictly triggered by the Head Elf for their specific operation.
 * 
 * 2. Mission Policy Requirement:
 *    Demerit assignment is strictly dependent on whether the mission uses demerits (`enforcePenalties !== false`).
 *    If demerits are disabled for the operation, no citations are ever issued or cleared.
 * 
 * 3. Completion Gating:
 *    Demerit evaluation is only permissible when or after the mission is marked COMPLETED.
 * 
 * 4. Intentional Neglect Standard:
 *    Demerits (+1 Coal Citation) are only assigned when a participant demonstrates intentional neglect or abandonment
 *    (unfulfilled delivery with zero carrier tracking proof provided by Execution Day).
 * 
 * 5. Carrier Protection Waiver:
 *    Any operative who enters a valid package tracking number (USPS, FedEx, UPS, DHL) is granted automated immunity
 *    from penalties, even if carrier delivery is delayed.
 * 
 * 6. Automatic Rehabilitation & Redemption Engine:
 *    When an operative with penalty points (`penaltyPoints > 0`) successfully fulfills their gift in a subsequent
 *    exchange (or participates in White Elephant), the system automatically decrements their penalty points by 1
 *    (`-1`), restoring `accountStatus: 'ACTIVE'` when penalty points drop below 3.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const activeUserId = await getSessionUserId();
    const { operationId } = body;

    if (!operationId) {
      return NextResponse.json({ error: 'operationId is required.' }, { status: 400 });
    }

    if (!activeUserId) {
      return NextResponse.json(
        { error: 'Authentication is required to audit a specific operation.' },
        { status: 401 }
      );
    }

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
        { error: 'Only the designated Head Elf / Organizer can execute the audit engine.' },
        { status: 403 }
      );
    }

    if (exchange.enforcePenalties === false) {
      return NextResponse.json(
        { error: 'Demerits are disabled for this operation.' },
        { status: 400 }
      );
    }

    if (exchange.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Demerits can only be evaluated and assigned when the mission is completed.' },
        { status: 400 }
      );
    }

    const auditResults = await processExchangeAudit(db, exchange);

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
