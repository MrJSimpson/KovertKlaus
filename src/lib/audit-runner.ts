import { evaluateMemberAudit, AuditOutcome } from './demerits';
import { notifyOnce } from './notifications';
import { NOTICE } from './notification-copy';

/**
 * Processes demerit audit and auto-rehabilitation for a single exchange.
 * Can only be executed on operations that have demerits enabled (enforcePenalties !== false).
 * Idempotently marks the exchange as COMPLETED and updates participant demerits.
 * 
 * Invariants:
 * 1. Head-Elf Controlled: Demerit evaluations are never run automatically by scheduled cron background jobs.
 * 2. Mission Policy Check: Evaluated only when `exchange.enforcePenalties !== false`.
 * 3. Completion Gated: Only executed when or after the mission is marked COMPLETED.
 * 
 * @param db - Prisma client instance
 * @param exchange - Exchange record including members and their users
 * @returns Array of individual member audit outcomes
 */
export async function processExchangeAudit(db: any, exchange: any): Promise<AuditOutcome[]> {
  // If the mission has demerits disabled, do not evaluate or assign any penalties
  if (exchange.enforcePenalties === false) {
    const now = new Date();
    const updateData: any = { status: 'COMPLETED', completedAt: exchange.completedAt ?? now };
    if (!exchange.executionDate || new Date(exchange.executionDate) > now) {
      updateData.executionDate = now;
    }
    await db.exchange.update({
      where: { id: exchange.id },
      data: updateData,
    });
    return [];
  }

  const auditResults: AuditOutcome[] = [];

  for (const member of exchange.members || []) {
    const outcome = evaluateMemberAudit({
      userId: member.user.id,
      userName: member.user.name,
      shippingStatus: member.shippingStatus,
      deliveredConfirmed: member.deliveredConfirmed,
      trackingNumber: member.trackingNumber,
      currentPenaltyPoints: member.user.penaltyPoints,
      currentAccountStatus: member.user.accountStatus,
      isWhiteElephant: exchange.isWhiteElephant,
    });

    // If penalty points or account status changed, update the user record
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

      // Dispatch automated in-app notifications
      if (outcome.penalized) {
        await notifyOnce(db, {
          userId: member.user.id,
          exchangeId: exchange.id,
          ...NOTICE.coalIssued(exchange.id, outcome.newDemeritCount, outcome.newAccountStatus),
        });
      } else if (outcome.demeritCleared) {
        await notifyOnce(db, {
          userId: member.user.id,
          exchangeId: exchange.id,
          ...NOTICE.coalCleared(exchange.id, outcome.newDemeritCount, outcome.newAccountStatus),
        });
      }
    }

    auditResults.push(outcome);
  }

  // Ensure exchange is marked as COMPLETED and executionDate is set
  const now = new Date();
  const updateData: any = { status: 'COMPLETED', completedAt: exchange.completedAt ?? now };
  if (!exchange.executionDate || new Date(exchange.executionDate) > now) {
    updateData.executionDate = now;
  }
  await db.exchange.update({
    where: { id: exchange.id },
    data: updateData,
  });

  return auditResults;
}
