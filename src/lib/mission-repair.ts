/**
 * @file mission-repair.ts
 * @description Pre-draw readiness checks and the automatic repair window before a mission is cancelled.
 *
 * Tier 1 (what): `drawReadinessIssues` lists what blocks a mission's draw. `repairDeadlineFor`
 * picks how long the Head Elf has to fix it. `runRepairSweep` is called by the lifecycle sweep for
 * each mission on or after Assignment Day: it pauses a mission with issues, reminds once a day,
 * resumes it when the issues are gone, and cancels it at the deadline. `timelineRepairUpdate`
 * lifts a pause when the Head Elf moves the draw to a later day.
 * Tier 2 (why): Owner rules (2026-10-20). Problems surface at matching: too few agents (Secret
 * Santa needs 4, White Elephant 3), a remote Secret Santa agent with no shipping address, or an
 * empty wishlist. The Head Elf and the agent at fault are told; the Head Elf removes the agent or
 * extends the timeline. The deadline is halfway between Assignment Day and the shipping deadline
 * (Exchange Day when there is none), so givers keep half the time to buy and ship. Recruiting stays
 * open while paused. Unresolved by the deadline (including an unresponsive Head Elf), the mission
 * is cancelled. Nobody receives a Coal Citation for a failed mission.
 * Tier 3 (how): A paused mission has `repairDeadline` set and status RECRUITING, so every join path
 * keeps working; the lifecycle sweep skips its normal milestones while paused. The issue list is
 * stored on the mission (`repairIssues`, JSON text) for the mission page. Notices use `notifyOnce`, refreshed
 * at most once a day (`repairNoticeAt`), so a stuck mission is one row per person, not one per sweep.
 */

import type { PrismaClient } from '@prisma/client';
import { evaluateDrawFeasibility } from '@/lib/draw';
import { cancelMission, type MissionCancelDeps, type MissionFailureReason } from '@/lib/mission-cancel';
import { notifyOnce } from '@/lib/notifications';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The shortest repair window, so a mission paused late still gets two days. */
export const MIN_REPAIR_WINDOW_MS = 2 * DAY_MS;

/** How often a paused mission's notices and the Head Elf's email repeat. */
export const REPAIR_REMINDER_MS = DAY_MS;

/** Fewest agents a draw needs. */
export function minimumAgents(isWhiteElephant: boolean): number {
  return isWhiteElephant ? 3 : 4;
}

/** One thing that blocks the draw. Agent issues name the agent's user ID. */
export type ReadinessIssue =
  | { type: 'NOT_ENOUGH_AGENTS'; have: number; need: number }
  | { type: 'MISSING_ADDRESS'; userId: string }
  | { type: 'EMPTY_WISHLIST'; userId: string }
  | { type: 'DRAW_IMPOSSIBLE' };

/** The mission fields the readiness check reads. */
export interface ReadinessMission {
  isWhiteElephant: boolean;
  isLocalOnly: boolean;
  members: Array<{
    userId: string;
    user: { name?: string | null; streetAddress?: string | null; city?: string | null; state?: string | null; zipCode?: string | null };
    /** Items on the agent's list for this mission. */
    wishlistItemCount: number;
  }>;
  exclusionRules: Array<{ memberId: string; restrictedMemberId: string }>;
}

/** Prisma `include` for loading a mission's members the way `toReadinessMission` expects. */
export const READINESS_MEMBERS_INCLUDE = {
  user: true,
  wishlist: { select: { _count: { select: { wishlistItems: true } } } },
} as const;

/** Shapes a loaded mission (members with `READINESS_MEMBERS_INCLUDE`) for `drawReadinessIssues`. */
export function toReadinessMission(ex: {
  isWhiteElephant: boolean;
  isLocalOnly: boolean;
  members: Array<{ userId: string; user: ReadinessMission['members'][number]['user']; wishlist?: { _count: { wishlistItems: number } } | null }>;
  exclusionRules?: Array<{ memberId: string; restrictedMemberId: string }>;
}): ReadinessMission {
  return {
    isWhiteElephant: ex.isWhiteElephant,
    isLocalOnly: ex.isLocalOnly,
    members: ex.members.map((m) => ({ userId: m.userId, user: m.user, wishlistItemCount: m.wishlist?._count.wishlistItems ?? 0 })),
    exclusionRules: ex.exclusionRules ?? [],
  };
}

/**
 * Everything that blocks the draw, in a stable order (count first, then agents, then rules).
 * An empty list means the mission is ready.
 */
export function drawReadinessIssues(mission: ReadinessMission): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const need = minimumAgents(mission.isWhiteElephant);
  if (mission.members.length < need) issues.push({ type: 'NOT_ENOUGH_AGENTS', have: mission.members.length, need });

  const needsAddress = !mission.isWhiteElephant && !mission.isLocalOnly;
  for (const m of mission.members) {
    const u = m.user;
    if (needsAddress && (!u.streetAddress || !u.city || !u.state || !u.zipCode)) issues.push({ type: 'MISSING_ADDRESS', userId: m.userId });
  }
  for (const m of mission.members) {
    if (m.wishlistItemCount === 0) issues.push({ type: 'EMPTY_WISHLIST', userId: m.userId });
  }

  if (!mission.isWhiteElephant && mission.members.length >= need) {
    const agents = mission.members.map((m) => ({ id: m.userId, name: m.user.name || 'Elf Agent', hasWishlistAttached: true }));
    const rules = mission.exclusionRules.map((r) => ({ agentId: r.memberId, restrictedAgentId: r.restrictedMemberId }));
    if (!evaluateDrawFeasibility(agents, rules).isFeasible) issues.push({ type: 'DRAW_IMPOSSIBLE' });
  }
  return issues;
}

/** Halfway from Assignment Day to the ship deadline (else Exchange Day), and never under two days from now. */
export function repairDeadlineFor(
  mission: { assignmentDate: Date | string; shippingDate?: Date | string | null; executionDate: Date | string },
  nowMs = Date.now()
): Date {
  const start = new Date(mission.assignmentDate).getTime();
  const shipping = mission.shippingDate ? new Date(mission.shippingDate).getTime() : NaN;
  const end = Number.isFinite(shipping) && shipping > start ? shipping : new Date(mission.executionDate).getTime();
  const midpoint = end > start ? start + Math.floor((end - start) / 2) : start;
  return new Date(Math.max(midpoint, nowMs + MIN_REPAIR_WINDOW_MS));
}

/** The reason code a mission cancelled at its deadline is recorded with. */
export function failureReasonFor(issues: ReadinessIssue[]): MissionFailureReason {
  if (issues.some((i) => i.type === 'NOT_ENOUGH_AGENTS')) return 'NOT_ENOUGH_AGENTS';
  if (issues.some((i) => i.type === 'DRAW_IMPOSSIBLE')) return 'DRAW_FAILED';
  return 'REPAIR_DEADLINE_MISSED';
}

/** `1 agent` / `2 agents`. */
function agentCount(n: number): string {
  return `${n} ${n === 1 ? 'agent' : 'agents'}`;
}

/**
 * What every agent is told when the deadline passes. It says what was left unfixed, with counts
 * but no names, because the same text goes to every agent and is stored on the mission.
 */
export function cancellationReasonText(issues: ReadinessIssue[]): string {
  const code = failureReasonFor(issues);
  if (code === 'NOT_ENOUGH_AGENTS') {
    const short = issues.find((i): i is Extract<ReadinessIssue, { type: 'NOT_ENOUGH_AGENTS' }> => i.type === 'NOT_ENOUGH_AGENTS');
    return `There were not enough agents to start the mission: ${short?.have ?? 0} of the ${short?.need ?? 0} needed had joined by the deadline.`;
  }
  if (code === 'DRAW_FAILED') return 'The match rules made a Secret Santa draw impossible and were not changed in time.';
  const wishlists = issues.filter((i) => i.type === 'EMPTY_WISHLIST').length;
  const addresses = issues.filter((i) => i.type === 'MISSING_ADDRESS').length;
  const parts = [
    wishlists ? `${agentCount(wishlists)} still had an empty wishlist` : null,
    addresses ? `${agentCount(addresses)} still had no shipping address` : null,
  ].filter(Boolean);
  if (parts.length === 0) return 'Problems blocking the draw were not fixed before the deadline.';
  return `The draw could not run: at the deadline, ${parts.join(' and ')}.`;
}

/** `November 3, 2026` (UTC). */
function formatDay(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** Plain-language lines for the Head Elf, with agent names. */
export function describeIssues(issues: ReadinessIssue[], nameOf: (userId: string) => string): string[] {
  return issues.map((i) => {
    if (i.type === 'NOT_ENOUGH_AGENTS') return `Only ${i.have} of the ${i.need} agents needed have joined.`;
    if (i.type === 'MISSING_ADDRESS') return `${nameOf(i.userId)} has no shipping address.`;
    if (i.type === 'EMPTY_WISHLIST') return `${nameOf(i.userId)} has an empty wishlist.`;
    return 'The match rules make a Secret Santa draw impossible. Remove some blocked pairs.';
  });
}

/** What one agent must do, or `null` when nothing is on them. */
export function agentTodo(issues: ReadinessIssue[], userId: string): string | null {
  const mine = issues.filter((i) => 'userId' in i && i.userId === userId).map((i) => i.type);
  if (mine.length === 0) return null;
  const tasks = [
    mine.includes('MISSING_ADDRESS') ? 'add your shipping address in Account Preferences' : null,
    mine.includes('EMPTY_WISHLIST') ? 'add at least one gift to your wishlist for this mission' : null,
  ].filter(Boolean);
  return tasks.join(' and ');
}

/** Each agent's unfixed issues, in issue order, keyed by user ID. */
function issuesByAgent(issues: ReadinessIssue[]): Map<string, Array<'MISSING_ADDRESS' | 'EMPTY_WISHLIST'>> {
  const byAgent = new Map<string, Array<'MISSING_ADDRESS' | 'EMPTY_WISHLIST'>>();
  for (const i of issues) {
    if (i.type !== 'MISSING_ADDRESS' && i.type !== 'EMPTY_WISHLIST') continue;
    byAgent.set(i.userId, [...(byAgent.get(i.userId) ?? []), i.type]);
  }
  return byAgent;
}

/**
 * Private lines for a deadline cancellation, keyed by user ID (`cancelMission`'s `notes`).
 * The Head Elf gets every blocking agent as `Real Name (Codename): issues`; each blocking agent
 * gets their own issues. Empty unless the code is `REPAIR_DEADLINE_MISSED`: the other codes
 * (too few agents, impossible rules) do not come down to individual agents.
 */
export function cancellationNotes(
  ex: { organizerId: string; members: Array<{ userId: string; codename?: string | null; user: { name?: string | null } }> },
  issues: ReadinessIssue[]
): Record<string, string> {
  if (failureReasonFor(issues) !== 'REPAIR_DEADLINE_MISSED') return {};
  const byAgent = issuesByAgent(issues);
  if (byAgent.size === 0) return {};

  const notes: Record<string, string> = {};
  const entries: string[] = [];
  for (const [userId, types] of byAgent) {
    const m = ex.members.find((x) => x.userId === userId);
    const name = m?.user.name || 'Unnamed agent';
    const label = m?.codename ? `${name} (${m.codename})` : name;
    const headElfIssues = types.map((t) => (t === 'EMPTY_WISHLIST' ? 'empty wishlist' : 'no shipping address'));
    entries.push(`${label}: ${headElfIssues.join(', ')}`);
    const own = types.map((t) => (t === 'EMPTY_WISHLIST' ? 'your wishlist for this mission was still empty' : 'you had no shipping address'));
    notes[userId] = `At the deadline, ${own.join(' and ')}.`;
  }
  // The Head Elf's list replaces their own line when they were also blocking: it names them too.
  notes[ex.organizerId] = `Still blocking the draw at the deadline: ${entries.join('; ')}.`;
  return notes;
}

/** Runtime pieces for the sweep: cancellation (with its email) and the repair email. */
export interface MissionRepairDeps extends MissionCancelDeps {
  sendRepairEmail: (email: {
    recipientEmail: string;
    recipientName: string;
    exchangeTitle: string;
    lines: string[];
    deadlineText: string;
    isHeadElf: boolean;
    actionUrl: string;
  }) => Promise<{ success: boolean }>;
}

/** A mission as the lifecycle sweep loads it (members with `READINESS_MEMBERS_INCLUDE`). */
export interface RepairableMission {
  id: string;
  title: string;
  code: string;
  organizerId: string;
  isWhiteElephant: boolean;
  isLocalOnly: boolean;
  assignmentDate: Date;
  shippingDate: Date | null;
  executionDate: Date;
  repairDeadline: Date | null;
  repairNoticeAt: Date | null;
  /** Stored issue list (JSON text), compared to skip unchanged writes. */
  repairIssues?: string | null;
  members: Array<{
    userId: string;
    codename?: string | null;
    user: ReadinessMission['members'][number]['user'] & { email?: string | null; emailNotifications?: boolean | null };
    wishlist?: { _count: { wishlistItems: number } } | null;
  }>;
  exclusionRules?: Array<{ memberId: string; restrictedMemberId: string }>;
}

/** Result of one mission's repair check. `ready` means the draw may run now. */
export type RepairOutcome = 'ready' | 'paused' | 'reminded' | 'waiting' | 'cancelled';

/** Sends the pause notices: Head Elf always (email daily), agents at fault (email only when first paused). */
async function sendRepairNotices(
  db: PrismaClient,
  deps: MissionRepairDeps,
  ex: RepairableMission,
  issues: ReadinessIssue[],
  deadline: Date,
  firstNotice: boolean
): Promise<void> {
  const nameOf = (userId: string) => {
    const m = ex.members.find((x) => x.userId === userId);
    return m?.codename ? `Agent: ${m.codename}` : m?.user.name || 'An agent';
  };
  const lines = describeIssues(issues, nameOf);
  const deadlineText = formatDay(deadline);
  const actionUrl = `${deps.baseUrl.replace(/\/$/, '')}/exchange/${ex.code}`;

  await notifyOnce(db, {
    userId: ex.organizerId,
    dedupeKey: `repair:${ex.id}`,
    exchangeId: ex.id,
    title: `⏸️ Mission Paused: ${ex.title}`,
    message: `The draw is on hold: ${lines.join(' ')} Remove the agent or extend the timeline by ${deadlineText}, or the mission will be cancelled. Recruiting is open again.`,
  }).catch((err) => console.error('[MissionRepair] Head Elf notice failed:', err));

  const headElf = ex.members.find((m) => m.userId === ex.organizerId)?.user;
  if (headElf?.email && headElf.emailNotifications !== false) {
    await deps
      .sendRepairEmail({ recipientEmail: headElf.email, recipientName: headElf.name || 'Head Elf', exchangeTitle: ex.title, lines, deadlineText, isHeadElf: true, actionUrl })
      .catch(() => ({ success: false }));
  }

  for (const m of ex.members) {
    const todo = agentTodo(issues, m.userId);
    if (!todo) continue;
    await notifyOnce(db, {
      userId: m.userId,
      dedupeKey: `repair-agent:${ex.id}`,
      exchangeId: ex.id,
      title: `⚠️ Action Needed: ${ex.title}`,
      message: `The draw is waiting on you. Please ${todo} by ${deadlineText}. Otherwise the Head Elf may remove you from the mission.`,
    }).catch((err) => console.error('[MissionRepair] agent notice failed:', err));
    if (firstNotice && m.userId !== ex.organizerId && m.user.email && m.user.emailNotifications !== false) {
      await deps
        .sendRepairEmail({
          recipientEmail: m.user.email,
          recipientName: m.user.name || 'Operative',
          exchangeTitle: ex.title,
          lines: [`Please ${todo}.`],
          deadlineText,
          isHeadElf: false,
          actionUrl,
        })
        .catch(() => ({ success: false }));
    }
  }
}

/** Removes the pause notices once the mission resumes or ends. */
async function clearRepairNotices(db: PrismaClient, exchangeId: string): Promise<void> {
  await db.notification.deleteMany({ where: { dedupeKey: { in: [`repair:${exchangeId}`, `repair-agent:${exchangeId}`] } } });
}

/**
 * Checks one mission on or after Assignment Day and pauses, reminds, resumes or cancels it.
 *
 * @returns `ready` when the draw may run now (any pause has been lifted and status set to SETUP).
 */
export async function runRepairSweep(db: PrismaClient, deps: MissionRepairDeps, ex: RepairableMission, nowMs = Date.now()): Promise<RepairOutcome> {
  const issues = drawReadinessIssues(toReadinessMission(ex));

  if (issues.length === 0) {
    if (ex.repairDeadline) {
      await db.exchange.update({
        where: { id: ex.id },
        data: { status: 'SETUP', repairDeadline: null, repairIssues: null, repairNoticeAt: null },
      });
      await clearRepairNotices(db, ex.id).catch(() => {});
    }
    return 'ready';
  }

  if (!ex.repairDeadline) {
    const deadline = repairDeadlineFor(ex, nowMs);
    await db.exchange.update({
      where: { id: ex.id },
      data: { status: 'RECRUITING', repairDeadline: deadline, repairIssues: JSON.stringify(issues), repairNoticeAt: new Date(nowMs) },
    });
    await sendRepairNotices(db, deps, ex, issues, deadline, true);
    return 'paused';
  }

  if (nowMs >= new Date(ex.repairDeadline).getTime()) {
    await clearRepairNotices(db, ex.id).catch(() => {});
    await cancelMission(
      db,
      deps,
      {
        exchangeId: ex.id,
        actor: 'SYSTEM',
        code: failureReasonFor(issues),
        reason: cancellationReasonText(issues),
        notes: cancellationNotes(ex, issues),
      },
      nowMs
    );
    return 'cancelled';
  }

  const lastNotice = ex.repairNoticeAt ? new Date(ex.repairNoticeAt).getTime() : 0;
  // Keep the stored list current (agents fix things between reminders), and remind once a day.
  if (nowMs - lastNotice >= REPAIR_REMINDER_MS) {
    await db.exchange.update({ where: { id: ex.id }, data: { repairIssues: JSON.stringify(issues), repairNoticeAt: new Date(nowMs) } });
    await db.notification.deleteMany({ where: { dedupeKey: `repair-agent:${ex.id}` } }).catch(() => {});
    await sendRepairNotices(db, deps, ex, issues, new Date(ex.repairDeadline), false);
    return 'reminded';
  }
  const stored = JSON.stringify(issues);
  if (stored !== ex.repairIssues) await db.exchange.update({ where: { id: ex.id }, data: { repairIssues: stored } });
  return 'waiting';
}

/**
 * Extra fields for a timeline edit on a paused mission: moving Target Draw to a later day lifts the
 * pause (the mission waits for the new day as usual); otherwise the deadline follows the new dates.
 */
export function timelineRepairUpdate(
  ex: { repairDeadline: Date | null; assignmentDate: Date; shippingDate: Date | null; executionDate: Date },
  changes: Partial<Record<'inviteCutoffDate' | 'assignmentDate' | 'shippingDate' | 'executionDate', Date>>,
  nowMs = Date.now()
): Record<string, unknown> {
  if (!ex.repairDeadline || Object.keys(changes).length === 0) return {};
  const next = { ...ex, ...changes };
  if (new Date(next.assignmentDate).getTime() > nowMs) return { repairDeadline: null, repairIssues: null, repairNoticeAt: null };
  return { repairDeadline: repairDeadlineFor(next, nowMs) };
}

/** Whether agents are locked in: once the draw has happened nobody joins, leaves or is removed. */
export function isRosterLocked(status: string): boolean {
  return status !== 'RECRUITING' && status !== 'SETUP';
}

/** Parses the stored issue list (`Exchange.repairIssues`, JSON text); `[]` when unset or unreadable. */
export function parseRepairIssues(raw: string | null | undefined): ReadinessIssue[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The stored issue list as a viewer may see it: all of it for the Head Elf, otherwise only their own. */
export function visibleRepairIssues(raw: string | null | undefined, viewerId: string | null, isHeadElf: boolean): string | null {
  if (!raw) return null;
  if (isHeadElf) return raw;
  const mine = parseRepairIssues(raw).filter((i) => !('userId' in i) || i.userId === viewerId);
  return JSON.stringify(mine);
}

/** Fields that end a pause, written with the draw. */
export const CLEAR_REPAIR_FIELDS = { repairDeadline: null, repairIssues: null, repairNoticeAt: null } as const;

/**
 * The refusal for a Head Elf's manual draw while something blocks it, or `null` when it may run.
 * The members must be loaded with `READINESS_MEMBERS_INCLUDE`.
 */
export function manualDrawBlock(ex: {
  isWhiteElephant: boolean;
  isLocalOnly: boolean;
  members: Array<{ userId: string; codename?: string | null; user: ReadinessMission['members'][number]['user']; wishlist?: { _count: { wishlistItems: number } } | null }>;
  exclusionRules?: Array<{ memberId: string; restrictedMemberId: string }>;
}): { status: number; body: Record<string, unknown> } | null {
  const issues = drawReadinessIssues(toReadinessMission(ex));
  if (issues.length === 0) return null;
  const nameOf = (userId: string) => {
    const m = ex.members.find((x) => x.userId === userId);
    return m?.codename ? `Agent: ${m.codename}` : m?.user.name || 'An agent';
  };
  return { status: 409, body: { error: `The draw is blocked. ${describeIssues(issues, nameOf).join(' ')}`, issues } };
}
