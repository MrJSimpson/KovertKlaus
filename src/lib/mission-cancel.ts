/**
 * @file mission-cancel.ts
 * @description Cancelling, deleting and purging Holiday Missions.
 *
 * Tier 1 (what): `cancelMission` stops a mission and tells every agent; `deleteMission` erases a
 * cancelled one on request; `purgeCancelledMissions` erases cancelled missions 90 days after
 * cancellation. `deletionSchedule` says when each is allowed. The Head Elf (operations route) and
 * North Pole admins (admin operations route) call the first two in both runtimes; the lifecycle
 * sweep calls the purge.
 * Tier 2 (why): A mission could not be stopped or removed, so broken missions lingered and kept
 * notifying. Owner rules (2026-10-20): COMPLETED missions are a permanent record and never change.
 * Anything else may be cancelled by its Head Elf or an admin, immediately. A mission cancelled
 * before the draw may be deleted by hand 48 hours later; after the draw it may not. Either way it
 * is deleted 90 days after cancellation. Deletion erases all mission data for privacy and leaves
 * one `MissionHistory` row (outcome and reason, nothing that identifies a person). Agents are
 * warned on cancellation to save what they need; only the Head Elf is told about the deletion.
 * Failed missions never cost anyone a Coal Citation.
 * Tier 3 (how): Cancelling is one conditional `updateMany`, so two concurrent cancels cannot both
 * win. Deleting runs history, item cleanup, notification cleanup and the cascading mission delete
 * in one transaction. Emails go through an injected sender and never fail the request.
 */

import type { ExchangeStatus, MissionActor, PrismaClient } from '@prisma/client';
import { notifyOnce } from '@/lib/notifications';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Wait between cancelling a mission (before the draw) and deleting it by hand. */
export const DELETE_WAIT_MS = 48 * HOUR_MS;

/** Every cancelled mission is deleted this long after cancellation. */
export const PURGE_AFTER_MS = 90 * DAY_MS;

/** Stages before the draw: a mission cancelled here may be deleted by hand. */
const PRE_DRAW_STATUSES = ['RECRUITING', 'SETUP'];

/** Fixed reason codes stored on the mission and in `MissionHistory`. */
export type MissionFailureReason =
  | 'HEAD_ELF_CANCELLED'
  | 'ADMIN_CANCELLED'
  | 'NOT_ENOUGH_AGENTS'
  | 'DRAW_FAILED'
  | 'HEAD_ELF_UNRESPONSIVE'
  | 'REPAIR_DEADLINE_MISSED';

/** Longest cancellation note accepted. */
export const MAX_CANCEL_REASON_LENGTH = 500;

/** HTTP-shaped result shared by the worker and the Next routes. */
export interface MissionCancelResult {
  status: number;
  body: Record<string, unknown>;
}

/** What the cancellation email sender receives (matches `MissionCancelledEmailParams`). */
export interface MissionCancelledEmail {
  recipientEmail: string;
  recipientName: string;
  exchangeTitle: string;
  cancelledByLabel: string;
  reason?: string;
  headElfNote?: string;
  actionUrl: string;
}

/** Runtime-specific pieces: the public site URL and the email sender. */
export interface MissionCancelDeps {
  baseUrl: string;
  sendEmail: (email: MissionCancelledEmail) => Promise<{ success: boolean }>;
}

/** The mission fields the cancel/delete rules read. */
interface CancelState {
  status: string;
  cancelledAt: Date | null;
  cancelledFromStatus: string | null;
}

/** Whether a mission is closed to every change (cancelled). Read access stays open. */
export function isMissionClosed(status: string | null | undefined): boolean {
  return status === 'CANCELLED';
}

/** The refusal every write to a cancelled mission gets. */
export const MISSION_CLOSED_RESULT: MissionCancelResult = {
  status: 409,
  body: { error: 'This mission is cancelled and read-only.' },
};

/** `MISSION_CLOSED_RESULT` when the mission is cancelled, else `null` (also `null` when it does not exist). */
export async function closedMissionGuard(db: PrismaClient, exchangeId: string): Promise<MissionCancelResult | null> {
  const ex = await db.exchange.findUnique({ where: { id: exchangeId }, select: { status: true } });
  return ex && isMissionClosed(ex.status) ? MISSION_CLOSED_RESULT : null;
}

/** Whether a mission in `status` may be cancelled. */
export function canCancelMission(status: string): boolean {
  return status !== 'COMPLETED' && status !== 'CANCELLED';
}

/**
 * When a cancelled mission may be deleted by hand (`null` when never) and when it is purged.
 * Both are `null` for a mission that is not cancelled.
 */
export function deletionSchedule(mission: CancelState): { manualDeleteFrom: Date | null; purgeOn: Date | null } {
  if (mission.status !== 'CANCELLED' || !mission.cancelledAt) return { manualDeleteFrom: null, purgeOn: null };
  const cancelledMs = new Date(mission.cancelledAt).getTime();
  const preDraw = PRE_DRAW_STATUSES.includes(mission.cancelledFromStatus ?? '');
  return {
    manualDeleteFrom: preDraw ? new Date(cancelledMs + DELETE_WAIT_MS) : null,
    purgeOn: new Date(cancelledMs + PURGE_AFTER_MS),
  };
}

/** How agents see who acted. */
export function actorLabel(actor: MissionActor | string): string {
  if (actor === 'HEAD_ELF') return 'the Head Elf';
  if (actor === 'ADMIN') return 'a KovertKlaus admin';
  return 'KovertKlaus';
}

/** `2026-11-03T…` → `November 3, 2026` (UTC, so every runtime prints the same day). */
function formatDay(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** The Head Elf's extra line about when the mission goes away. */
function headElfDeletionNote(schedule: { manualDeleteFrom: Date | null; purgeOn: Date | null }): string {
  const purge = schedule.purgeOn ? formatDay(schedule.purgeOn) : '';
  return schedule.manualDeleteFrom
    ? `You can delete it permanently from ${schedule.manualDeleteFrom.toUTCString()}. Otherwise it is deleted automatically on ${purge}.`
    : `It will be deleted automatically on ${purge}. Export or save anything you need before then.`;
}

/**
 * Cancels a mission and notifies every agent in-app and by email.
 *
 * @param db - Prisma client (app role for the Head Elf and the system, owner role for admins).
 * @param deps - Site URL and email sender for this runtime.
 * @param input.exchangeId - Mission to cancel.
 * @param input.actor - `HEAD_ELF` (must be `actorUserId`'s mission), `ADMIN` (route verified) or `SYSTEM`.
 * @param input.reason - Optional note shown to agents.
 * @param input.code - Reason code for system cancellations; derived from the actor otherwise.
 */
export async function cancelMission(
  db: PrismaClient,
  deps: MissionCancelDeps,
  input: { exchangeId: unknown; actor: MissionActor; actorUserId?: string; reason?: unknown; code?: MissionFailureReason },
  nowMs = Date.now()
): Promise<MissionCancelResult> {
  if (typeof input.exchangeId !== 'string' || !input.exchangeId) return { status: 400, body: { error: 'operationId is required' } };
  if (input.reason !== undefined && input.reason !== null && typeof input.reason !== 'string') {
    return { status: 400, body: { error: 'reason must be text' } };
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length > MAX_CANCEL_REASON_LENGTH) {
    return { status: 400, body: { error: `Keep the reason under ${MAX_CANCEL_REASON_LENGTH} characters.` } };
  }

  const ex = await db.exchange.findUnique({
    where: { id: input.exchangeId },
    select: {
      id: true, title: true, code: true, status: true, organizerId: true,
      members: { select: { userId: true, user: { select: { name: true, email: true, emailNotifications: true } } } },
    },
  });
  if (!ex) return { status: 404, body: { error: 'Exchange not found' } };
  if (input.actor === 'HEAD_ELF' && ex.organizerId !== input.actorUserId) {
    return { status: 403, body: { error: 'Only the Head Elf can cancel this mission.' } };
  }
  if (ex.status === 'COMPLETED') return { status: 409, body: { error: 'Completed missions are a permanent record and cannot be cancelled.' } };
  if (ex.status === 'CANCELLED') return { status: 409, body: { error: 'This mission is already cancelled.' } };

  const code: MissionFailureReason = input.code ?? (input.actor === 'ADMIN' ? 'ADMIN_CANCELLED' : 'HEAD_ELF_CANCELLED');
  const fromStatus = ex.status;
  const cancelledAt = new Date(nowMs);
  const updated = await db.exchange.updateMany({
    where: { id: ex.id, status: fromStatus },
    data: {
      status: 'CANCELLED',
      cancelledAt,
      cancelledBy: input.actor,
      cancelReason: reason || null,
      cancelCode: code,
      cancelledFromStatus: fromStatus,
    },
  });
  if (updated.count === 0) return { status: 409, body: { error: 'The mission changed while cancelling. Reload and try again.' } };

  const schedule = deletionSchedule({ status: 'CANCELLED', cancelledAt, cancelledFromStatus: fromStatus });
  const by = actorLabel(input.actor);
  const byCap = by.charAt(0).toUpperCase() + by.slice(1);
  const actionUrl = `${deps.baseUrl.replace(/\/$/, '')}/exchange/${ex.code}`;
  const baseMessage = `${byCap} cancelled this mission.${reason ? ` Reason: "${reason}".` : ''} If there is any data you'd like to save, please save it now.`;
  const headElfNote = headElfDeletionNote(schedule);

  // Head Elf may not be enrolled as a member on older missions; make sure they hear about it too.
  const recipientIds = new Set(ex.members.map((m) => m.userId));
  recipientIds.add(ex.organizerId);

  for (const userId of recipientIds) {
    const isHeadElf = userId === ex.organizerId;
    await notifyOnce(db, {
      userId,
      dedupeKey: `mission-cancelled:${ex.id}`,
      exchangeId: ex.id,
      title: `🛑 Mission Cancelled: ${ex.title}`,
      message: isHeadElf ? `${baseMessage} ${headElfNote}` : baseMessage,
    }).catch((err) => console.error('[MissionCancel] notification failed:', err));
  }

  let emailed = 0;
  for (const m of ex.members) {
    if (!m.user.email || m.user.emailNotifications === false) continue;
    const sent = await deps
      .sendEmail({
        recipientEmail: m.user.email,
        recipientName: m.user.name || 'Operative',
        exchangeTitle: ex.title,
        cancelledByLabel: by,
        reason: reason || undefined,
        headElfNote: m.userId === ex.organizerId ? headElfNote : undefined,
        actionUrl,
      })
      .catch(() => ({ success: false }));
    if (sent.success) emailed++;
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Mission cancelled. Every agent has been notified.',
      emailed,
      manualDeleteFrom: schedule.manualDeleteFrom?.toISOString() ?? null,
      purgeOn: schedule.purgeOn?.toISOString() ?? null,
    },
  };
}

/** The mission row `eraseMission` needs. */
interface ErasableMission {
  id: string;
  title: string;
  organizerId: string;
  isWhiteElephant: boolean;
  createdAt: Date;
  executionDate: Date;
  cancelledAt: Date | null;
  cancelledBy: MissionActor | null;
  cancelledFromStatus: ExchangeStatus | null;
  cancelCode: string | null;
  members: Array<{ id: string }>;
}

const ERASABLE_SELECT = {
  id: true, title: true, organizerId: true, isWhiteElephant: true, createdAt: true, executionDate: true,
  status: true, cancelledAt: true, cancelledBy: true, cancelledFromStatus: true, cancelCode: true,
  members: { select: { id: true } },
} as const;

/** Writes the history row, erases every trace of the mission, then tells the Head Elf. */
async function eraseMission(db: PrismaClient, ex: ErasableMission, deletedBy: MissionActor): Promise<void> {
  const memberIds = ex.members.map((m) => m.id);
  // Callback form: the `db` proxy (src/lib/db.ts) runs model calls eagerly, so the array form fails.
  await db.$transaction(async (tx) => {
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
        reason: ex.cancelCode || 'UNKNOWN',
        deletedBy,
      },
    });
    // Items are owned by the user, not the wishlist; remove the ones on this mission's lists.
    await tx.item.deleteMany({ where: { wishlistItems: { some: { wishlist: { memberId: { in: memberIds } } } } } });
    await tx.notification.deleteMany({ where: { exchangeId: ex.id } });
    await tx.exchange.delete({ where: { id: ex.id } });
  });

  const by = deletedBy === 'SYSTEM' ? 'KovertKlaus automatically' : deletedBy === 'ADMIN' ? 'A KovertKlaus admin' : 'You';
  await notifyOnce(db, {
    userId: ex.organizerId,
    dedupeKey: `mission-deleted:${ex.id}`,
    exchangeId: null,
    title: `🗑️ Mission Deleted: ${ex.title}`,
    message: `${by} permanently deleted this cancelled mission and all of its data. This cannot be undone.`,
  }).catch((err) => console.error('[MissionCancel] deletion notice failed:', err));
}

/**
 * Permanently deletes a cancelled mission on request.
 *
 * @param input.actor - `HEAD_ELF` (must be `actorUserId`'s mission) or `ADMIN` (route verified).
 * @param input.confirm - Must be `true`: the caller acknowledged that deletion cannot be undone.
 */
export async function deleteMission(
  db: PrismaClient,
  input: { exchangeId: unknown; actor: Exclude<MissionActor, 'SYSTEM'>; actorUserId?: string; confirm?: unknown },
  nowMs = Date.now()
): Promise<MissionCancelResult> {
  if (typeof input.exchangeId !== 'string' || !input.exchangeId) return { status: 400, body: { error: 'operationId is required' } };
  if (input.confirm !== true) {
    return { status: 400, body: { error: 'Deleting a mission cannot be undone. Confirm to continue.' } };
  }

  const ex = await db.exchange.findUnique({ where: { id: input.exchangeId }, select: ERASABLE_SELECT });
  if (!ex) return { status: 404, body: { error: 'Exchange not found' } };
  if (input.actor === 'HEAD_ELF' && ex.organizerId !== input.actorUserId) {
    return { status: 403, body: { error: 'Only the Head Elf can delete this mission.' } };
  }
  if (ex.status !== 'CANCELLED') {
    return { status: 409, body: { error: ex.status === 'COMPLETED' ? 'Completed missions are a permanent record and cannot be deleted.' : 'Cancel the mission first.' } };
  }

  const schedule = deletionSchedule(ex);
  if (!schedule.manualDeleteFrom) {
    return { status: 409, body: { error: `This mission was cancelled after the draw, so it cannot be deleted by hand. It is deleted automatically on ${formatDay(schedule.purgeOn!)}.` } };
  }
  if (nowMs < schedule.manualDeleteFrom.getTime()) {
    return { status: 409, body: { error: `A cancelled mission can be deleted 48 hours after cancelling, from ${schedule.manualDeleteFrom.toUTCString()}.` } };
  }

  await eraseMission(db, ex, input.actor);
  return { status: 200, body: { success: true, message: 'Mission permanently deleted.' } };
}

/**
 * Deletes every mission cancelled at least 90 days ago. Called by the lifecycle sweep.
 *
 * @returns How many missions were deleted.
 */
export async function purgeCancelledMissions(db: PrismaClient, nowMs = Date.now()): Promise<number> {
  const due = await db.exchange.findMany({
    where: { status: 'CANCELLED', cancelledAt: { lte: new Date(nowMs - PURGE_AFTER_MS) } },
    select: ERASABLE_SELECT,
  });
  let purged = 0;
  for (const ex of due) {
    // Never erase a live mission, whatever the query returned.
    if (ex.status !== 'CANCELLED') continue;
    try {
      await eraseMission(db, ex, 'SYSTEM');
      purged++;
    } catch (err) {
      console.error(`[MissionCancel] purge of ${ex.id} failed:`, err);
    }
  }
  return purged;
}
