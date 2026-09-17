import { executeLinkedListDraw } from './draw';
import { sendAssignmentEmail } from './email';

export interface LifecycleTransition {
  exchangeId: string;
  exchangeTitle: string;
  previousStatus: string;
  newStatus: string;
  milestoneTriggered: 'inviteCutoffDate' | 'assignmentDate' | 'shippingDate' | 'executionDate';
  details?: string;
}

export interface LifecycleSummary {
  processedAt: string;
  missionsCheckedCount: number;
  transitionsCount: number;
  transitions: LifecycleTransition[];
}

/**
 * Automated Mission Lifecycle Engine
 * 
 * Advances missions forward based on milestone dates:
 * 1. inviteCutoffDate: RECRUITING -> SETUP (Closes recruitment)
 * 2. assignmentDate:   SETUP -> MATCHED (Executes target draw & dispatches assignment emails)
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
export async function advanceMissionLifecycle(db: any): Promise<LifecycleSummary> {
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
        include: {
          user: true,
        },
      },
      exclusionRules: true,
      organizer: true,
    },
  });

  const transitions: LifecycleTransition[] = [];

  for (const ex of activeExchanges) {
    let currentStatus = ex.status;

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
            hasWishlistAttached: !!a.wishlistId,
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

            const updateOps = assignments
              .map((assignment) => {
                const member = ex.members.find((m: any) => m.userId === assignment.agentId);
                if (!member) return null;
                return db.exchangeMember.update({
                  where: { id: member.id },
                  data: { targetUserId: assignment.targetId },
                });
              })
              .filter(Boolean);

            await db.$transaction([
              ...(updateOps as any[]),
              db.exchange.update({
                where: { id: ex.id },
                data: { status: 'MATCHED', drawVerifiedAt: now },
              }),
            ]);

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
                  recipientName: giver.name || giver.codename || 'Operative',
                  targetCodename: target.codename || target.name || 'Target Operative',
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
            await db.notification.create({
              data: {
                userId: ex.organizerId,
                exchangeId: ex.id,
                title: `⚠️ Target Draw Pending: ${ex.title}`,
                message: `Automatic target draw could not be completed on Assignment Day (${drawErr?.message || 'Matching constraint conflict'}). Please verify rules in the Command Center.`,
                isAcknowledged: false,
              },
            }).catch(() => {});
          }
        } else {
          // Fewer than 4 members
          await db.notification.create({
            data: {
              userId: ex.organizerId,
              exchangeId: ex.id,
              title: `⚠️ Insufficient Operatives for Draw: ${ex.title}`,
              message: `Assignment Day arrived, but mission has only ${ex.members.length} member(s). A minimum of 4 operatives is required to draw.`,
              isAcknowledged: false,
            },
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

  return {
    processedAt: now.toISOString(),
    missionsCheckedCount: activeExchanges.length,
    transitionsCount: transitions.length,
    transitions,
  };
}
