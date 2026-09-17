import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { processExchangeAudit, executeDueDemeritAudits } from '@/lib/audit-runner';

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
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const activeUserId = await getSessionUserId();
    const { operationId } = body;

    // Mode 1: Batch execution across all due exchanges (no specific operationId passed)
    if (!operationId) {
      const summary = await executeDueDemeritAudits(db);
      return NextResponse.json({
        success: true,
        message: `Batch execution audit completed for ${summary.exchangesAuditedCount} mission(s).`,
        data: summary,
      });
    }

    // Mode 2: Single operation audit triggered by Head Elf
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

    const now = new Date();
    if (now < new Date(exchange.executionDate)) {
      return NextResponse.json(
        { error: 'Audit engine can only be run on or after Execution Day.' },
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
