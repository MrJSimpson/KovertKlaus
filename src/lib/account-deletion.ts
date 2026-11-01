/**
 * @file account-deletion.ts
 * @description Self-service account deletion: what blocks it, and the permanent delete itself.
 *
 * Tier 1 (what): `deletionPreview` lists what blocks a deletion and what will be removed;
 * `deleteAccount` checks the password and the typed confirmation, refuses while anything blocks,
 * then deletes the account and its data. Both return `{ status, body }` so the Next.js routes
 * (self-hosted) and the Worker (SaaS) share one implementation.
 * Tier 2 (why): The Privacy Policy promised deletion by email only. Owner decisions (2026-11-01):
 * deletion is immediate and permanent (password plus typing DELETE); it is refused while the agent
 * runs an open mission (they cancel or finish it first) or is in a mission after its draw (so no gift
 * circle breaks mid-season); before a draw, deleting simply removes them from the mission; missions
 * they ran that are closed are deleted with the account; Coal Citations are deleted too (nothing kept).
 * Tier 3 (how): Most data cascades from `User` (memberships, wishlists, items, messages, reports,
 * notifications, feedback, invitations sent). Two foreign keys do not: `Exchange.organizer` (closed
 * missions they ran are erased first, as `mission-cancel.ts` erases a cancelled mission, with a
 * `MissionHistory` row) and `ExchangeMember.targetUser` (cleared on other agents' rows in closed
 * missions). Held emails to the address are dropped from `admin."EmailOutbox"`. Wrong passwords are
 * rows in `admin."LoginThrottle"` (scope `DELETE`, 5 an hour); the check fails open like the others.
 */

import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { getSessionSecret } from '@/lib/security';
import { comparePassword } from '@/lib/password';
import { isRosterLocked } from '@/lib/mission-repair';
import { notifyOnce } from '@/lib/notifications';

const HOUR_MS = 60 * 60 * 1000;

/** What the agent must type to confirm. */
export const DELETE_CONFIRM_WORD = 'DELETE';

/** `LoginThrottle.scope` for wrong passwords on the delete form. */
export const DELETE_SCOPE = 'DELETE';

/** Wrong passwords allowed per hour before the form locks. */
export const DELETE_PASSWORD_ATTEMPTS = 5;

/** A mission named in the preview. */
export interface MissionRef {
  id: string;
  code: string;
  title: string;
  status: string;
}

/** What blocks a deletion, and what goes with the account. */
export interface DeletionPreview {
  /** Open missions the agent runs as Head Elf: cancel or finish each first. */
  runningMissions: MissionRef[];
  /** Missions after their draw that are not finished: deletion waits until they end. */
  lockedMissions: MissionRef[];
  /** Missions not drawn yet: deleting removes the agent from them. */
  leavingMissions: MissionRef[];
  /** Closed missions the agent ran: deleted with the account. */
  closedMissionsRun: number;
  /** True when nothing blocks the deletion. */
  canDelete: boolean;
}

/** What a route returns. */
export interface DeletionResult {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

/** Runtime pieces the delete needs. */
export interface DeletionDeps {
  /** App-schema client. */
  db: PrismaClient;
  /** Owner-role client (`LoginThrottle`, `EmailOutbox`). */
  adminDb: PrismaClient;
  /** One INFO line for the system log, without personal data (optional). */
  onDeleted?: (message: string, metadata: Record<string, unknown>) => void;
}

const MISSION_SELECT = { id: true, code: true, title: true, status: true, organizerId: true } as const;

/**
 * True for a mission that is over: completed or cancelled. (`isMissionClosed` in mission-cancel.ts
 * means cancelled only, which is not what deletion needs.)
 */
export function isMissionFinished(status: string): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED';
}

function ref(m: { id: string; code: string; title: string; status: string }): MissionRef {
  return { id: m.id, code: m.code, title: m.title, status: m.status };
}

/**
 * What blocks deleting `userId`'s account, and what would be removed.
 *
 * @param db - App-schema client.
 */
export async function deletionPreview(db: PrismaClient, userId: string): Promise<DeletionPreview> {
  const [run, memberships] = await Promise.all([
    db.exchange.findMany({ where: { organizerId: userId }, select: MISSION_SELECT }),
    db.exchangeMember.findMany({ where: { userId }, select: { exchange: { select: MISSION_SELECT } } }),
  ]);
  const runningMissions = run.filter((m) => !isMissionFinished(m.status)).map(ref);
  const joined = memberships.map((m) => m.exchange).filter((m) => m.organizerId !== userId);
  const lockedMissions = joined.filter((m) => !isMissionFinished(m.status) && isRosterLocked(m.status)).map(ref);
  const leavingMissions = joined.filter((m) => !isMissionFinished(m.status) && !isRosterLocked(m.status)).map(ref);
  return {
    runningMissions,
    lockedMissions,
    leavingMissions,
    closedMissionsRun: run.length - runningMissions.length,
    canDelete: runningMissions.length === 0 && lockedMissions.length === 0,
  };
}

// --- wrong-password limit ------------------------------------------------------

function throttleKey(userId: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(`${DELETE_SCOPE}:account:${userId}`).digest('hex').slice(0, 32);
}

async function wrongPasswordsLastHour(adminDb: PrismaClient, accountHash: string, nowMs: number): Promise<number> {
  try {
    return await adminDb.loginThrottle.count({ where: { scope: DELETE_SCOPE, accountHash, createdAt: { gt: new Date(nowMs - HOUR_MS) } } });
  } catch (err) {
    console.error('[AccountDeletion] throttle check failed, allowing the attempt:', err);
    return 0;
  }
}

// --- the delete ------------------------------------------------------------------

/**
 * Permanently deletes the signed-in agent's account. The caller has already checked the session.
 *
 * @param input.password - The account password, re-entered.
 * @param input.confirm - Must be `DELETE` (typed by the agent).
 */
export async function deleteAccount(
  deps: DeletionDeps,
  userId: string,
  input: { password: unknown; confirm: unknown },
  nowMs = Date.now()
): Promise<DeletionResult> {
  const password = typeof input.password === 'string' ? input.password : '';
  const confirm = typeof input.confirm === 'string' ? input.confirm.trim() : '';
  if (confirm !== DELETE_CONFIRM_WORD) return { status: 400, body: { error: `Type ${DELETE_CONFIRM_WORD} to confirm.` } };
  if (!password) return { status: 400, body: { error: 'Enter your password to confirm.' } };

  const { db, adminDb } = deps;
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, passwordHash: true } });
  if (!user) return { status: 401, body: { error: 'Please sign in again.' } };

  const accountHash = throttleKey(user.id);
  if ((await wrongPasswordsLastHour(adminDb, accountHash, nowMs)) >= DELETE_PASSWORD_ATTEMPTS) {
    return { status: 429, body: { error: 'Too many wrong passwords. Please try again in an hour.' }, headers: { 'Retry-After': '3600' } };
  }
  if (!(await comparePassword(password, user.passwordHash))) {
    await adminDb.loginThrottle.create({ data: { scope: DELETE_SCOPE, accountHash, ipHash: '-' } }).catch(() => {});
    return { status: 400, body: { error: 'That password is not correct.' } };
  }

  const preview = await deletionPreview(db, user.id);
  if (!preview.canDelete) {
    return {
      status: 409,
      body: { error: 'Your account cannot be deleted yet. Close or finish the missions listed first.', ...preview },
    };
  }

  // Who to tell afterwards: Head Elves of missions the agent is leaving, and agents of closed missions they ran.
  const leaving = await db.exchangeMember.findMany({
    where: { userId: user.id, exchange: { status: { in: ['SETUP', 'RECRUITING'] }, organizerId: { not: user.id } } },
    select: { exchange: { select: { id: true, title: true, organizerId: true } } },
  });
  const closedRun = await db.exchange.findMany({
    where: { organizerId: user.id, status: { in: ['COMPLETED', 'CANCELLED'] } },
    select: {
      id: true, title: true, isWhiteElephant: true, createdAt: true, executionDate: true, status: true,
      cancelledAt: true, cancelledBy: true, cancelledFromStatus: true, cancelCode: true,
      members: { select: { id: true, userId: true } },
    },
  });

  // Callback form: the `db` proxy (src/lib/db.ts) runs model calls eagerly, so the array form fails.
  await db.$transaction(async (tx) => {
    for (const ex of closedRun) {
      const memberIds = ex.members.map((m) => m.id);
      await tx.missionHistory.create({
        data: {
          missionId: ex.id,
          isWhiteElephant: ex.isWhiteElephant,
          memberCount: memberIds.length,
          missionCreatedAt: ex.createdAt,
          executionDate: ex.executionDate,
          cancelledAt: ex.cancelledAt,
          cancelledBy: ex.cancelledBy,
          cancelledFromStatus: ex.cancelledFromStatus,
          reason: ex.status === 'CANCELLED' ? ex.cancelCode || 'UNKNOWN' : 'HEAD_ELF_ACCOUNT_DELETED',
          deletedBy: 'HEAD_ELF',
        },
      });
      // Items are owned by their user, not the wishlist; remove the ones on this mission's lists.
      await tx.item.deleteMany({ where: { wishlistItems: { some: { wishlist: { memberId: { in: memberIds } } } } } });
      await tx.notification.deleteMany({ where: { exchangeId: ex.id } });
      await tx.exchange.delete({ where: { id: ex.id } });
    }
    // Other agents' rows that point at this agent as their target (closed missions only; open drawn ones block).
    await tx.exchangeMember.updateMany({ where: { targetUserId: user.id }, data: { targetUserId: null } });
    await tx.user.delete({ where: { id: user.id } });
  });

  // Held emails to the address (best effort: the outbox stores the message as JSON text).
  await adminDb.emailOutbox.deleteMany({ where: { status: 'HELD', message: { contains: user.email } } }).catch((err: unknown) => {
    console.warn('[AccountDeletion] could not drop held emails:', err);
  });

  // Notices (best effort; the account is already gone).
  const notices: Array<{ userId: string; dedupeKey: string; title: string; message: string }> = [];
  for (const { exchange } of leaving) {
    notices.push({
      userId: exchange.organizerId,
      dedupeKey: `agent-account-deleted:${exchange.id}:${user.id}`,
      title: `An agent left ${exchange.title}`,
      message: 'An agent deleted their KovertKlaus account, so they are no longer in this mission. The draw has not happened yet, so nothing else changes.',
    });
  }
  for (const ex of closedRun) {
    for (const m of ex.members) {
      if (m.userId === user.id) continue;
      notices.push({
        userId: m.userId,
        dedupeKey: `mission-deleted-account:${ex.id}`,
        title: `Mission removed: ${ex.title}`,
        message: 'The Head Elf deleted their KovertKlaus account, so this finished mission and its history were deleted with it.',
      });
    }
  }
  for (const n of notices) {
    await notifyOnce(db, { ...n, exchangeId: null }).catch((err: unknown) => console.warn('[AccountDeletion] notice failed:', err));
  }

  deps.onDeleted?.('An agent deleted their account.', {
    leftMissions: leaving.length,
    deletedMissions: closedRun.length,
  });
  return { status: 200, body: { success: true, message: 'Your account and its data have been deleted.' } };
}
