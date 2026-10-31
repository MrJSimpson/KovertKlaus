import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/adminDb';
import { dbUnavailableResponse, isDbConnectionError } from '@/lib/db-errors';
import { getSessionUserId } from '@/lib/auth';
import { resolveSettingsUpdate, validateOperationConfig, CreateOperationInput } from '@/lib/validations/operation';
import { getPlatformSettings, hostedMissionLimitError, missionJoinError } from '@/lib/platform-limits';
import { generateInviteCode } from '@/lib/security';
import { executeTargetSwap } from '@/lib/draw';
import { runManualDraw } from '@/lib/manual-draw';
import { sendAssignmentEmail, sendMissionCancelledEmail, sendNudgeEmail } from '@/lib/email';
import { cancelMission, closedMissionGuard, deleteMission, isMissionClosed, MISSION_CLOSED_RESULT } from '@/lib/mission-cancel';
import { isRosterLocked, timelineRepairUpdate, visibleRepairIssues } from '@/lib/mission-repair';
import { IS_SAAS } from '@/lib/config/mode';
import {
  generateKdmToken,
  verifyGiverIdentityGuess,
  evaluateCovertOutcome,
  BADGE_KOVERT_KLAUS,
  BADGE_VIGILANT_ELF,
} from '@/lib/covertDelivery';
import { processExchangeAudit } from '@/lib/audit-runner';
import { EXCHANGE_MEMBERS_INCLUDE, memberCodenameMap, memberWishlistMap, sanitizeExchangeMember, sanitizeMissionReports } from '@/lib/exchange-view';
import { validateReportInput } from '@/lib/validations/report';
import { resolveTimelineUpdate } from '@/lib/validations/timeline';
import { dispatchNudge } from '@/lib/nudge';
import { drawCodename, enrollWithCodename } from '@/lib/codename';
import { deleteMemberWishlistItems, memberWishlistCreate } from '@/lib/mission-wishlist';
import { exclusionRuleProblemForMission, removeMemberExclusionRules } from '@/lib/exclusion-rules';

export const dynamic = 'force-dynamic';


export async function GET(request: Request) {

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const activeUserId = await getSessionUserId();

    // Case 1: Fetch single exchange by unique invite code (e.g. KOVERT-87WZ)
    if (code) {
      const exchange = await db.exchange.findUnique({
        where: { code: code.trim().toUpperCase() },
        include: {
          organizer: {
            select: { id: true, name: true },
          },
          members: { include: EXCHANGE_MEMBERS_INCLUDE },
          exclusionRules: {
            include: {
              member: { select: { id: true, name: true } },
              restrictedMember: { select: { id: true, name: true } },
            },
          },
          reports: {
            include: {
              user: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          covertInviteTokens: true,
        },
      });

      if (!exchange) {
        return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
      }

      // Security Invariant (Finding 2.1): Sanitize targetUser and physical addresses server-side.
      // Only the exchange organizer or the specific assigned giver may view a member's target details and shipping address.
      const isOrganizer = Boolean(activeUserId && exchange.organizerId === activeUserId);

      const memberCodenames = memberCodenameMap(exchange.members);
      const memberWishlists = memberWishlistMap(exchange.members);

      const viewer = { activeUserId, isOrganizer, organizerId: exchange.organizerId, memberCodenames, memberWishlists };
      const sanitizedMembers = exchange.members.map((m) => sanitizeExchangeMember(m, viewer));

      const sanitizedData = {
        ...exchange,
        members: sanitizedMembers,
        reports: sanitizeMissionReports(exchange.reports, viewer),
        // Preventative exclusion rules and invite tokens are strictly visible only to the Head Elf
        exclusionRules: isOrganizer ? exchange.exclusionRules : [],
        repairIssues: visibleRepairIssues(exchange.repairIssues, activeUserId, isOrganizer),
        covertInviteTokens: isOrganizer ? exchange.covertInviteTokens : [],
      };

      return NextResponse.json({ success: true, data: sanitizedData });
    }

    // Case 2: Fetch all exchanges enrolled/owned by authenticated user
    if (!activeUserId) {
      return NextResponse.json({ error: 'Authentication is required' }, { status: 401 });
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
          select: { id: true, name: true },
        },
        members: {
          select: { id: true, userId: true, role: true, shippingStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: exchanges });
  } catch (err: unknown) {
    console.error('API Error in GET /api/operations:', err);
    if (isDbConnectionError(err)) return dbUnavailableResponse();
    // Never echo internal error text (DB/Prisma messages) to clients; it is logged above.
    return NextResponse.json({ error: 'Failed to load missions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const activeUserId = await getSessionUserId();
    
    const { config, action, operationId, forceUnlock } = body as {
      config?: CreateOperationInput;
      action?: string;
      operationId?: string;
      forceUnlock?: boolean;
    };

    if (!activeUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Cancelled missions are read-only; deleting one is the only action left.
    if (operationId && action !== 'deleteMission') {
      const closed = await closedMissionGuard(db, operationId);
      if (closed) return NextResponse.json(closed.body, { status: closed.status });
    }

    // Action: Cancel the mission (Head Elf). Every agent is notified and emailed.
    if (action === 'cancelMission' && operationId) {
      const result = await cancelMission(
        db,
        {
          baseUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://kovertklaus.com',
          sendEmail: (email) => sendMissionCancelledEmail(email),
        },
        { exchangeId: operationId, actor: 'HEAD_ELF', actorUserId: activeUserId, reason: (body as { reason?: unknown }).reason }
      );
      return NextResponse.json(result.body, { status: result.status });
    }

    // Action: Permanently delete a cancelled mission (Head Elf, 48 h after a pre-draw cancellation).
    if (action === 'deleteMission' && operationId) {
      const result = await deleteMission(db, {
        exchangeId: operationId,
        actor: 'HEAD_ELF',
        actorUserId: activeUserId,
        confirm: (body as { confirm?: unknown }).confirm,
      });
      return NextResponse.json(result.body, { status: result.status });
    }

    // Action: Trigger Target Draw (shared with the worker: src/lib/manual-draw.ts)
    if (action === 'draw' && operationId) {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const result = await runManualDraw(
        db,
        { exchangeUrl: (code) => `${baseUrl}/exchange/${code}`, sendAssignmentEmail: (email) => sendAssignmentEmail(email) },
        { exchangeId: operationId, userId: activeUserId, forceUnlock }
      );
      return NextResponse.json(result.body, { status: result.status });
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

        await db.$transaction(async (tx) => {
          for (const assignment of updatedAssignments) {
            const memberRecord = ex.members.find((a) => a.userId === assignment.agentId);
            if (!memberRecord) continue;
            await tx.exchangeMember.update({
              where: { id: memberRecord.id },
              data: { targetUserId: assignment.targetId },
            });
          }
        });

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

      const enrolledCount = await db.exchangeMember.count({
        where: { exchangeId: operationId, userId: { in: [memberId, restrictedMemberId] } },
      });
      if (enrolledCount !== 2) {
        return NextResponse.json({ error: 'Both agents must be enrolled in this operation' }, { status: 400 });
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

      const ruleProblem = await exclusionRuleProblemForMission(db, ex, { agentId: memberId, restrictedAgentId: restrictedMemberId });
      if (ruleProblem) return NextResponse.json({ error: ruleProblem }, { status: 409 });

      const newRule = await db.exclusionRule.create({
        data: {
          exchangeId: operationId,
          memberId,
          restrictedMemberId,
        },
        include: {
          member: { select: { id: true, name: true } },
          restrictedMember: { select: { id: true, name: true } },
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

      // Scoped to this exchange: an organizer can only remove their own mission's rules.
      const removed = await db.exclusionRule.deleteMany({ where: { id: exclusionId, exchangeId: operationId } });
      if (removed.count === 0) return NextResponse.json({ error: 'Preventative match rule not found' }, { status: 404 });

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
      const ex = await db.exchange.findUnique({
        where: { id: operationId },
        include: { members: { include: { user: true } } },
      });
      if (!ex) return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
      if (ex.organizerId !== activeUserId) return NextResponse.json({ error: 'Only Organizer can end exchange' }, { status: 403 });

      const { applyDemerits } = body as { applyDemerits?: boolean };

      let auditResults = null;
      if (applyDemerits && ex.enforcePenalties !== false) {
        auditResults = await processExchangeAudit(db, ex);
      } else {
        await db.exchange.update({
          where: { id: operationId },
          data: {
            executionDate: new Date(),
            status: 'COMPLETED',
            completedAt: ex.completedAt ?? new Date(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: auditResults
          ? `Operation completed and demerit audit applied across ${ex.members.length} operatives!`
          : 'Exchange successfully ended! Status updated to COMPLETED.',
        auditResults,
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

      await db.notification.createMany({
        data: ex.members.map((member) => ({
          userId: member.userId,
          title: `📢 Exchange Broadcast: ${ex.title}`,
          message: messageText.trim(),
          exchangeId: ex.id,
        })),
      });

      for (const member of ex.members) {
        if (member.user.email && member.user.emailNotifications !== false) {
          sendNudgeEmail({
            recipientEmail: member.user.email,
            recipientName: member.user.name || 'Operative',
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

      const reportError = validateReportInput(thankYouText, photoUrl);
      if (reportError) return NextResponse.json({ error: reportError }, { status: 400 });

      const ex = await db.exchange.findUnique({ where: { id: operationId } });
      if (!ex) return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });

      // After-Action Report entries are for enrolled agents only.
      const member = await db.exchangeMember.findUnique({
        where: { exchangeId_userId: { exchangeId: operationId, userId: activeUserId } },
      });
      if (!member) return NextResponse.json({ error: 'Only enrolled agents can post to this After-Action Report' }, { status: 403 });

      const newReport = await db.exchangeReport.create({
        data: {
          exchangeId: operationId,
          userId: activeUserId,
          thankYouText: thankYouText?.trim(),
          photoUrl: photoUrl?.trim(),
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({ success: true, message: 'Exchange Report entry posted!', data: newReport });
    }

    // Action: Generate KDM Invitation Tokens
    if (action === 'createKdmTokens' && operationId) {
      const { count = 5, invitedNames = [] } = body as { count?: number; invitedNames?: string[] };
      const ex = await db.exchange.findUnique({ where: { id: operationId } });
      if (!ex) return NextResponse.json({ error: 'Exchange not found' }, { status: 404 });
      if (ex.organizerId !== activeUserId) {
        return NextResponse.json({ error: 'Only the Organizer can generate KDM invitation keys' }, { status: 403 });
      }

      const numTokens = Math.min(Math.max(1, count), 50);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60); // 60 days
      const tokensToInsert = Array.from({ length: numTokens }).map((_, i) => ({
        exchangeId: operationId,
        token: generateKdmToken(),
        invitedName: invitedNames[i]?.trim() || null,
        expiresAt,
      }));

      await db.covertInviteToken.createMany({
        data: tokensToInsert,
      });

      const allTokens = await db.covertInviteToken.findMany({
        where: { exchangeId: operationId },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ success: true, data: allTokens });
    }

    // Action: Join Exchange with KDM Token and Property Access Waiver
    if (action === 'joinWithKdmToken') {
      const { token, propertyWaiverAgreed } = body as {
        token?: string;
        propertyWaiverAgreed?: boolean;
      };

      if (!token?.trim()) {
        return NextResponse.json({ error: 'KDM Invitation Key is required' }, { status: 400 });
      }

      if (!propertyWaiverAgreed) {
        return NextResponse.json({
          error: 'You must review and agree to the Property Access & Safe Conduct Accord to join a Kovert Delivery Operation.',
        }, { status: 400 });
      }

      const cleanToken = token.trim().toUpperCase();
      const inviteToken = await db.covertInviteToken.findUnique({
        where: { token: cleanToken },
        include: { exchange: true },
      });

      if (!inviteToken) {
        return NextResponse.json({ error: 'Invalid or unrecognized KDM invitation key' }, { status: 404 });
      }

      if (inviteToken.isUsed) {
        return NextResponse.json({ error: 'This KDM invitation key has already been redeemed' }, { status: 410 });
      }

      if (new Date() > inviteToken.expiresAt) {
        return NextResponse.json({ error: 'This KDM invitation key has expired' }, { status: 410 });
      }

      // Check if user is already enrolled
      const existingMember = await db.exchangeMember.findUnique({
        where: {
          exchangeId_userId: {
            exchangeId: inviteToken.exchangeId,
            userId: activeUserId,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json({ error: 'You are already enrolled in this mission', exchangeCode: inviteToken.exchange.code }, { status: 409 });
      }

      const memberCount = await db.exchangeMember.count({ where: { exchangeId: inviteToken.exchangeId } });
      const full = missionJoinError(inviteToken.exchange, memberCount, await getPlatformSettings(adminDb));
      if (full) return NextResponse.json({ error: full }, { status: 400 });

      // Enroll member and consume single-use token in transaction
      const [newMember] = await enrollWithCodename(db, inviteToken.exchangeId, (codename) =>
        db.$transaction(async (tx) => [
          await tx.exchangeMember.create({
            data: {
              exchangeId: inviteToken.exchangeId,
              userId: activeUserId,
              codename,
              propertyWaiverAgreedAt: new Date(),
              wishlist: memberWishlistCreate(activeUserId, inviteToken.exchange.isWhiteElephant),
            },
          }),
          await tx.covertInviteToken.update({
            where: { id: inviteToken.id },
            data: {
              isUsed: true,
              usedByUserId: activeUserId,
            },
          }),
        ])
      );

      return NextResponse.json({
        success: true,
        message: 'Successfully enrolled in Kovert Delivery Operation!',
        exchangeCode: inviteToken.exchange.code,
        member: newMember,
      });
    }

    // Action: Giver Submits Drop Site Proof
    if (action === 'submitDropProof' && operationId) {
      const { dropProofPhotoUrl, dropProofNote } = body as {
        dropProofPhotoUrl?: string;
        dropProofNote?: string;
      };

      if (!dropProofPhotoUrl?.trim()) {
        return NextResponse.json({ error: 'Drop site photo is required' }, { status: 400 });
      }

      const member = await db.exchangeMember.findUnique({
        where: {
          exchangeId_userId: {
            exchangeId: operationId,
            userId: activeUserId,
          },
        },
      });

      if (!member) {
        return NextResponse.json({ error: 'Member enrollment not found' }, { status: 404 });
      }

      const updated = await db.exchangeMember.update({
        where: { id: member.id },
        data: {
          dropProofPhotoUrl: dropProofPhotoUrl.trim(),
          dropProofNote: dropProofNote?.trim() || null,
          droppedAt: new Date(),
          shippingStatus: 'LOCAL_DELIVERY',
          deliveredConfirmed: true,
        },
      });

      return NextResponse.json({ success: true, message: 'Drop site photo and stash clue logged!', data: updated });
    }

    // Action: Target Submits 1-Guess Real Name Identity Challenge
    if (action === 'submitIdentityChallenge' && operationId) {
      const { guessedName } = body as { guessedName?: string };

      if (!guessedName?.trim()) {
        return NextResponse.json({ error: 'You must provide a first and last name for your guess' }, { status: 400 });
      }

      // Find the target member (active user)
      const targetMember = await db.exchangeMember.findUnique({
        where: {
          exchangeId_userId: {
            exchangeId: operationId,
            userId: activeUserId,
          },
        },
      });

      if (!targetMember) {
        return NextResponse.json({ error: 'Member record not found' }, { status: 404 });
      }

      if (targetMember.targetGuessAttempted) {
        return NextResponse.json({
          error: 'Your 1-time guess has already been used for this mission.',
        }, { status: 409 });
      }

      // Find the secret giver who was assigned this target
      const giverMember = await db.exchangeMember.findFirst({
        where: {
          exchangeId: operationId,
          targetUserId: activeUserId,
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      });

      if (!giverMember) {
        return NextResponse.json({ error: 'Assigned Secret Santa not found for target' }, { status: 404 });
      }

      const isCorrect = verifyGiverIdentityGuess(guessedName, giverMember.user.name);

      const outcome = evaluateCovertOutcome({
        targetGuessAttempted: true,
        targetGuessCorrect: isCorrect,
      });

      // Update target member record with guess state and resolved badge
      const updated = await db.exchangeMember.update({
        where: { id: targetMember.id },
        data: {
          targetGuessName: guessedName.trim(),
          targetGuessAttempted: true,
          targetGuessCorrect: isCorrect,
          detectionStatus: outcome.status,
          badgeAwarded: outcome.badgeAwarded,
        },
      });

      return NextResponse.json({
        success: true,
        correct: isCorrect,
        canUploadEvidence: isCorrect,
        status: outcome.status,
        badgeAwarded: outcome.badgeAwarded,
        data: updated,
      });
    }

    // Action: Target Uploads Busted Ring Camera Evidence
    if (action === 'submitBustedEvidence' && operationId) {
      const { bustedPhotoUrl, bustedReason } = body as {
        bustedPhotoUrl?: string;
        bustedReason?: string;
      };

      if (!bustedPhotoUrl?.trim()) {
        return NextResponse.json({ error: 'Evidence camera photo is required' }, { status: 400 });
      }

      const targetMember = await db.exchangeMember.findUnique({
        where: {
          exchangeId_userId: {
            exchangeId: operationId,
            userId: activeUserId,
          },
        },
      });

      if (!targetMember) return NextResponse.json({ error: 'Member record not found' }, { status: 404 });

      if (!targetMember.targetGuessCorrect) {
        return NextResponse.json({
          error: 'Cannot upload evidence without successfully identifying the Santa by name.',
        }, { status: 403 });
      }

      const updated = await db.exchangeMember.update({
        where: { id: targetMember.id },
        data: {
          bustedPhotoUrl: bustedPhotoUrl.trim(),
          bustedReason: bustedReason?.trim() || null,
          detectionStatus: 'BUSTED',
          badgeAwarded: BADGE_VIGILANT_ELF,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Evidence logged! Operative officially BUSTED.',
        data: updated,
      });
    }

    // Action: Confirm Ghost Drop (Undetected)
    if (action === 'confirmGhostDrop' && operationId) {
      const targetMember = await db.exchangeMember.findUnique({
        where: {
          exchangeId_userId: {
            exchangeId: operationId,
            userId: activeUserId,
          },
        },
      });

      if (!targetMember) return NextResponse.json({ error: 'Member record not found' }, { status: 404 });

      const updated = await db.exchangeMember.update({
        where: { id: targetMember.id },
        data: {
          detectionStatus: 'UNDETECTED',
          badgeAwarded: BADGE_KOVERT_KLAUS,
          deliveredConfirmed: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Ghost delivery confirmed! Giver awarded Kovert Klaus badge.',
        data: updated,
      });
    }

    if (!config) {
      return NextResponse.json({ error: 'Configuration input is required' }, { status: 400 });
    }

    // Validate Configuration
    const platform = await getPlatformSettings(adminDb);
    const validation = validateOperationConfig(config, platform.maxMissionAgents);
    if (!validation.isValid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
    }
    const hostedLimit = await hostedMissionLimitError(db, activeUserId, platform);
    if (hostedLimit) return NextResponse.json({ error: hostedLimit }, { status: 403 });

    // Hardening S2: SaaS Quota Server Environment Variable Check
    const isSaasMode = IS_SAAS;
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
        allowWishlistOverBudget: config.allowWishlistOverBudget !== undefined ? Boolean(config.allowWishlistOverBudget) : true,
        paymentStatus,
        members: {
          create: {
            userId: activeUserId,
            role: 'ORGANIZER',
            // The roster is empty, so any pool name is free.
            codename: drawCodename([]),
            wishlist: memberWishlistCreate(activeUserId, Boolean(config.isWhiteElephant)),
          },
        },
      },
      include: {
        organizer: {
          select: { id: true, name: true },
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
    const activeUserId = await getSessionUserId();

    const {
      operationId,
      action,
      dates,
      settings,
      agentId: memberId,
      targetUserId,
      demeritPoints,
    } = body as {
      operationId: string;
      action?: 'update_dates' | 'update_settings' | 'remove_agent' | 'issue_demerit' | 'nudge_agent';
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
        allowWishlistOverBudget?: boolean;
      };
      agentId?: string;
      targetUserId?: string;
      demeritPoints?: number;
    };

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

    if (isMissionClosed(ex.status)) {
      return NextResponse.json(MISSION_CLOSED_RESULT.body, { status: MISSION_CLOSED_RESULT.status });
    }

    // Member-scoped actions must target a member of THIS exchange, never an arbitrary row.
    const findScopedMember = (id: string) =>
      db.exchangeMember.findFirst({ where: { id, exchangeId: operationId } });

    // Member Action: Remove Member from Exchange
    if (action === 'remove_agent' && memberId) {
      const memberToDelete = await findScopedMember(memberId);
      if (!memberToDelete) {
        return NextResponse.json({ error: 'Member not found in this operation' }, { status: 404 });
      }
      if (memberToDelete.userId === ex.organizerId) {
        return NextResponse.json({ error: 'Cannot remove the primary Organizer from the exchange' }, { status: 400 });
      }
      if (isRosterLocked(ex.status)) {
        return NextResponse.json({ error: 'Agents are locked in once the draw has happened.' }, { status: 409 });
      }
      await deleteMemberWishlistItems(db, memberToDelete.id);
      await db.exchangeMember.delete({ where: { id: memberToDelete.id } });
      const ruleWarning = await removeMemberExclusionRules(db, ex, memberToDelete.userId);
      return NextResponse.json({ success: true, message: 'Member removed from exchange', ...(ruleWarning ? { warning: ruleWarning } : {}) });
    }

    // Member Action 3: Issue Penalty Citation (one per call, enrolled agents only, waivers honored)
    if (action === 'issue_demerit' && targetUserId) {
      if (!ex.enforcePenalties) {
        return NextResponse.json({ error: 'Demerits are disabled for this operation' }, { status: 400 });
      }
      if (ex.status !== 'COMPLETED') {
        return NextResponse.json({ error: 'Demerits can only be assigned when the mission is completed' }, { status: 400 });
      }
      const targetMember = await db.exchangeMember.findUnique({
        where: { exchangeId_userId: { exchangeId: operationId, userId: targetUserId } },
      });
      if (!targetMember) {
        return NextResponse.json({ error: 'Agent is not enrolled in this operation' }, { status: 404 });
      }
      // Carrier Protection Waiver: verified delivery or a carrier tracking number grants immunity.
      if (targetMember.deliveredConfirmed || targetMember.trackingNumber) {
        return NextResponse.json({ error: 'Demerit Waiver Active: this agent has verified delivery or carrier tracking.' }, { status: 400 });
      }

      const pts = 1;
      const updatedUser = await db.user.update({
        where: { id: targetUserId },
        data: { penaltyPoints: { increment: pts } },
      });
      return NextResponse.json({ success: true, message: `Issued ${pts} penalty point(s)`, totalDemerits: updatedUser.penaltyPoints });
    }

    // Member Action 4: Dispatch Nudge Reminder
    if (action === 'nudge_agent' && memberId) {
      const scoped = await findScopedMember(memberId);
      if (!scoped) {
        return NextResponse.json({ error: 'Member not found in this operation' }, { status: 404 });
      }
      const memberToNudge = await db.exchangeMember.findUnique({
        where: { id: scoped.id },
        include: { user: true, exchange: { include: { organizer: true } } },
      });

      if (!memberToNudge) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      const result = await dispatchNudge(db, {
        baseUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        sendEmail: (email) => sendNudgeEmail(email),
      }, memberToNudge);
      return NextResponse.json(result.body, { status: result.status });
    }

    // Branch 1: Update Exchange Settings & Options
    if (action === 'update_settings' || settings) {
      if (!settings) {
        return NextResponse.json({ error: 'Settings payload is required' }, { status: 400 });
      }

      // Same merge and rules as the edge worker (src/lib/validations/operation.ts).
      const memberCount = await db.exchangeMember.count({ where: { exchangeId: operationId } });
      const update = resolveSettingsUpdate(ex, settings, memberCount, (await getPlatformSettings(adminDb)).maxMissionAgents);
      if (!update.ok) return NextResponse.json({ error: update.errors[0], details: update.errors }, { status: 400 });

      const updatedExchange = await db.exchange.update({ where: { id: operationId }, data: update.data });

      return NextResponse.json({ success: true, data: updatedExchange });
    }

    // Branch 2: Update Timeline Dates
    if (dates) {
      // Only the dates that change are checked against today (src/lib/validations/timeline.ts).
      const change = resolveTimelineUpdate(ex, dates, new Date());
      if (!change.ok) {
        return NextResponse.json({ error: change.error, details: [change.error] }, { status: change.status });
      }
      if (Object.keys(change.data).length === 0) {
        return NextResponse.json({ success: true, data: ex });
      }
      // Moving Target Draw later lifts a repair pause (src/lib/mission-repair.ts).
      const updatedExchange = await db.exchange.update({ where: { id: operationId }, data: { ...change.data, ...timelineRepairUpdate(ex, change.data) } });
      return NextResponse.json({ success: true, data: updatedExchange });
    }

    return NextResponse.json({ error: 'No valid action or update payload provided' }, { status: 400 });
  } catch (err) {
    console.error('API Error in PATCH /api/operations:', err);
    return NextResponse.json({ error: 'Failed to update exchange' }, { status: 500 });
  }
}
