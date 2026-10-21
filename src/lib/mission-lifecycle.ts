import { executeLinkedListDraw } from './draw';
import { sendAssignmentEmail, sendMissionCancelledEmail, sendMissionRepairEmail } from './email';
import { notifyOnce } from './notifications';
import { purgeCancelledMissions } from './mission-cancel';
import { READINESS_MEMBERS_INCLUDE, runRepairSweep, type MissionRepairDeps, type RepairOutcome } from './mission-repair';

export interface LifecycleTransition {
  exchangeId: string;
  exchangeTitle: string;
  previousStatus: string;
  newStatus: string;
  milestoneTriggered: 'inviteCutoffDate' | 'assignmentDate' | 'shippingDate' | 'executionDate' | 'repair';
  details?: string;
}

export interface LifecycleSummary {
  processedAt: string;
  missionsCheckedCount: number;
  transitionsCount: number;
  transitions: LifecycleTransition[];
  /** Cancelled missions deleted this sweep (90 days after cancellation). */
  purgedCount: number;
}

/**
 * Automated Mission Lifecycle Engine
 * 
 * Advances missions forward based on milestone dates:
 * 1. inviteCutoffDate: RECRUITING -> SETUP (Closes recruitment)
 * 2. assignmentDate:   SETUP -> MATCHED (Executes target draw & dispatches assignment emails)
 *    First the readiness check (src/lib/mission-repair.ts): a mission with too few agents, a missing
 *    address or an empty wishlist is paused (back to RECRUITING) until its repair deadline, then
 *    resumed and drawn once fixed, or cancelled.
 * 3. shippingDate:     MATCHED -> SHIPPED (Enters pre-exchange in-transit countdown)
 * 4. executionDate:    SHIPPED/MATCHED -> EXECUTED (Exchange Day live event)
 * 
 * Invariants:
 * - Demerit evaluation is NEVER run by this cron trigger (Head-Elf controlled upon COMPLETED).
 * - Missions advance deterministically when milestone dates arrive.
 * 
 * @param db - Prisma client instance
 * @returns LifecycleSummary of all transitions executed
 */
/** Default email senders for the sweep; the edge worker passes its own (with its email settings). */
export function defaultLifecycleDeps(): MissionRepairDeps {
  return {
    baseUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://kovertklaus.com',
    sendEmail: (email) => sendMissionCancelledEmail(email),
    sendRepairEmail: (email) => sendMissionRepairEmail(email),
  };
}

export async function advanceMissionLifecycle(db: any, deps: MissionRepairDeps = defaultLifecycleDeps()): Promise<LifecycleSummary> {
  const now = new Date();

  // Find all active uncompleted missions
  const activeExchanges = await db.exchange.findMany({
    where: {
      status: {
        in: ['RECRUITING', 'SETUP', 'MATCHED', 'SHIPPED'],
      },
    },
    include: {
      members: {
        include: READINESS_MEMBERS_INCLUDE,
      },
      exclusionRules: true,
      organizer: true,
    },
  });

  const transitions: LifecycleTransition[] = [];

  for (const ex of activeExchanges) {
    let currentStatus = ex.status;
    // Readiness checked this sweep (by the paused-mission branch), so the draw step does not repeat it.
    let readyChecked = false;

    // -------------------------------------------------------------------------
    // PAUSED FOR REPAIR: no normal milestones until fixed or cancelled
    // -------------------------------------------------------------------------
    if (ex.repairDeadline) {
      const outcome: RepairOutcome = await runRepairSweep(db, deps, ex, now.getTime());
      if (outcome === 'cancelled') {
        transitions.push({
          exchangeId: ex.id, exchangeTitle: ex.title, previousStatus: currentStatus, newStatus: 'CANCELLED',
          milestoneTriggered: 'repair', details: 'Repair deadline passed with the draw still blocked',
        });
      }
      if (outcome !== 'ready') continue;
      transitions.push({
        exchangeId: ex.id, exchangeTitle: ex.title, previousStatus: currentStatus, newStatus: 'SETUP',
        milestoneTriggered: 'repair', details: 'Draw issues resolved; resuming',
      });
      currentStatus = 'SETUP';
      readyChecked = true;
    }

    // -------------------------------------------------------------------------
    // MILESTONE 1: Invite Cutoff Date (RECRUITING -> SETUP)
    // -------------------------------------------------------------------------
    if (
      currentStatus === 'RECRUITING' &&
      ex.inviteCutoffDate &&
      now >= new Date(ex.inviteCutoffDate)
    ) {
      await db.exchange.update({
        where: { id: ex.id },
        data: { status: 'SETUP' },
      });

      await db.notification.create({
        data: {
          userId: ex.organizerId,
          exchangeId: ex.id,
          title: `🔒 Recruitment Closed: ${ex.title}`,
          message: `The RSVP cutoff date has arrived. Recruitment is locked and the mission has advanced to the SETUP stage.`,
          isAcknowledged: false,
        },
      }).catch(() => {});

      transitions.push({
        exchangeId: ex.id,
        exchangeTitle: ex.title,
        previousStatus: 'RECRUITING',
        newStatus: 'SETUP',
        milestoneTriggered: 'inviteCutoffDate',
        details: 'RSVP cutoff date reached; recruitment locked',
      });

      currentStatus = 'SETUP';
    }

    // -------------------------------------------------------------------------
    // MILESTONE 2: Assignment Date (SETUP -> MATCHED)
    // -------------------------------------------------------------------------
    if (
      currentStatus === 'SETUP' &&
      ex.assignmentDate &&
      now >= new Date(ex.assignmentDate)
    ) {
      // Readiness first: an issue pauses the mission for repair instead of drawing.
      if (!readyChecked && !ex.members.some((m: { targetUserId?: string | null }) => m.targetUserId)) {
        const outcome: RepairOutcome = await runRepairSweep(db, deps, ex, now.getTime());
        if (outcome !== 'ready') {
          transitions.push({
            exchangeId: ex.id, exchangeTitle: ex.title, previousStatus: 'SETUP', newStatus: 'RECRUITING',
            milestoneTriggered: 'repair', details: 'Draw paused for repair (see repairIssues)',
          });
          continue;
        }
      }

      if (ex.isWhiteElephant) {
        // White Elephant does not require secret giver-receiver draw
        await db.exchange.update({
          where: { id: ex.id },
          data: { status: 'MATCHED' },
        });

        transitions.push({
          exchangeId: ex.id,
          exchangeTitle: ex.title,
          previousStatus: 'SETUP',
          newStatus: 'MATCHED',
          milestoneTriggered: 'assignmentDate',
          details: 'White Elephant mission moved to MATCHED stage',
        });

        currentStatus = 'MATCHED';
      } else {
        // Secret Santa Draw
        const alreadyDrawn = ex.members.some((m: any) => m.targetUserId);

        if (alreadyDrawn) {
          await db.exchange.update({
            where: { id: ex.id },
            data: { status: 'MATCHED' },
          });

          transitions.push({
            exchangeId: ex.id,
            exchangeTitle: ex.title,
            previousStatus: 'SETUP',
            newStatus: 'MATCHED',
            milestoneTriggered: 'assignmentDate',
            details: 'Assignments previously drawn; advanced to MATCHED',
          });

          currentStatus = 'MATCHED';
        } else if (ex.members.length >= 4) {
          const agentsForDraw = ex.members.map((a: any) => ({
            id: a.userId,
            name: a.user?.name || a.userId,
            hasWishlistAttached: true,
          }));

          const exclusions = (ex.exclusionRules || []).map((r: any) => ({
            agentId: r.memberId,
            restrictedAgentId: r.restrictedMemberId,
          }));

          try {
            const assignments = executeLinkedListDraw(agentsForDraw, {
              isWhiteElephant: false,
              exclusionRules: exclusions,
            });

            // Callback transaction: `db` model calls run eagerly, so the array form fails (src/lib/db.ts).
            await db.$transaction(async (tx: any) => {
              for (const assignment of assignments) {
                const member = ex.members.find((m: any) => m.userId === assignment.agentId);
                if (!member) continue;
                await tx.exchangeMember.update({
                  where: { id: member.id },
                  data: { targetUserId: assignment.targetId },
                });
              }
              await tx.exchange.update({
                where: { id: ex.id },
                data: { status: 'MATCHED', drawVerifiedAt: now },
              });
            });

            // Dispatch in-app notifications
            for (const a of assignments) {
              await db.notification.create({
                data: {
                  userId: a.agentId,
                  exchangeId: ex.id,
                  title: `🎯 Secret Target Assigned: ${ex.title}`,
                  message: `Target assignments have been drawn for mission "${ex.title}"! Open your Command Center briefing to inspect your classified target.`,
                  isAcknowledged: false,
                },
              }).catch(() => {});
            }

            // Dispatch assignment notification emails
            const enrolledUsers = ex.members.map((m: any) => m.user).filter(Boolean);
            for (const assignment of assignments) {
              const giver = enrolledUsers.find((u: any) => u.id === assignment.agentId);
              const target = enrolledUsers.find((u: any) => u.id === assignment.targetId);

              if (giver?.email && giver.emailNotifications !== false && target) {
                sendAssignmentEmail({
                  recipientEmail: giver.email,
                  recipientName: giver.name || 'Operative',
                  targetCodename: ex.members.find((m: { userId: string; codename: string | null }) => m.userId === assignment.targetId)?.codename || 'Target Operative',
                  targetName: target.name || undefined,
                  exchangeTitle: ex.title,
                  shippingDeadline: ex.shippingDate ? new Date(ex.shippingDate).toLocaleDateString() : undefined,
                  exchangeDate: ex.executionDate ? new Date(ex.executionDate).toLocaleDateString() : undefined,
                  exchangeUrl: `${process.env.NEXTAUTH_URL || 'https://kovertklaus.com'}/exchange/${ex.code}`,
                }).catch(() => {});
              }
            }

            transitions.push({
              exchangeId: ex.id,
              exchangeTitle: ex.title,
              previousStatus: 'SETUP',
              newStatus: 'MATCHED',
              milestoneTriggered: 'assignmentDate',
              details: `Automated Sattolo draw executed for ${assignments.length} operatives`,
            });

            currentStatus = 'MATCHED';
          } catch (drawErr: any) {
            // One notice per mission, refreshed each sweep, instead of a new one every hour.
            await notifyOnce(db, {
              userId: ex.organizerId,
              dedupeKey: `draw-blocked:${ex.id}`,
              exchangeId: ex.id,
              title: `⚠️ Target Draw Pending: ${ex.title}`,
              message: `Automatic target draw could not be completed on Assignment Day (${drawErr?.message || 'Matching constraint conflict'}). Please verify rules in the Command Center.`,
            }).catch(() => {});
          }
        } else {
          // Fewer than 4 members
          await notifyOnce(db, {
            userId: ex.organizerId,
            dedupeKey: `draw-blocked:${ex.id}`,
            exchangeId: ex.id,
            title: `⚠️ Insufficient Operatives for Draw: ${ex.title}`,
            message: `Assignment Day arrived, but mission has only ${ex.members.length} member(s). A minimum of 4 operatives is required to draw.`,
          }).catch(() => {});
        }
      }
    }

    // -------------------------------------------------------------------------
    // MILESTONE 3: Shipping Date (MATCHED -> SHIPPED)
    // -------------------------------------------------------------------------
    if (
      currentStatus === 'MATCHED' &&
      ex.shippingDate &&
      now >= new Date(ex.shippingDate)
    ) {
      await db.exchange.update({
        where: { id: ex.id },
        data: { status: 'SHIPPED' },
      });

      for (const member of ex.members) {
        await db.notification.create({
          data: {
            userId: member.userId,
            exchangeId: ex.id,
            title: `📦 Shipping Deadline Reached: ${ex.title}`,
            message: `The gift shipping deadline has arrived. Please verify your tracking number or local delivery status.`,
            isAcknowledged: false,
          },
        }).catch(() => {});
      }

      transitions.push({
        exchangeId: ex.id,
        exchangeTitle: ex.title,
        previousStatus: 'MATCHED',
        newStatus: 'SHIPPED',
        milestoneTriggered: 'shippingDate',
        details: 'Shipping deadline reached; mission in transit',
      });

      currentStatus = 'SHIPPED';
    }

    // -------------------------------------------------------------------------
    // MILESTONE 4: Execution Date (SHIPPED/MATCHED -> EXECUTED)
    // -------------------------------------------------------------------------
    if (
      (currentStatus === 'SHIPPED' || currentStatus === 'MATCHED') &&
      ex.executionDate &&
      now >= new Date(ex.executionDate)
    ) {
      await db.exchange.update({
        where: { id: ex.id },
        data: { status: 'EXECUTED' },
      });

      for (const member of ex.members) {
        await db.notification.create({
          data: {
            userId: member.userId,
            exchangeId: ex.id,
            title: `🎉 Exchange Day Has Arrived: ${ex.title}`,
            message: `Execution Day is here! Mission is live for unwrapping and celebrations.`,
            isAcknowledged: false,
          },
        }).catch(() => {});
      }

      transitions.push({
        exchangeId: ex.id,
        exchangeTitle: ex.title,
        previousStatus: currentStatus,
        newStatus: 'EXECUTED',
        milestoneTriggered: 'executionDate',
        details: 'Exchange Day arrived; mission active for unwrapping',
      });

      currentStatus = 'EXECUTED';
    }
  }

  // Cancelled missions are erased 90 days after cancellation (src/lib/mission-cancel.ts).
  const purgedCount = await purgeCancelledMissions(db, now.getTime()).catch((err: unknown) => {
    console.error('[Lifecycle] purge of cancelled missions failed:', err);
    return 0;
  });

  return {
    processedAt: now.toISOString(),
    missionsCheckedCount: activeExchanges.length,
    transitionsCount: transitions.length,
    transitions,
    purgedCount,
  };
}
