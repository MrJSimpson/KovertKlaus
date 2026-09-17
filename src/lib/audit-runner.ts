import { evaluateMemberAudit, AuditOutcome } from './demerits';

export interface BatchAuditSummary {
  processedAt: string;
  exchangesAuditedCount: number;
  details: Array<{
    exchangeId: string;
    exchangeTitle: string;
    results: AuditOutcome[];
  }>;
}

/**
 * Processes demerit audit and auto-rehabilitation for a single exchange.
 * Idempotently marks the exchange as COMPLETED and updates participant demerits.
 * 
 * @param db - Prisma client instance
 * @param exchange - Exchange record including members and their users
 * @returns Array of individual member audit outcomes
 */
export async function processExchangeAudit(db: any, exchange: any): Promise<AuditOutcome[]> {
  const auditResults: AuditOutcome[] = [];

  for (const member of exchange.members) {
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

  // Mark exchange as COMPLETED
  await db.exchange.update({
    where: { id: exchange.id },
    data: { status: 'COMPLETED' },
  });

  return auditResults;
}

/**
 * Automated Cron Execution: Queries all active missions that have reached or passed
 * their execution date, executes deterministic demerit evaluations, and transitions
 * missions to COMPLETED status.
 * 
 * @param db - Prisma client instance
 * @returns Summary of batch audit execution
 */
export async function executeDueDemeritAudits(db: any): Promise<BatchAuditSummary> {
  const now = new Date();

  // Find all uncompleted exchanges where executionDate has passed
  const dueExchanges = await db.exchange.findMany({
    where: {
      status: {
        in: ['RECRUITING', 'SETUP', 'ASSIGNED', 'EXECUTED'],
      },
      executionDate: {
        lte: now,
      },
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  const details: Array<{
    exchangeId: string;
    exchangeTitle: string;
    results: AuditOutcome[];
  }> = [];

  for (const exchange of dueExchanges) {
    const results = await processExchangeAudit(db, exchange);
    details.push({
      exchangeId: exchange.id,
      exchangeTitle: exchange.title,
      results,
    });
  }

  return {
    processedAt: now.toISOString(),
    exchangesAuditedCount: dueExchanges.length,
    details,
  };
}
