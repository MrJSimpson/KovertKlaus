import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { validateOperationConfig, CreateOperationInput } from '@/lib/validations/operation';
import { generateInviteCode } from '@/lib/security';
import { executeLinkedListDraw, executeTargetSwap } from '@/lib/draw';
import { sendAssignmentEmail, sendNudgeEmail } from '@/lib/email';

export const dynamic = 'force-static';

export async function GET(request: Request) {

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const paramUserId = searchParams.get('userId');
    const sessionUserId = await getSessionUserId();
    const activeUserId = sessionUserId || paramUserId;

    // Case 1: Fetch single exchange by unique invite code (e.g. KOVERT-87WZ)
    if (code) {
      const exchange = await db.exchange.findUnique({
        where: { code: code.trim().toUpperCase() },
        include: {
          organizer: {
            select: { id: true, name: true, codename: true },
          },
          members: {
            include: {
              user: {
                select: { id: true, name: true, codename: true, streetAddress: true, city: true, state: true, zipCode: true },
              },
              targetUser: {
                select: { id: true, name: true, codename: true, streetAddress: true, city: true, state: true, zipCode: true },
              },
            },
          },
          exclusionRules: {
            include: {
              member: { select: { id: true, name: true, codename: true } },
              restrictedMember: { select: { id: true, name: true, codename: true } },
            },
          },
          reports: {
            include: {
              user: { select: { id: true, name: true, codename: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!exchange) {
        return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: exchange });
    }

    // Case 2: Fetch all exchanges enrolled/owned by a user
    if (!activeUserId) {
      return NextResponse.json({ error: 'Authentication or user ID is required' }, { status: 401 });
    }

    const exchanges = await db.exchange.findMany({
      where: {
        OR: [
          { organizerId: activeUserId },
          { members: { some: { userId: activeUserId } } },
        ],
      },
      include: {
        organizer: {
          select: { id: true, name: true, codename: true },
        },
        members: {
          select: { id: true, userId: true, role: true, shippingStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: exchanges });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch exchanges';
    console.error('API Error in GET /api/operations:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionUserId = await getSessionUserId();
    
    const { userId: bodyUserId, config, action, operationId, forceUnlock } = body as {
      userId?: string;
      config?: CreateOperationInput;
      action?: string;
      operationId?: string;
      forceUnlock?: boolean;
    };

    const activeUserId = sessionUserId || bodyUserId;

    if (!activeUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Action: Trigger Target Draw for Secret Santa
    if (action === 'draw' && operationId) {
      const ex = await db.exchange.findUnique({
        where: { id: operationId },
        include: { members: true, exclusionRules: true },
      });

      if (!ex) {
        return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
      }

      if (ex.organizerId !== activeUserId) {
        return NextResponse.json({ error: 'Only the Organizer can trigger target draws' }, { status: 403 });
      }

      // Hardening D1: Lock Guard against accidental re-draws
      if (ex.status === 'MATCHED' && !forceUnlock) {
        return NextResponse.json({
          error: 'Target assignments have already been drawn for this exchange. Re-drawing will overwrite existing targets.',
          requiresConfirmation: true,
        }, { status: 409 });
      }

      if (ex.members.length < 2) {
        return NextResponse.json({ error: 'At least 2 members are required to execute a target draw' }, { status: 400 });
      }

      const agentsForDraw = ex.members.map((a) => ({
        id: a.userId,
        name: a.userId,
        hasWishlistAttached: !!a.wishlistId,
      }));

      const exclusionRulesForDraw = ex.exclusionRules.map((r) => ({
        agentId: r.memberId,
        restrictedAgentId: r.restrictedMemberId,
      }));

      try {
        const assignments = executeLinkedListDraw(agentsForDraw, {
          isWhiteElephant: ex.isWhiteElephant,
          exclusionRules: exclusionRulesForDraw,
        });

        for (const assignment of assignments) {
          const memberRecord = ex.members.find((a) => a.userId === assignment.agentId);
          if (memberRecord) {
            await db.exchangeMember.update({
              where: { id: memberRecord.id },
              data: { targetUserId: assignment.targetId },
            });
          }
        }

        await db.exchange.update({
          where: { id: operationId },
          data: { status: 'MATCHED' },
        });

        // Dispatch Assignment Notification Emails to enrolled operatives
        try {
          const enrolledUsers = await db.user.findMany({
            where: { id: { in: ex.members.map((m) => m.userId) } },
          });

          for (const assignment of assignments) {
            const giver = enrolledUsers.find((u) => u.id === assignment.agentId);
            const target = enrolledUsers.find((u) => u.id === assignment.targetId);

            if (giver && giver.email && giver.emailNotifications !== false) {
              sendAssignmentEmail({
                recipientEmail: giver.email,
                recipientName: giver.name || giver.codename || 'Operative',
                targetCodename: target?.codename || 'Classified Operative',
                targetName: target?.name ?? undefined,
                exchangeTitle: ex.title,
                exchangeUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/exchange/${ex.code}`,
                shippingDeadline: ex.shippingDate ? new Date(ex.shippingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined,
                exchangeDate: ex.executionDate ? new Date(ex.executionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined,
              }).catch((e) => console.warn('[EMAIL WARNING] Assignment email dispatch error:', e));
            }
          }
        } catch (emailErr) {
          console.warn('[EMAIL WARNING] Failed to batch dispatch assignment emails:', emailErr);
        }

        return NextResponse.json({
          success: true,
          message: 'Target assignments completed via Sattolo algorithm with exclusion rule enforcement',
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Target draw failed';
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }
    }

    // Action: 2-Way Cascade Target Swap
    if (action === 'swap' && operationId) {
      const { originatorUserId, newTargetUserId } = body as {
        originatorUserId?: string;
        newTargetUserId?: string;
      };

      if (!originatorUserId || !newTargetUserId) {
        return NextResponse.json({ error: 'originatorUserId and newTargetUserId are required' }, { status: 400 });
      }

      const ex = await db.exchange.findUnique({
        where: { id: operationId },
        include: { members: true, exclusionRules: true },
      });

      if (!ex) {
        return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
      }

      if (ex.organizerId !== activeUserId) {
        return NextResponse.json({ error: 'Only the Organizer can execute target swaps' }, { status: 403 });
      }

      const currentAssignments = ex.members
        .filter((a) => a.targetUserId)
        .map((a) => ({ agentId: a.userId, targetId: a.targetUserId! }));

      const exclusionRules = ex.exclusionRules.map((r) => ({
        agentId: r.memberId,
        restrictedAgentId: r.restrictedMemberId,
      }));

      try {
        const updatedAssignments = executeTargetSwap(
          currentAssignments,
          originatorUserId,
          newTargetUserId,
          exclusionRules
        );

        for (const assignment of updatedAssignments) {
          const memberRecord = ex.members.find((a) => a.userId === assignment.agentId);
          if (memberRecord) {
            await db.exchangeMember.update({
              where: { id: memberRecord.id },
              data: { targetUserId: assignment.targetId },
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Target swap executed successfully',
          assignments: updatedAssignments,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Target swap failed';
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }
    }

    // Action: Add Preventative Match Rule (Bidirectional)
    if (action === 'addExclusion' && operationId) {
      const { agentId: memberId, restrictedAgentId: restrictedMemberId } = body as { agentId?: string; restrictedAgentId?: string };

      if (!memberId || !restrictedMemberId) {
        return NextResponse.json({ error: 'agentId and restrictedAgentId are required' }, { status: 400 });
      }

      if (memberId === restrictedMemberId) {
        return NextResponse.json({ error: 'Cannot create a preventative match rule for self' }, { status: 400 });
      }

      const ex = await db.exchange.findUnique({ where: { id: operationId } });
      if (!ex) return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
      if (ex.organizerId !== activeUserId) {
        return NextResponse.json({ error: 'Only Organizer can manage preventative match rules' }, { status: 403 });
      }

      const existing = await db.exclusionRule.findFirst({
        where: {
          exchangeId: operationId,
          OR: [
            { memberId, restrictedMemberId },
            { memberId: restrictedMemberId, restrictedMemberId: memberId },
          ],
        },
      });

      if (existing) {
        return NextResponse.json({ error: 'Preventative match rule already exists for these members' }, { status: 409 });
      }

      const newRule = await db.exclusionRule.create({
        data: {
          exchangeId: operationId,
          memberId,
          restrictedMemberId,
        },
        include: {
          member: { select: { id: true, name: true, codename: true } },
          restrictedMember: { select: { id: true, name: true, codename: true } },
        },
      });

      return NextResponse.json({ success: true, message: 'Preventative match rule created', data: newRule });
    }

    // Action: Remove Preventative Match Rule
    if (action === 'removeExclusion' && operationId) {
      const { exclusionId } = body as { exclusionId?: string };

      if (!exclusionId) {
        return NextResponse.json({ error: 'exclusionId is required' }, { status: 400 });
      }

      const ex = await db.exchange.findUnique({ where: { id: operationId } });
      if (!ex) return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
      if (ex.organizerId !== activeUserId) {
        return NextResponse.json({ error: 'Only Organizer can manage preventative match rules' }, { status: 403 });
      }

      await db.exclusionRule.delete({ where: { id: exclusionId } });

      return NextResponse.json({ success: true, message: 'Preventative match rule removed' });
    }

    // Action: Close Recruitment (Updates inviteCutoffDate to today and advances status)
    if (action === 'closeRecruitment' && operationId) {
      const ex = await db.exchange.findUnique({ where: { id: operationId } });
      if (!ex) return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
      if (ex.organizerId !== activeUserId) return NextResponse.json({ error: 'Only Organizer can close recruitment' }, { status: 403 });

      const now = new Date();
      await db.exchange.update({
        where: { id: operationId },
        data: {
          inviteCutoffDate: now,
          status: ex.status === 'RECRUITING' ? 'SETUP' : ex.status,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Recruitment closed. Invite cutoff date updated to today.',
      });
    }

    // Action: End Exchange (Updates executionDate to today and updates status to COMPLETED)
    if (action === 'endOperation' && operationId) {
      const ex = await db.exchange.findUnique({ where: { id: operationId } });
      if (!ex) return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
      if (ex.organizerId !== activeUserId) return NextResponse.json({ error: 'Only Organizer can end exchange' }, { status: 403 });

      const now = new Date();
      await db.exchange.update({
        where: { id: operationId },
        data: {
          executionDate: now,
          status: 'COMPLETED',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Exchange successfully ended! Status updated to COMPLETED.',
      });
    }

    // Action: Send Broadcast Notification
    if (action === 'sendOpTeamBroadcast' && operationId) {
      const { messageText } = body as { messageText?: string };
      if (!messageText?.trim()) return NextResponse.json({ error: 'Message text is required' }, { status: 400 });

      const ex = await db.exchange.findUnique({
        where: { id: operationId },
        include: { members: { include: { user: true } }, organizer: true },
      });
      if (!ex) return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
      if (ex.organizerId !== activeUserId) return NextResponse.json({ error: 'Only Organizer can broadcast to members' }, { status: 403 });

      for (const member of ex.members) {
        await db.notification.create({
          data: {
            userId: member.userId,
            title: `📢 Exchange Broadcast: ${ex.title}`,
            message: messageText.trim(),
            exchangeId: ex.id,
          },
        });

        if (member.user.email && member.user.emailNotifications !== false) {
          sendNudgeEmail({
            recipientEmail: member.user.email,
            recipientName: member.user.name || member.user.codename || 'Operative',
            organizerName: ex.organizer.name,
            exchangeTitle: ex.title,
            message: messageText.trim(),
            actionUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/exchange/${ex.code}`,
          }).catch((e) => console.warn('[EMAIL WARNING] Broadcast email error:', e));
        }
      }

      return NextResponse.json({ success: true, message: 'Broadcast dispatched to all enrolled members!' });
    }

    // Action: Create Exchange Report Entry
    if (action === 'createReport' && operationId) {
      const { thankYouText, photoUrl } = body as { thankYouText?: string; photoUrl?: string };

      const ex = await db.exchange.findUnique({ where: { id: operationId } });
      if (!ex) return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });

      const newReport = await db.exchangeReport.create({
        data: {
          exchangeId: operationId,
          userId: activeUserId,
          thankYouText: thankYouText?.trim(),
          photoUrl: photoUrl?.trim(),
        },
        include: {
          user: { select: { id: true, name: true, codename: true } },
        },
      });

      return NextResponse.json({ success: true, message: 'Exchange Report entry posted!', data: newReport });
    }

    if (!config) {
      return NextResponse.json({ error: 'Configuration input is required' }, { status: 400 });
    }

    // Validate Configuration
    const validation = validateOperationConfig(config);
    if (!validation.isValid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
    }

    // Hardening S2: SaaS Quota Server Environment Variable Check
    const isSaasMode = process.env.SAAS_MODE === 'true' || process.env.NEXT_PUBLIC_SAAS_MODE === 'true';
    let paymentStatus: 'FREE_ANNUAL' | 'PAID' | 'EXEMPT_SELF_HOSTED' = 'EXEMPT_SELF_HOSTED';
    let isFreeAnnualExchange = false;

    if (isSaasMode) {
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);
      const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`);

      const existingAnnualEx = await db.exchange.findFirst({
        where: {
          organizerId: activeUserId,
          createdAt: {
            gte: startOfYear,
            lte: endOfYear,
          },
          isFreeAnnualExchange: true,
        },
      });

      if (!existingAnnualEx) {
        paymentStatus = 'FREE_ANNUAL';
        isFreeAnnualExchange = true;
      } else {
        paymentStatus = 'PAID';
        isFreeAnnualExchange = false;
      }
    }

    // Generate Cryptographically Secure Unique Invite Code (e.g. K9X2-R7M4)
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await db.exchange.findUnique({ where: { code: inviteCode } });
      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    // Create Exchange Transaction
    const newExchange = await db.exchange.create({
      data: {
        title: config.title.trim(),
        description: config.description?.trim(),
        code: inviteCode,
        organizerId: activeUserId,
        maxParticipants: config.maxParticipants,
        giftingType: config.giftingType,
        isLocalOnly: config.isLocalOnly,
        eventLocation: config.eventLocation?.trim(),
        isWhiteElephant: config.isWhiteElephant,
        budgetMin: config.budgetMin,
        budgetMax: config.budgetMax,
        currency: config.currency || 'USD',
        inviteCutoffDate: new Date(config.inviteCutoffDate),
        assignmentDate: new Date(config.assignmentDate),
        shippingDate: new Date(config.shippingDate),
        executionDate: new Date(config.executionDate),
        isFreeAnnualExchange,
        enforcePenalties: config.enforcePenalties !== undefined ? config.enforcePenalties : true,
        paymentStatus,
        members: {
          create: {
            userId: activeUserId,
            role: 'ORGANIZER',
          },
        },
      },
      include: {
        organizer: {
          select: { id: true, name: true, codename: true },
        },
        members: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: newExchange,
      quotaInfo: {
        isSaasMode,
        isFreeAnnualOp: isFreeAnnualExchange,
        paymentStatus,
        requiresPayment: isSaasMode && paymentStatus === 'PAID',
      },
    });
  } catch (err) {
    console.error('API Error in POST /api/operations:', err);
    return NextResponse.json({ error: 'Failed to create exchange' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const sessionUserId = await getSessionUserId();

    const {
      userId: bodyUserId,
      operationId,
      action,
      dates,
      settings,
      agentId: memberId,
      newRole,
      targetUserId,
      demeritPoints,
    } = body as {
      userId?: string;
      operationId: string;
      action?: 'update_dates' | 'update_settings' | 'update_agent_role' | 'remove_agent' | 'issue_demerit' | 'nudge_agent';
      dates?: {
        inviteCutoffDate: string;
        assignmentDate: string;
        shippingDate: string;
        executionDate: string;
      };
      settings?: {
        title?: string;
        description?: string;
        budgetMin?: number;
        budgetMax?: number;
        maxParticipants?: number;
        isLocalOnly?: boolean;
        eventLocation?: string;
        isWhiteElephant?: boolean;
        enforcePenalties?: boolean;
      };
      agentId?: string;
      newRole?: string;
      targetUserId?: string;
      demeritPoints?: number;
    };

    const activeUserId = sessionUserId || bodyUserId;

    if (!activeUserId || !operationId) {
      return NextResponse.json({ error: 'Authentication and operationId are required' }, { status: 400 });
    }

    const ex = await db.exchange.findUnique({
      where: { id: operationId },
    });

    if (!ex) {
      return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
    }

    if (ex.organizerId !== activeUserId) {
      return NextResponse.json({ error: 'Only the designated Organizer can perform administrative actions' }, { status: 403 });
    }

    // Member Action 1: Update Member Role (Promote / Demote Organizer)
    if (action === 'update_agent_role' && memberId && newRole) {
      const updatedMember = await db.exchangeMember.update({
        where: { id: memberId },
        data: { role: newRole === 'ORGANIZER' || newRole === 'OPS_LEADER' ? 'ORGANIZER' : 'MEMBER' },
      });
      return NextResponse.json({ success: true, data: updatedMember });
    }

    // Member Action 2: Remove Member from Exchange
    if (action === 'remove_agent' && memberId) {
      const memberToDelete = await db.exchangeMember.findUnique({ where: { id: memberId } });
      if (!memberToDelete) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }
      if (memberToDelete.userId === ex.organizerId) {
        return NextResponse.json({ error: 'Cannot remove the primary Organizer from the exchange' }, { status: 400 });
      }
      await db.exchangeMember.delete({ where: { id: memberId } });
      return NextResponse.json({ success: true, message: 'Member removed from exchange' });
    }

    // Member Action 3: Issue Penalty Citation
    if (action === 'issue_demerit' && targetUserId) {
      const pts = demeritPoints || 1;
      const updatedUser = await db.user.update({
        where: { id: targetUserId },
        data: { penaltyPoints: { increment: pts } },
      });
      return NextResponse.json({ success: true, message: `Issued ${pts} penalty point(s)`, totalDemerits: updatedUser.penaltyPoints });
    }

    // Member Action 4: Dispatch Nudge Reminder
    if (action === 'nudge_agent' && memberId) {
      const memberToNudge = await db.exchangeMember.findUnique({
        where: { id: memberId },
        include: { user: true, exchange: { include: { organizer: true } } },
      });

      if (!memberToNudge) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      const nudgeMsg = 'Reminder: Please update your OpKit wishlist and review mission directives.';

      // Create in-app notification
      await db.notification.create({
        data: {
          userId: memberToNudge.userId,
          title: `🔔 Mission Nudge: ${memberToNudge.exchange.title}`,
          message: nudgeMsg,
          exchangeId: memberToNudge.exchangeId,
        },
      });

      // Dispatch Email Alert if user has email notifications enabled
      if (memberToNudge.user.email && memberToNudge.user.emailNotifications !== false) {
        sendNudgeEmail({
          recipientEmail: memberToNudge.user.email,
          recipientName: memberToNudge.user.name || memberToNudge.user.codename || 'Operative',
          organizerName: memberToNudge.exchange.organizer.name,
          exchangeTitle: memberToNudge.exchange.title,
          message: nudgeMsg,
          actionUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/exchange/${memberToNudge.exchange.code}`,
        }).catch((e) => console.warn('[EMAIL WARNING] Nudge email dispatch error:', e));
      }

      return NextResponse.json({ success: true, message: 'Nudge alert and email dispatched to member' });
    }

    // Branch 1: Update Exchange Settings & Options
    if (action === 'update_settings' || settings) {
      if (!settings) {
        return NextResponse.json({ error: 'Settings payload is required' }, { status: 400 });
      }

      // IMMUTABILITY GUARD: Gifting Type cannot be changed after creation
      if (settings.isWhiteElephant !== undefined && settings.isWhiteElephant !== ex.isWhiteElephant) {
        return NextResponse.json({
          error: 'Exchange Gifting Type (Secret Santa vs White Elephant) is fixed upon creation and cannot be changed.',
        }, { status: 400 });
      }

      // Local Event Rule: Location required when isLocalOnly is true
      if (settings.isLocalOnly && (!settings.eventLocation || !settings.eventLocation.trim())) {
        return NextResponse.json({
          error: 'Local events require an in-person event location address.',
        }, { status: 400 });
      }

      // Budget Validation
      if (settings.budgetMax !== undefined && settings.budgetMax <= 0) {
        return NextResponse.json({ error: 'Maximum budget must be greater than $0' }, { status: 400 });
      }
      if (settings.budgetMin !== undefined && settings.budgetMax !== undefined && settings.budgetMin > settings.budgetMax) {
        return NextResponse.json({ error: 'Minimum budget cannot exceed maximum budget' }, { status: 400 });
      }

      const updatedExchange = await db.exchange.update({
        where: { id: operationId },
        data: {
          title: settings.title !== undefined ? settings.title.trim() : ex.title,
          description: settings.description !== undefined ? settings.description.trim() : ex.description,
          budgetMin: settings.budgetMin !== undefined ? Number(settings.budgetMin) : ex.budgetMin,
          budgetMax: settings.budgetMax !== undefined ? Number(settings.budgetMax) : ex.budgetMax,
          maxParticipants: settings.maxParticipants !== undefined ? (settings.maxParticipants ? Number(settings.maxParticipants) : null) : ex.maxParticipants,
          isLocalOnly: settings.isLocalOnly !== undefined ? settings.isLocalOnly : ex.isLocalOnly,
          eventLocation: settings.eventLocation !== undefined ? settings.eventLocation.trim() : ex.eventLocation,
          enforcePenalties: settings.enforcePenalties !== undefined ? settings.enforcePenalties : ex.enforcePenalties,
        },
      });

      return NextResponse.json({ success: true, data: updatedExchange });
    }

    // Branch 2: Update Timeline Dates
    if (dates) {
      const validation = validateOperationConfig({
        title: ex.title,
        giftingType: ex.giftingType as any,
        isLocalOnly: ex.isLocalOnly,
        isWhiteElephant: ex.isWhiteElephant,
        budgetMax: Number(ex.budgetMax),
        ...dates,
      });

      if (!validation.isValid) {
        return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
      }

      const updatedExchange = await db.exchange.update({
        where: { id: operationId },
        data: {
          inviteCutoffDate: new Date(dates.inviteCutoffDate),
          assignmentDate: new Date(dates.assignmentDate),
          shippingDate: new Date(dates.shippingDate),
          executionDate: new Date(dates.executionDate),
        },
      });

      return NextResponse.json({ success: true, data: updatedExchange });
    }

    return NextResponse.json({ error: 'No valid action or update payload provided' }, { status: 400 });
  } catch (err) {
    console.error('API Error in PATCH /api/operations:', err);
    return NextResponse.json({ error: 'Failed to update exchange' }, { status: 500 });
  }
}
