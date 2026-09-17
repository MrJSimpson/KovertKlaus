import { evaluateMemberAudit, AuditOutcome } from './demerits';

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
    const updateData: any = { status: 'COMPLETED' };
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
        await db.notification.create({
          data: {
            userId: member.user.id,
            exchangeId: exchange.id,
            title: '⚠️ Penalty Issued: Unfulfilled Holiday Mission',
            message: `You were issued 1 Coal Citation for failing to ship or deliver your assigned gift in mission "${exchange.title}". Current Points: ${outcome.newDemeritCount}. Account Status: ${outcome.newAccountStatus}.`,
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

  // Ensure exchange is marked as COMPLETED and executionDate is set
  const now = new Date();
  const updateData: any = { status: 'COMPLETED' };
  if (!exchange.executionDate || new Date(exchange.executionDate) > now) {
    updateData.executionDate = now;
  }
  await db.exchange.update({
    where: { id: exchange.id },
    data: updateData,
  });

  return auditResults;
}
