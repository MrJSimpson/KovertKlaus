/**
 * @file invitations.ts
 * @description Emailed mission invitations: send, list, decline/revoke, and mark accepted.
 *
 * Tier 1 (what): `sendMissionInvitation`, `listMyInvitations`, `listMissionInvitations`,
 * `updateInvitation` and `markInvitationAccepted` implement `/api/invitations` for both the edge
 * worker (SaaS) and the Next.js routes (self-hosted).
 * Tier 2 (why): Invites used to be fire-and-forget emails with nothing recorded, so an existing
 * user had nothing to accept or decline, and the Head Elf could not see who was still pending.
 * A `MissionInvitation` row per (mission, email) carries that state.
 * Tier 3 (how): Only the Head Elf invites. A new user's email links to
 * `/register?code=<mission>&email=<them>`; registering with a mission code is the alpha clearance
 * and auto-enrolls them. An existing user's email opens the mission page, where they accept
 * (through the normal join path) or decline; the dashboard shows the same choice. Enrollment by
 * any path calls `markInvitationAccepted`. Pending invites expire after the invite cutoff day
 * unless issued as a Late Pass (registered users only, after the cutoff). Sharing the plain
 * mission code still works and needs no invitation.
 */

import type { PrismaClient } from '@prisma/client';
import { isValidEmail } from '@/lib/security';
import { generateKdmToken } from '@/lib/covertDelivery';

const DAY_MS = 24 * 60 * 60 * 1000;

/** HTTP-shaped result shared by the worker and the Next routes. */
export interface InvitationResult {
  status: number;
  body: Record<string, unknown>;
}

/** What the caller's email sender receives (matches `InvitationEmailParams`). */
export interface InvitationEmail {
  recipientEmail: string;
  recipientName?: string;
  organizerName: string;
  exchangeTitle: string;
  inviteCode: string;
  joinUrl: string;
  budgetMin: number | null;
  budgetMax: number;
  isLatePass: boolean;
  isExistingUser: boolean;
  kdmToken?: string;
  isCovertDelivery: boolean;
}

/** Runtime-specific pieces: the public site URL and the email sender. */
export interface InvitationDeps {
  baseUrl: string;
  sendEmail: (email: InvitationEmail) => Promise<{ success: boolean; error?: unknown }>;
}

/** Normalised invitee address. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Whether a pending invitation can still be answered.
 *
 * Normal invites last through the invite cutoff day; Late Pass invites last until the mission
 * completes. Joining itself still checks recruitment status and capacity.
 */
export function isInvitationOpen(
  invitation: { status: string; isLatePass: boolean },
  exchange: { status: string; inviteCutoffDate: Date },
  nowMs = Date.now()
): boolean {
  if (invitation.status !== 'PENDING' || exchange.status === 'COMPLETED') return false;
  return invitation.isLatePass || nowMs < new Date(exchange.inviteCutoffDate).getTime() + DAY_MS;
}

/**
 * Where the email's button goes.
 *
 * New users register with the mission code (their alpha clearance); existing users open the
 * mission to accept. Kovert Delivery invites keep the mission link so the KDM accord flow runs.
 */
export function invitationLink(baseUrl: string, code: string, email: string, isExistingUser: boolean, kdmToken?: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  if (kdmToken) return `${base}/exchange/${code}?kdm=${encodeURIComponent(kdmToken)}`;
  if (isExistingUser) return `${base}/exchange/${code}`;
  return `${base}/register?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`;
}

/**
 * Records (or re-sends) an invitation and emails it.
 *
 * @param db - App-schema Prisma client.
 * @param deps - Site URL and email sender for this runtime.
 * @param input - Mission, caller, invitee email and whether a Late Pass was requested.
 * @param nowMs - Current time, injectable for tests.
 */
export async function sendMissionInvitation(
  db: PrismaClient,
  deps: InvitationDeps,
  input: { exchangeId: unknown; inviterId: string; email: unknown; isLatePass?: unknown },
  nowMs = Date.now()
): Promise<InvitationResult> {
  if (typeof input.exchangeId !== 'string' || !input.exchangeId) {
    return { status: 400, body: { error: 'operationId is required' } };
  }
  if (typeof input.email !== 'string' || !isValidEmail(input.email)) {
    return { status: 400, body: { error: 'A valid recipient email is required' } };
  }
  const email = normalizeEmail(input.email);

  const exchange = await db.exchange.findUnique({
    where: { id: input.exchangeId },
    include: { organizer: { select: { name: true, email: true } }, members: { select: { userId: true } } },
  });
  if (!exchange) return { status: 404, body: { error: 'Exchange not found' } };
  if (exchange.organizerId !== input.inviterId) {
    return { status: 403, body: { error: 'Only the Head Elf can send invitations for this mission.' } };
  }
  if (exchange.status === 'COMPLETED') return { status: 409, body: { error: 'This mission is complete.' } };
  if (normalizeEmail(exchange.organizer.email) === email) {
    return { status: 400, body: { error: 'You are already the Head Elf of this mission.' } };
  }

  const targetUser = await db.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (targetUser && exchange.members.some((m) => m.userId === targetUser.id)) {
    return { status: 409, body: { error: 'That agent is already enrolled in this mission.' } };
  }

  const pastCutoff = nowMs >= new Date(exchange.inviteCutoffDate).getTime() + DAY_MS;
  if (pastCutoff) {
    if (input.isLatePass !== true) {
      return {
        status: 400,
        body: { error: 'The invite cutoff for this mission has passed. Standard invitations are closed.', canUseLatePass: Boolean(targetUser) },
      };
    }
    if (!targetUser) {
      return { status: 400, body: { error: 'Late Pass invitations require the recipient to have an account first.' } };
    }
  }

  const invitation = await db.missionInvitation.upsert({
    where: { exchangeId_email: { exchangeId: exchange.id, email } },
    create: { exchangeId: exchange.id, email, invitedById: input.inviterId, isLatePass: pastCutoff },
    update: { status: 'PENDING', invitedById: input.inviterId, isLatePass: pastCutoff, respondedAt: null, userId: null },
  });

  let kdmToken: string | undefined;
  if (exchange.isCovertDelivery) {
    kdmToken = generateKdmToken();
    await db.covertInviteToken.create({
      data: {
        exchangeId: exchange.id,
        token: kdmToken,
        invitedEmail: email,
        invitedName: targetUser?.name ?? null,
        expiresAt: new Date(nowMs + 60 * DAY_MS),
      },
    });
  }

  if (targetUser) {
    await db.notification.create({
      data: {
        userId: targetUser.id,
        title: `📩 Invited to: ${exchange.title}`,
        message: `${exchange.organizer.name} invited you to join "${exchange.title}". Accept or decline in Active Operations or on the mission page.`,
        exchangeId: exchange.id,
      },
    });
  }

  const joinUrl = invitationLink(deps.baseUrl, exchange.code, email, Boolean(targetUser), kdmToken);
  const sent = await deps
    .sendEmail({
      recipientEmail: email,
      recipientName: targetUser?.name,
      organizerName: exchange.organizer.name,
      exchangeTitle: exchange.title,
      inviteCode: exchange.code,
      joinUrl,
      budgetMin: exchange.budgetMin ? Number(exchange.budgetMin) : null,
      budgetMax: Number(exchange.budgetMax),
      isLatePass: pastCutoff,
      isExistingUser: Boolean(targetUser),
      kdmToken,
      isCovertDelivery: exchange.isCovertDelivery,
    })
    .catch((error: unknown) => ({ success: false, error }));
  if (!sent.success) console.warn('[Invitations] email failed for invitation', invitation.id, sent.error);

  return {
    status: 200,
    body: {
      success: true,
      emailSent: sent.success,
      message: sent.success
        ? `Invitation sent to ${email}.`
        : `Invitation recorded for ${email}, but the email could not be sent. Share the mission code instead.`,
      data: {
        invitationId: invitation.id,
        recipientEmail: email,
        inviteCode: exchange.code,
        isLatePass: pastCutoff,
        targetUserFound: Boolean(targetUser),
        kdmToken,
        isCovertDelivery: exchange.isCovertDelivery,
      },
    },
  };
}

/**
 * The signed-in user's open invitations, for Active Operations and the mission page.
 */
export async function listMyInvitations(db: PrismaClient, userId: string, nowMs = Date.now()): Promise<InvitationResult> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return { status: 401, body: { error: 'Authentication required' } };

  const rows = await db.missionInvitation.findMany({
    where: { email: normalizeEmail(user.email), status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: {
      exchange: {
        select: {
          id: true, title: true, code: true, status: true, inviteCutoffDate: true, executionDate: true,
          budgetMin: true, budgetMax: true, currency: true, isWhiteElephant: true,
          organizer: { select: { name: true, codename: true } },
          members: { where: { userId }, select: { id: true } },
        },
      },
    },
  });

  const invitations = rows
    .filter((r) => r.exchange.members.length === 0 && isInvitationOpen(r, r.exchange, nowMs))
    .map((r) => ({
      id: r.id,
      isLatePass: r.isLatePass,
      createdAt: r.createdAt.toISOString(),
      exchange: {
        id: r.exchange.id,
        title: r.exchange.title,
        code: r.exchange.code,
        status: r.exchange.status,
        inviteCutoffDate: r.exchange.inviteCutoffDate.toISOString(),
        executionDate: r.exchange.executionDate.toISOString(),
        budgetMin: r.exchange.budgetMin ? Number(r.exchange.budgetMin) : null,
        budgetMax: Number(r.exchange.budgetMax),
        currency: r.exchange.currency,
        isWhiteElephant: r.exchange.isWhiteElephant,
        organizer: r.exchange.organizer,
      },
    }));
  return { status: 200, body: { success: true, invitations } };
}

/**
 * Every invitation for one mission, for its Head Elf.
 */
export async function listMissionInvitations(db: PrismaClient, exchangeId: string, userId: string, nowMs = Date.now()): Promise<InvitationResult> {
  const exchange = await db.exchange.findUnique({ where: { id: exchangeId }, select: { organizerId: true, status: true, inviteCutoffDate: true } });
  if (!exchange) return { status: 404, body: { error: 'Exchange not found' } };
  if (exchange.organizerId !== userId) return { status: 403, body: { error: 'Only the Head Elf can view invitations.' } };

  const rows = await db.missionInvitation.findMany({ where: { exchangeId }, orderBy: { createdAt: 'desc' } });
  return {
    status: 200,
    body: {
      success: true,
      invitations: rows.map((r) => ({
        id: r.id,
        email: r.email,
        status: r.status === 'PENDING' && !isInvitationOpen(r, exchange, nowMs) ? 'EXPIRED' : r.status,
        isLatePass: r.isLatePass,
        createdAt: r.createdAt.toISOString(),
        respondedAt: r.respondedAt?.toISOString() ?? null,
      })),
    },
  };
}

/**
 * Declines (invitee) or revokes (Head Elf) a pending invitation.
 */
export async function updateInvitation(
  db: PrismaClient,
  input: { invitationId: unknown; userId: string; action: unknown },
  nowMs = Date.now()
): Promise<InvitationResult> {
  if (typeof input.invitationId !== 'string' || !input.invitationId) return { status: 400, body: { error: 'invitationId is required' } };
  if (input.action !== 'decline' && input.action !== 'revoke') {
    return { status: 400, body: { error: "action must be 'decline' or 'revoke'" } };
  }

  const invitation = await db.missionInvitation.findUnique({
    where: { id: input.invitationId },
    include: { exchange: { select: { organizerId: true } } },
  });
  if (!invitation) return { status: 404, body: { error: 'Invitation not found' } };

  if (input.action === 'revoke') {
    if (invitation.exchange.organizerId !== input.userId) return { status: 403, body: { error: 'Only the Head Elf can revoke invitations.' } };
  } else {
    const user = await db.user.findUnique({ where: { id: input.userId }, select: { email: true } });
    if (!user || normalizeEmail(user.email) !== invitation.email) return { status: 404, body: { error: 'Invitation not found' } };
  }
  if (invitation.status !== 'PENDING') return { status: 409, body: { error: `This invitation is already ${invitation.status.toLowerCase()}.` } };

  await db.missionInvitation.update({
    where: { id: invitation.id },
    data: { status: input.action === 'revoke' ? 'REVOKED' : 'DECLINED', respondedAt: new Date(nowMs) },
  });
  return { status: 200, body: { success: true, message: input.action === 'revoke' ? 'Invitation revoked.' : 'Invitation declined.' } };
}

/**
 * Marks a user's pending invitation to a mission as accepted. Called after any enrollment
 * (mission page, dashboard, or registration with the mission code). Never throws.
 */
export async function markInvitationAccepted(db: PrismaClient, exchangeId: string, email: string, userId: string, nowMs = Date.now()): Promise<void> {
  try {
    await db.missionInvitation.updateMany({
      where: { exchangeId, email: normalizeEmail(email), status: 'PENDING' },
      data: { status: 'ACCEPTED', userId, respondedAt: new Date(nowMs) },
    });
  } catch (err) {
    console.warn('[Invitations] could not mark invitation accepted', err);
  }
}
