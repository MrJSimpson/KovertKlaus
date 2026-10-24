/**
 * @file manual-draw.ts
 * @description The Head Elf's manual target draw, shared by the edge worker and the Next.js route.
 *
 * Tier 1 (what): `runManualDraw` checks who is asking, refuses a draw that would overwrite drawn
 * targets, applies the same readiness rules as the automatic draw, draws one gift circle, saves it,
 * and tells every agent (in-app notice, plus an email through `deps.sendAssignmentEmail`).
 * `sendDrawAssignmentEmails` is shared with the automatic draw in `mission-lifecycle.ts`.
 * Tier 2 (why): The two runtimes each had their own copy and drifted: the worker had no re-draw lock,
 * so a second click silently replaced every agent's target, and a failed draw surfaced as a 500.
 * Tier 3 (how): Returns an HTTP-shaped result. Only the email sender differs per runtime (each
 * resolves its own email settings), so it is passed in.
 */

import type { PrismaClient } from '@prisma/client';
import type { AssignmentEmailParams } from './email/types';
import { executeLinkedListDraw } from './draw';
import { CLEAR_REPAIR_FIELDS, manualDrawBlock, READINESS_MEMBERS_INCLUDE } from './mission-repair';
import { notifyOnce } from './notifications';

/** Statuses after gifts start moving: the draw can never be redone. */
const POST_DRAW_STATUSES = new Set(['SHIPPED', 'EXECUTED', 'COMPLETED']);

/** HTTP-shaped result shared by the worker and the Next route. */
export interface ManualDrawResult {
  status: number;
  body: Record<string, unknown>;
}

/** Per-runtime pieces of a manual draw. */
export interface ManualDrawDeps {
  /** Mission page link used in the assignment email, e.g. `https://kovertklaus.com/exchange/AB12`. */
  exchangeUrl: (code: string) => string;
  /** Sends one assignment email; omitted when the caller sends none. Failures are logged, never thrown. */
  sendAssignmentEmail?: (email: AssignmentEmailParams) => Promise<unknown>;
}

/** Short US date (e.g. "Dec 20, 2026") for email copy, or `undefined` when unset. */
function emailDate(date: Date | null | undefined): string | undefined {
  return date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined;
}

/** A drawn mission as the email helper reads it (members loaded with `READINESS_MEMBERS_INCLUDE`). */
interface DrawnMission {
  code: string;
  title: string;
  shippingDate: Date | null;
  executionDate: Date | null;
  members: {
    userId: string;
    codename: string | null;
    user: { email: string | null; name: string | null; emailNotifications: boolean | null };
  }[];
}

/**
 * Emails every giver their target after a draw (manual or automatic) and waits for every send.
 * Agents who turned email notifications off are skipped. A failed send is logged, never thrown, so one
 * bad address cannot undo a saved draw; awaiting matters on Workers, where a request or cron run can
 * end (and drop unfinished sends) as soon as its promise resolves.
 */
export async function sendDrawAssignmentEmails(
  ex: DrawnMission,
  assignments: { agentId: string; targetId: string }[],
  deps: Required<ManualDrawDeps>,
  logPrefix: string
): Promise<void> {
  const byId = new Map(ex.members.map((m) => [m.userId, m]));
  const results = await Promise.allSettled(
    assignments.map(async (a) => {
      const giver = byId.get(a.agentId);
      const target = byId.get(a.targetId);
      if (!giver?.user.email || giver.user.emailNotifications === false || !target) return;
      await deps.sendAssignmentEmail({
        recipientEmail: giver.user.email,
        recipientName: giver.user.name || 'Operative',
        targetCodename: target.codename || 'Classified Operative',
        targetName: target.user.name || undefined,
        exchangeTitle: ex.title,
        exchangeUrl: deps.exchangeUrl(ex.code),
        shippingDeadline: emailDate(ex.shippingDate),
        exchangeDate: emailDate(ex.executionDate),
      });
    })
  );
  for (const r of results) if (r.status === 'rejected') console.warn(`${logPrefix} Assignment email failed:`, r.reason);
}

/**
 * Runs the Head Elf's manual draw for `exchangeId`.
 *
 * A mission already MATCHED needs `forceUnlock: true` (409 `requiresConfirmation` otherwise); once
 * gifts are shipping the draw is refused outright, because agents are locked in to their targets.
 */
export async function runManualDraw(
  db: PrismaClient,
  deps: ManualDrawDeps,
  input: { exchangeId: string; userId: string; forceUnlock?: unknown }
): Promise<ManualDrawResult> {
  const ex = await db.exchange.findUnique({
    where: { id: input.exchangeId },
    include: { members: { include: READINESS_MEMBERS_INCLUDE }, exclusionRules: true },
  });
  if (!ex) return { status: 404, body: { error: 'Exchange not found' } };
  if (ex.organizerId !== input.userId) return { status: 403, body: { error: 'Only the Head Elf can trigger target draws' } };

  if (POST_DRAW_STATUSES.has(ex.status)) {
    return { status: 409, body: { error: 'Gifts are already on their way, so the target draw can no longer be redone.' } };
  }
  const alreadyDrawn = ex.status === 'MATCHED' || ex.members.some((m) => m.targetUserId);
  if (alreadyDrawn && input.forceUnlock !== true) {
    return {
      status: 409,
      body: {
        error: 'Target assignments have already been drawn for this exchange. Re-drawing will overwrite existing targets.',
        requiresConfirmation: true,
      },
    };
  }

  // Same readiness rules as the automatic draw (src/lib/mission-repair.ts), including the minimum roster.
  const blocked = manualDrawBlock(ex);
  if (blocked) return blocked;

  let assignments: ReturnType<typeof executeLinkedListDraw>;
  try {
    assignments = executeLinkedListDraw(
      ex.members.map((m) => ({ id: m.userId, name: m.userId, hasWishlistAttached: true })),
      {
        isWhiteElephant: ex.isWhiteElephant,
        exclusionRules: ex.exclusionRules.map((r) => ({ agentId: r.memberId, restrictedAgentId: r.restrictedMemberId })),
      }
    );
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : 'Target draw failed' } };
  }

  // Callback transaction: `db` model calls run eagerly, so the array form fails (src/lib/db.ts).
  await db.$transaction(async (tx) => {
    for (const a of assignments) {
      const member = ex.members.find((m) => m.userId === a.agentId);
      if (!member) continue;
      await tx.exchangeMember.update({ where: { id: member.id }, data: { targetUserId: a.targetId } });
    }
    await tx.exchange.update({
      where: { id: ex.id },
      data: { status: 'MATCHED', drawVerifiedAt: new Date(), ...CLEAR_REPAIR_FIELDS },
    });
  });

  // One notice per agent per mission: a forced re-draw refreshes it instead of adding another.
  for (const a of assignments) {
    await notifyOnce(db, {
      userId: a.agentId,
      dedupeKey: `target-assigned:${ex.id}`,
      exchangeId: ex.id,
      title: `🎯 Secret Target Assigned: ${ex.title}`,
      message: `Target assignments have been drawn for mission "${ex.title}"! Open your Command Center briefing to inspect your classified target.`,
    }).catch((err) => console.warn('[Manual Draw] Assignment notice failed:', err instanceof Error ? err.message : err));
  }

  if (deps.sendAssignmentEmail) {
    await sendDrawAssignmentEmails(ex, assignments, { ...deps, sendAssignmentEmail: deps.sendAssignmentEmail }, '[Manual Draw]');
  }

  return { status: 200, body: { success: true, message: 'Target draw complete: one gift circle through every agent.' } };
}
