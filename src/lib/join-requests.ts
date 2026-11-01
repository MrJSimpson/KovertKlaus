/**
 * @file join-requests.ts
 * @description Head Elf approval for joining a mission by its code, and the per-invitation link that skips it.
 *
 * Tier 1 (what): `joinMission` is the one way an agent joins by code: with a valid invitation link it
 * enrolls them at once, otherwise it files a `MissionJoinRequest`. `decideJoinRequest` lets the Head
 * Elf approve or decline. `pendingJoinRequests` and `myJoinRequests` feed the mission page and the
 * dashboard. `issueInviteToken` / `readInviteToken` make the per-invitation link.
 * Tier 2 (why): Owner decision (2026-10-31): a mission code can be shared or guessed, so joining by
 * code needs the Head Elf's approval. Until then the requester sees the outsider preview only (no
 * roster, Comms, reports or wishlist). Requests expire when RSVP closes. The platform and mission
 * caps are checked at approval time. Emailed invitations join directly through a signed link tied to
 * that invitation, and only for the invited address (2026-11-01); a forwarded link files a request.
 * Tier 3 (how): The invite token is `invite:<invitationId>` HMAC-signed with its own key purpose; it
 * works while that invitation is PENDING and the mission is recruiting, so it is single use. "RSVP
 * closed" uses the same rule as invitations: from the day after `inviteCutoffDate`, or once the
 * mission leaves RECRUITING; such requests read as expired and are marked EXPIRED when touched. The
 * Head Elf gets one alert per mission (dedupe key `join-requests:<missionId>`), refreshed with the
 * pending count and removed when none are left. Both runtimes call this module.
 */

import type { PrismaClient } from '@prisma/client';
import { issueInviteToken, readInviteToken } from '@/lib/invite-token';
import { enrollWithCodename } from '@/lib/codename';
import { memberWishlistCreate } from '@/lib/mission-wishlist';
import { markInvitationAccepted, normalizeEmail } from '@/lib/invitations';
import { getPlatformSettings, missionJoinError } from '@/lib/platform-limits';
import { notifyOnce } from '@/lib/notifications';

const DAY_MS = 24 * 60 * 60 * 1000;

export { issueInviteToken, readInviteToken };

/** What a route returns. */
export interface JoinResult {
  status: number;
  body: Record<string, unknown>;
}

/** The mission fields this module reads. */
export interface JoinMission {
  id: string;
  code: string;
  title: string;
  status: string;
  organizerId: string;
  isWhiteElephant: boolean;
  maxParticipants: number | null;
  inviteCutoffDate: Date | string;
}

/** Reply when a request was filed (or was already waiting). */
export const REQUEST_SENT_MESSAGE =
  'Request sent. The Head Elf has to approve it before you can see the mission. We will let you know.';

// --- RSVP window ------------------------------------------------------------------

/** True once a mission no longer takes new agents by request (RSVP closed or the draw happened). */
export function isRsvpClosed(mission: Pick<JoinMission, 'status' | 'inviteCutoffDate'>, nowMs = Date.now()): boolean {
  return mission.status !== 'RECRUITING' || nowMs >= new Date(mission.inviteCutoffDate).getTime() + DAY_MS;
}

// --- Head Elf alert ----------------------------------------------------------------

/** Refreshes the Head Elf's one alert for this mission: the pending count, or removed when none are left. */
async function refreshHeadElfAlert(db: PrismaClient, mission: JoinMission, nowMs: number): Promise<void> {
  const dedupeKey = `join-requests:${mission.id}`;
  try {
    const pending = isRsvpClosed(mission, nowMs) ? 0 : await db.missionJoinRequest.count({ where: { exchangeId: mission.id, status: 'PENDING' } });
    if (pending === 0) {
      await db.notification.deleteMany({ where: { userId: mission.organizerId, dedupeKey } });
      return;
    }
    await notifyOnce(db, {
      userId: mission.organizerId,
      dedupeKey,
      exchangeId: mission.id,
      title: `🙋 Join ${pending === 1 ? 'request' : 'requests'}: ${mission.title}`,
      message: `${pending === 1 ? 'An agent has' : `${pending} agents have`} asked to join with the mission code. Approve or decline on the mission page.`,
    });
  } catch (err) {
    console.warn('[JoinRequests] could not refresh the Head Elf alert:', err);
  }
}

// --- joining --------------------------------------------------------------------------

/** Enrolls an agent with a fresh codename and their own Wishlist Manifest for this mission. */
async function enroll(db: PrismaClient, mission: JoinMission, userId: string) {
  return enrollWithCodename(db, mission.id, (codename) =>
    db.exchangeMember.create({
      data: { exchangeId: mission.id, userId, codename, role: 'MEMBER', wishlist: memberWishlistCreate(userId, mission.isWhiteElephant) },
    })
  );
}

/**
 * Joins a mission by its code. With a valid invitation link the agent is enrolled; otherwise a
 * request is filed for the Head Elf. The caller has already found the mission (and rate-limited wrong codes).
 *
 * @param input.inviteToken - The `invite` value from an emailed invitation link, if any.
 */
export async function joinMission(
  deps: { db: PrismaClient; adminDb: PrismaClient },
  mission: JoinMission,
  input: { userId: string; inviteToken?: string | null },
  nowMs = Date.now()
): Promise<JoinResult> {
  const { db, adminDb } = deps;
  const { userId } = input;
  if (mission.organizerId === userId) return { status: 409, body: { error: 'You are the Head Elf of this mission.', exchangeCode: mission.code } };
  const existing = await db.exchangeMember.findFirst({ where: { exchangeId: mission.id, userId }, select: { id: true } });
  if (existing) return { status: 409, body: { error: 'You are already enrolled in this exchange.', exchangeCode: mission.code } };

  // Emailed invitation link: joins directly while that invitation is still open, and only for the
  // invited address (owner decision 2026-11-01): a forwarded link files a normal request instead.
  // The address need not be verified yet: an unverified account is gated until it is (email-verification.ts).
  const invitationId = readInviteToken(input.inviteToken);
  if (invitationId) {
    const [invitation, account] = await Promise.all([
      db.missionInvitation.findUnique({ where: { id: invitationId }, select: { exchangeId: true, status: true, email: true } }),
      db.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);
    const forThisAgent = Boolean(invitation && account && normalizeEmail(account.email) === normalizeEmail(invitation.email));
    if (invitation && forThisAgent && invitation.exchangeId === mission.id && invitation.status === 'PENDING') {
      const count = await db.exchangeMember.count({ where: { exchangeId: mission.id } });
      const blocked = missionJoinError(mission, count, await getPlatformSettings(adminDb));
      if (blocked) return { status: 400, body: { error: blocked } };
      const member = await enroll(db, mission, userId);
      await db.missionInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED', userId, respondedAt: new Date(nowMs) },
      });
      // A request filed earlier for this mission is settled by the invitation.
      await db.missionJoinRequest.updateMany({ where: { exchangeId: mission.id, userId, status: 'PENDING' }, data: { status: 'APPROVED', decidedAt: new Date(nowMs) } });
      await refreshHeadElfAlert(db, mission, nowMs);
      return {
        status: 200,
        body: { success: true, joined: true, message: 'Member successfully enrolled in exchange!', data: { ...member, assignedCodename: member.codename } },
      };
    }
    // A used, revoked or foreign link falls through to a normal request.
  }

  return requestToJoin(db, mission, userId, nowMs);
}

/** Files (or returns) the agent's request to join. */
async function requestToJoin(db: PrismaClient, mission: JoinMission, userId: string, nowMs: number): Promise<JoinResult> {
  if (isRsvpClosed(mission, nowMs)) {
    return {
      status: 400,
      body: { error: 'RSVP for this mission has closed, so it no longer takes requests. Ask the Head Elf to invite you by email.' },
    };
  }
  const prior = await db.missionJoinRequest.findUnique({ where: { exchangeId_userId: { exchangeId: mission.id, userId } } });
  if (prior?.status === 'DECLINED') {
    return { status: 403, body: { error: 'The Head Elf declined your request to join this mission.' } };
  }
  if (prior?.status === 'PENDING') {
    return { status: 200, body: { success: true, pending: true, message: REQUEST_SENT_MESSAGE, exchangeCode: mission.code } };
  }
  // New, or asking again after being approved and later removed, or after an earlier request expired.
  await db.missionJoinRequest.upsert({
    where: { exchangeId_userId: { exchangeId: mission.id, userId } },
    create: { exchangeId: mission.id, userId },
    update: { status: 'PENDING', createdAt: new Date(nowMs), decidedAt: null, decidedById: null },
  });
  await refreshHeadElfAlert(db, mission, nowMs);
  return { status: 200, body: { success: true, pending: true, message: REQUEST_SENT_MESSAGE, exchangeCode: mission.code } };
}

/**
 * Files a request for a new agent who signed up with a mission code (no invitation link).
 * Never throws: sign-up has already succeeded.
 */
export async function requestToJoinAtSignup(db: PrismaClient, mission: JoinMission, userId: string, nowMs = Date.now()): Promise<boolean> {
  try {
    const result = await requestToJoin(db, mission, userId, nowMs);
    return result.body.pending === true;
  } catch (err) {
    console.warn('[JoinRequests] could not file a sign-up request:', err);
    return false;
  }
}

/**
 * Enrolls a new agent who signed up through an emailed invitation link, if the link is still valid
 * for this mission. Returns false (no enrollment) otherwise, so the caller can file a request.
 */
export async function joinWithInviteAtSignup(
  deps: { db: PrismaClient; adminDb: PrismaClient },
  mission: JoinMission,
  userId: string,
  inviteToken: string | null | undefined,
  nowMs = Date.now()
): Promise<boolean> {
  if (!readInviteToken(inviteToken)) return false;
  const result = await joinMission(deps, mission, { userId, inviteToken }, nowMs);
  return result.body.joined === true;
}

// --- deciding ---------------------------------------------------------------------------

/**
 * The Head Elf approves or declines one request.
 *
 * @param input.actorId - Must be the mission's Head Elf.
 * @param input.decision - `approve` or `decline`.
 */
export async function decideJoinRequest(
  deps: { db: PrismaClient; adminDb: PrismaClient },
  mission: JoinMission,
  input: { actorId: string; requestId: unknown; decision: unknown },
  nowMs = Date.now()
): Promise<JoinResult> {
  const { db, adminDb } = deps;
  if (mission.organizerId !== input.actorId) return { status: 403, body: { error: 'Only the Head Elf can approve join requests.' } };
  if (input.decision !== 'approve' && input.decision !== 'decline') return { status: 400, body: { error: "decision must be 'approve' or 'decline'" } };
  if (typeof input.requestId !== 'string' || !input.requestId) return { status: 400, body: { error: 'requestId is required' } };

  const request = await db.missionJoinRequest.findUnique({ where: { id: input.requestId } });
  if (!request || request.exchangeId !== mission.id) return { status: 404, body: { error: 'Join request not found.' } };
  if (request.status !== 'PENDING') return { status: 409, body: { error: 'This request was already decided.' } };
  if (isRsvpClosed(mission, nowMs)) {
    await db.missionJoinRequest.update({ where: { id: request.id }, data: { status: 'EXPIRED', decidedAt: new Date(nowMs) } });
    await refreshHeadElfAlert(db, mission, nowMs);
    return { status: 409, body: { error: 'RSVP has closed, so this request expired. Invite the agent by email (Late Pass) instead.' } };
  }

  const decided = { decidedAt: new Date(nowMs), decidedById: input.actorId };
  if (input.decision === 'decline') {
    await db.missionJoinRequest.update({ where: { id: request.id }, data: { status: 'DECLINED', ...decided } });
    await notifyOnce(db, {
      userId: request.userId,
      dedupeKey: `join-request-decided:${mission.id}`,
      exchangeId: null,
      title: `Request declined: ${mission.title}`,
      message: 'The Head Elf declined your request to join this mission.',
    }).catch(() => {});
    await refreshHeadElfAlert(db, mission, nowMs);
    return { status: 200, body: { success: true, message: 'Request declined.' } };
  }

  // Approve: the caps are checked now, not when the request was made.
  const already = await db.exchangeMember.findFirst({ where: { exchangeId: mission.id, userId: request.userId }, select: { id: true } });
  if (!already) {
    const count = await db.exchangeMember.count({ where: { exchangeId: mission.id } });
    const blocked = missionJoinError(mission, count, await getPlatformSettings(adminDb));
    if (blocked) return { status: 400, body: { error: blocked } };
    await enroll(db, mission, request.userId);
  }
  await db.missionJoinRequest.update({ where: { id: request.id }, data: { status: 'APPROVED', ...decided } });
  const user = await db.user.findUnique({ where: { id: request.userId }, select: { email: true } });
  if (user?.email) await markInvitationAccepted(db, mission.id, user.email, request.userId, nowMs);
  await notifyOnce(db, {
    userId: request.userId,
    dedupeKey: `join-request-decided:${mission.id}`,
    exchangeId: mission.id,
    title: `✅ You're in: ${mission.title}`,
    message: 'The Head Elf approved your request. Open the mission to set up your codename and wishlist.',
  }).catch(() => {});
  await refreshHeadElfAlert(db, mission, nowMs);
  return { status: 200, body: { success: true, message: 'Agent approved and added to the mission.' } };
}

// --- reading -------------------------------------------------------------------------------

/** Pending, unexpired requests for the Head Elf's list (real names are visible to the Head Elf). */
export async function pendingJoinRequests(db: PrismaClient, mission: JoinMission, nowMs = Date.now()) {
  if (isRsvpClosed(mission, nowMs)) return [];
  const rows = await db.missionJoinRequest.findMany({
    where: { exchangeId: mission.id, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, user: { select: { id: true, name: true, emailVerifiedAt: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    requestedAt: r.createdAt,
    userId: r.user.id,
    name: r.user.name,
    emailVerified: r.user.emailVerifiedAt !== null,
  }));
}

/** The viewer's own request for this mission, as the mission page shows it to a would-be agent. */
export async function viewerJoinRequest(db: PrismaClient, mission: JoinMission, userId: string | null, nowMs = Date.now()) {
  if (!userId) return null;
  const r = await db.missionJoinRequest.findUnique({ where: { exchangeId_userId: { exchangeId: mission.id, userId } }, select: { status: true, createdAt: true } });
  if (!r) return null;
  const status = r.status === 'PENDING' && isRsvpClosed(mission, nowMs) ? 'EXPIRED' : r.status;
  return { status, requestedAt: r.createdAt };
}

/** The agent's open and declined requests for the dashboard ("Waiting for the Head Elf"). */
export async function myJoinRequests(db: PrismaClient, userId: string, nowMs = Date.now()) {
  const rows = await db.missionJoinRequest.findMany({
    where: { userId, status: { in: ['PENDING', 'DECLINED'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      createdAt: true,
      exchange: { select: { title: true, code: true, status: true, inviteCutoffDate: true } },
    },
  });
  return rows
    .map((r) => ({
      id: r.id,
      status: r.status === 'PENDING' && isRsvpClosed(r.exchange, nowMs) ? 'EXPIRED' : r.status,
      requestedAt: r.createdAt,
      exchange: { title: r.exchange.title, code: r.exchange.code },
    }))
    .filter((r) => r.status !== 'EXPIRED');
}
