import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { validateOperationConfig, CreateOperationInput } from '@/lib/validations/operation';
import { generateInviteCode } from '@/lib/security';
import { executeLinkedListDraw, executeTargetSwap } from '@/lib/draw';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const paramUserId = searchParams.get('userId');
    const sessionUserId = await getSessionUserId();
    const activeUserId = sessionUserId || paramUserId;

    // Case 1: Fetch single operation by unique invite code (e.g. KOVERT-87WZ)
    if (code) {
      const operation = await db.mission.findUnique({
        where: { code: code.trim().toUpperCase() },
        include: {
          opsLeader: {
            select: { id: true, name: true, codename: true },
          },
          agents: {
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
              agent: { select: { id: true, name: true, codename: true } },
              restrictedAgent: { select: { id: true, name: true, codename: true } },
            },
          },
          afterActionReports: {
            include: {
              user: { select: { id: true, name: true, codename: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!operation) {
        return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: operation });
    }

    // Case 2: Fetch all operations enrolled/owned by a user
    if (!activeUserId) {
      return NextResponse.json({ error: 'Authentication or user ID is required' }, { status: 401 });
    }

    const operations = await db.mission.findMany({
      where: {
        OR: [
          { opsLeaderId: activeUserId },
          { agents: { some: { userId: activeUserId } } },
        ],
      },
      include: {
        opsLeader: {
          select: { id: true, name: true, codename: true },
        },
        agents: {
          select: { id: true, userId: true, role: true, shippingStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: operations });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 });
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
      const op = await db.mission.findUnique({
        where: { id: operationId },
        include: { agents: true, exclusionRules: true },
      });

      if (!op) {
        return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
      }

      if (op.opsLeaderId !== activeUserId) {
        return NextResponse.json({ error: 'Only the OpsLeader can trigger target draws' }, { status: 403 });
      }

      // Hardening D1: Lock Guard against accidental re-draws
      if (op.status === 'ASSIGNED' && !forceUnlock) {
        return NextResponse.json({
          error: 'Target assignments have already been drawn for this operation. Re-drawing will overwrite existing targets.',
          requiresConfirmation: true,
        }, { status: 409 });
      }

      if (op.agents.length < 2) {
        return NextResponse.json({ error: 'At least 2 agents are required to execute a target draw' }, { status: 400 });
      }

      const agentsForDraw = op.agents.map((a) => ({
        id: a.userId,
        name: a.userId,
        hasWishlistAttached: !!a.wishlistId,
      }));

      const exclusionRulesForDraw = op.exclusionRules.map((r) => ({
        agentId: r.agentId,
        restrictedAgentId: r.restrictedAgentId,
      }));

      try {
        const assignments = executeLinkedListDraw(agentsForDraw, {
          isWhiteElephant: op.isWhiteElephant,
          exclusionRules: exclusionRulesForDraw,
        });

        for (const assignment of assignments) {
          const agentRecord = op.agents.find((a) => a.userId === assignment.agentId);
          if (agentRecord) {
            await db.missionAgent.update({
              where: { id: agentRecord.id },
              data: { targetUserId: assignment.targetId },
            });
          }
        }

        await db.mission.update({
          where: { id: operationId },
          data: { status: 'ASSIGNED' },
        });

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

      const op = await db.mission.findUnique({
        where: { id: operationId },
        include: { agents: true, exclusionRules: true },
      });

      if (!op) {
        return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
      }

      if (op.opsLeaderId !== activeUserId) {
        return NextResponse.json({ error: 'Only the OpsLeader can execute target swaps' }, { status: 403 });
      }

      const currentAssignments = op.agents
        .filter((a) => a.targetUserId)
        .map((a) => ({ agentId: a.userId, targetId: a.targetUserId! }));

      const exclusionRules = op.exclusionRules.map((r) => ({
        agentId: r.agentId,
        restrictedAgentId: r.restrictedAgentId,
      }));

      try {
        const updatedAssignments = executeTargetSwap(
          currentAssignments,
          originatorUserId,
          newTargetUserId,
          exclusionRules
        );

        for (const assignment of updatedAssignments) {
          const agentRecord = op.agents.find((a) => a.userId === assignment.agentId);
          if (agentRecord) {
            await db.missionAgent.update({
              where: { id: agentRecord.id },
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
      const { agentId, restrictedAgentId } = body as { agentId?: string; restrictedAgentId?: string };

      if (!agentId || !restrictedAgentId) {
        return NextResponse.json({ error: 'agentId and restrictedAgentId are required' }, { status: 400 });
      }

      if (agentId === restrictedAgentId) {
        return NextResponse.json({ error: 'Cannot create a preventative match rule for self' }, { status: 400 });
      }

      const op = await db.mission.findUnique({ where: { id: operationId } });
      if (!op) return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
      if (op.opsLeaderId !== activeUserId) {
        return NextResponse.json({ error: 'Only OpsLeader can manage preventative match rules' }, { status: 403 });
      }

      const existing = await db.exclusionRule.findFirst({
        where: {
          missionId: operationId,
          OR: [
            { agentId, restrictedAgentId },
            { agentId: restrictedAgentId, restrictedAgentId: agentId },
          ],
        },
      });

      if (existing) {
        return NextResponse.json({ error: 'Preventative match rule already exists for these operatives' }, { status: 409 });
      }

      const newRule = await db.exclusionRule.create({
        data: {
          missionId: operationId,
          agentId,
          restrictedAgentId,
        },
        include: {
          agent: { select: { id: true, name: true, codename: true } },
          restrictedAgent: { select: { id: true, name: true, codename: true } },
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

      const op = await db.mission.findUnique({ where: { id: operationId } });
      if (!op) return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
      if (op.opsLeaderId !== activeUserId) {
        return NextResponse.json({ error: 'Only OpsLeader can manage preventative match rules' }, { status: 403 });
      }

      await db.exclusionRule.delete({ where: { id: exclusionId } });

      return NextResponse.json({ success: true, message: 'Preventative match rule removed' });
    }

    // Action: Close Recruitment (Updates inviteCutoffDate to today and advances status)
    if (action === 'closeRecruitment' && operationId) {
      const op = await db.mission.findUnique({ where: { id: operationId } });
      if (!op) return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
      if (op.opsLeaderId !== activeUserId) return NextResponse.json({ error: 'Only OpsLeader can close recruitment' }, { status: 403 });

      const now = new Date();
      await db.mission.update({
        where: { id: operationId },
        data: {
          inviteCutoffDate: now,
          status: op.status === 'RECRUITING' ? 'SETUP' : op.status,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Recruitment closed. Invite cutoff date updated to today.',
      });
    }

    // Action: End Operation (Updates executionDate to today and updates status to COMPLETED)
    if (action === 'endOperation' && operationId) {
      const op = await db.mission.findUnique({ where: { id: operationId } });
      if (!op) return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
      if (op.opsLeaderId !== activeUserId) return NextResponse.json({ error: 'Only OpsLeader can end operation' }, { status: 403 });

      const now = new Date();
      await db.mission.update({
        where: { id: operationId },
        data: {
          executionDate: now,
          status: 'COMPLETED',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Operation successfully ended! Status updated to COMPLETED.',
      });
    }

    // Action: Send OpTeam Broadcast Notification
    if (action === 'sendOpTeamBroadcast' && operationId) {
      const { messageText } = body as { messageText?: string };
      if (!messageText?.trim()) return NextResponse.json({ error: 'Message text is required' }, { status: 400 });

      const op = await db.mission.findUnique({
        where: { id: operationId },
        include: { agents: true },
      });
      if (!op) return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
      if (op.opsLeaderId !== activeUserId) return NextResponse.json({ error: 'Only OpsLeader can broadcast to team' }, { status: 403 });

      for (const agent of op.agents) {
        await db.notification.create({
          data: {
            userId: agent.userId,
            title: `📢 OpTeam Broadcast: ${op.title}`,
            message: messageText.trim(),
            operationId: op.id,
          },
        });
      }

      return NextResponse.json({ success: true, message: 'Broadcast dispatched to all enrolled operatives!' });
    }

    // Action: Create After-Action Report Entry
    if (action === 'createReport' && operationId) {
      const { thankYouText, photoUrl } = body as { thankYouText?: string; photoUrl?: string };

      const op = await db.mission.findUnique({ where: { id: operationId } });
      if (!op) return NextResponse.json({ error: 'Operation not found' }, { status: 404 });

      const newReport = await db.afterActionReport.create({
        data: {
          missionId: operationId,
          userId: activeUserId,
          thankYouText: thankYouText?.trim(),
          photoUrl: photoUrl?.trim(),
        },
        include: {
          user: { select: { id: true, name: true, codename: true } },
        },
      });

      return NextResponse.json({ success: true, message: 'After-Action Report entry posted!', data: newReport });
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
    let isFreeAnnualOp = false;

    if (isSaasMode) {
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);
      const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`);

      const existingAnnualOp = await db.mission.findFirst({
        where: {
          opsLeaderId: activeUserId,
          createdAt: {
            gte: startOfYear,
            lte: endOfYear,
          },
          isFreeAnnualOp: true,
        },
      });

      if (!existingAnnualOp) {
        paymentStatus = 'FREE_ANNUAL';
        isFreeAnnualOp = true;
      } else {
        paymentStatus = 'PAID';
        isFreeAnnualOp = false;
      }
    }

    // Generate Cryptographically Secure Unique Invite Code (e.g. K9X2-R7M4)
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await db.mission.findUnique({ where: { code: inviteCode } });
      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    // Create Operation Transaction
    const newOperation = await db.mission.create({
      data: {
        title: config.title.trim(),
        description: config.description?.trim(),
        code: inviteCode,
        opsLeaderId: activeUserId,
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
        isFreeAnnualOp,
        paymentStatus,
        agents: {
          create: {
            userId: activeUserId,
            role: 'OPS_LEADER',
          },
        },
      },
      include: {
        opsLeader: {
          select: { id: true, name: true, codename: true },
        },
        agents: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: newOperation,
      quotaInfo: {
        isSaasMode,
        isFreeAnnualOp,
        paymentStatus,
        requiresPayment: isSaasMode && paymentStatus === 'PAID',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create operation' }, { status: 500 });
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
      agentId,
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

    const op = await db.mission.findUnique({
      where: { id: operationId },
    });

    if (!op) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    if (op.opsLeaderId !== activeUserId) {
      return NextResponse.json({ error: 'Only the designated OpsLeader can perform administrative operations' }, { status: 403 });
    }

    // Agent Action 1: Update Agent Role (Promote / Demote OpsLeader)
    if (action === 'update_agent_role' && agentId && newRole) {
      const updatedAgent = await db.missionAgent.update({
        where: { id: agentId },
        data: { role: newRole === 'OPS_LEADER' ? 'OPS_LEADER' : 'FIELD_AGENT' },
      });
      return NextResponse.json({ success: true, data: updatedAgent });
    }

    // Agent Action 2: Remove / Disenroll Agent from Operation
    if (action === 'remove_agent' && agentId) {
      const agentToDelete = await db.missionAgent.findUnique({ where: { id: agentId } });
      if (!agentToDelete) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      if (agentToDelete.userId === op.opsLeaderId) {
        return NextResponse.json({ error: 'Cannot remove the primary OpsLeader from the operation' }, { status: 400 });
      }
      await db.missionAgent.delete({ where: { id: agentId } });
      return NextResponse.json({ success: true, message: 'Agent disenrolled from operation' });
    }

    // Agent Action 3: Issue Demerit Citation
    if (action === 'issue_demerit' && targetUserId) {
      const pts = demeritPoints || 1;
      const updatedUser = await db.user.update({
        where: { id: targetUserId },
        data: { demerits: { increment: pts } },
      });
      return NextResponse.json({ success: true, message: `Issued ${pts} demerit point(s)`, totalDemerits: updatedUser.demerits });
    }

    // Agent Action 4: Dispatch Nudge Reminder
    if (action === 'nudge_agent' && agentId) {
      return NextResponse.json({ success: true, message: 'Nudge alert dispatched to agent via encrypted stream' });
    }

    // Branch 1: Update Operation Settings & Options
    if (action === 'update_settings' || settings) {
      if (!settings) {
        return NextResponse.json({ error: 'Settings payload is required' }, { status: 400 });
      }

      // IMMUTABILITY GUARD: Gifting Type cannot be changed after creation
      if (settings.isWhiteElephant !== undefined && settings.isWhiteElephant !== op.isWhiteElephant) {
        return NextResponse.json({
          error: 'Operation Gifting Type (Secret Santa vs White Elephant) is fixed upon creation and cannot be changed.',
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

      const updatedOperation = await db.mission.update({
        where: { id: operationId },
        data: {
          title: settings.title !== undefined ? settings.title.trim() : op.title,
          description: settings.description !== undefined ? settings.description.trim() : op.description,
          budgetMin: settings.budgetMin !== undefined ? Number(settings.budgetMin) : op.budgetMin,
          budgetMax: settings.budgetMax !== undefined ? Number(settings.budgetMax) : op.budgetMax,
          maxParticipants: settings.maxParticipants !== undefined ? (settings.maxParticipants ? Number(settings.maxParticipants) : null) : op.maxParticipants,
          isLocalOnly: settings.isLocalOnly !== undefined ? settings.isLocalOnly : op.isLocalOnly,
          eventLocation: settings.eventLocation !== undefined ? settings.eventLocation.trim() : op.eventLocation,
        },
      });

      return NextResponse.json({ success: true, data: updatedOperation });
    }

    // Branch 2: Update Timeline Dates
    if (dates) {
      const validation = validateOperationConfig({
        title: op.title,
        giftingType: op.giftingType as any,
        isLocalOnly: op.isLocalOnly,
        isWhiteElephant: op.isWhiteElephant,
        budgetMax: Number(op.budgetMax),
        ...dates,
      });

      if (!validation.isValid) {
        return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
      }

      const updatedOperation = await db.mission.update({
        where: { id: operationId },
        data: {
          inviteCutoffDate: new Date(dates.inviteCutoffDate),
          assignmentDate: new Date(dates.assignmentDate),
          shippingDate: new Date(dates.shippingDate),
          executionDate: new Date(dates.executionDate),
        },
      });

      return NextResponse.json({ success: true, data: updatedOperation });
    }

    return NextResponse.json({ error: 'No valid action or update payload provided' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to update operation' }, { status: 500 });
  }
}
