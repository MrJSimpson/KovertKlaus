/**
 * @file mission-card.ts
 * @description The dashboard's mission file cards: what each agent sees and can do next, per mission.
 *
 * Tier 1 (what): `MISSION_LIST_MEMBER_SELECT` + `toMissionListItem` build one `GET /api/operations`
 * list entry with a per-viewer `viewer` summary; `missionCardView` turns an entry into the card's
 * stamp, timeline, status line and buttons.
 * Tier 2 (why): The visual refresh (2.0.0-beta) shows on each card the next thing *this* person
 * needs to do (owner-confirmed action table, 2026-10-31, Design System `MissionFile`). That needs
 * the viewer's wishlist, target and shipping state, which the list did not load. Loading every
 * member's target would leak the gift circle, so the server reduces it to the viewer's own facts
 * and strips the rest; both API copies (Next route and edge worker) call this one function.
 * Tier 3 (how): `toMissionListItem` keeps every field the list already returned (members as
 * id/userId/role/shippingStatus only) and adds `viewer` and `memberCount`. `missionCardView` is
 * pure: stages come from `getNextMilestoneCountdown` (the mission page uses the same), buttons are
 * links into the mission page. Not offered because the app has no action for them yet: "Confirm I
 * got my gift" and "Guess my Secret Santa" outside the workshop.
 */

import { getNextMilestoneCountdown } from './security';
import { parseRepairIssues, visibleRepairIssues } from './mission-repair';
import { PURGE_AFTER_MS } from './mission-cancel';

/** Member fields the list query loads; `targetUserId` and `trackingNumber` never leave the server. */
export const MISSION_LIST_MEMBER_SELECT = {
  id: true,
  userId: true,
  role: true,
  shippingStatus: true,
  targetUserId: true,
  trackingNumber: true,
  codename: true,
  wishlist: { select: { _count: { select: { wishlistItems: true } } } },
} as const;

interface LoadedMember {
  id: string;
  userId: string;
  role: string;
  shippingStatus: string;
  targetUserId: string | null;
  trackingNumber: string | null;
  codename: string | null;
  wishlist: { _count: { wishlistItems: number } } | null;
}

/** What one agent's card needs to know about their own part in a mission. */
export interface ViewerSummary {
  isHeadElf: boolean;
  isMember: boolean;
  codename: string | null;
  wishlistItems: number;
  hasTarget: boolean;
  shippingStatus: string;
  /** Agent-level issues blocking the draw that name the viewer. */
  blocking: Array<'MISSING_ADDRESS' | 'EMPTY_WISHLIST' | 'UNVERIFIED_EMAIL'>;
}

/**
 * Builds one list entry for the viewer from a mission loaded with `MISSION_LIST_MEMBER_SELECT`.
 *
 * @param exchange - The mission row with `organizer` and `members` loaded.
 * @param viewerId - The signed-in agent.
 * @returns The mission without other members' targets or tracking, plus `viewer` and `memberCount`.
 */
export function toMissionListItem<E extends { organizerId: string; repairIssues?: string | null; members: LoadedMember[] }>(exchange: E, viewerId: string) {
  const isHeadElf = exchange.organizerId === viewerId;
  const me = exchange.members.find((m) => m.userId === viewerId) ?? null;
  const mine = parseRepairIssues(visibleRepairIssues(exchange.repairIssues ?? null, viewerId, false) ?? '[]');
  const blocking = mine.flatMap((i) => ('userId' in i && i.userId === viewerId ? [i.type as ViewerSummary['blocking'][number]] : []));
  const viewer: ViewerSummary = {
    isHeadElf,
    isMember: me !== null,
    codename: me?.codename ?? null,
    wishlistItems: me?.wishlist?._count.wishlistItems ?? 0,
    hasTarget: Boolean(me?.targetUserId),
    shippingStatus: me?.shippingStatus ?? 'PENDING',
    blocking,
  };
  return {
    ...exchange,
    repairIssues: visibleRepairIssues(exchange.repairIssues ?? null, viewerId, isHeadElf),
    members: exchange.members.map((m) => ({ id: m.id, userId: m.userId, role: m.role, shippingStatus: m.shippingStatus })),
    memberCount: exchange.members.length,
    viewer,
  };
}

/** A list entry as the dashboard receives it (JSON: dates are strings). */
export interface MissionListItem {
  id: string;
  code: string;
  title: string;
  status: string;
  organizerId: string;
  isWhiteElephant: boolean;
  budgetMin: number | string | null;
  budgetMax: number | string | null;
  currency: string;
  maxParticipants: number | null;
  inviteCutoffDate: string;
  assignmentDate: string;
  shippingDate: string | null;
  executionDate: string;
  createdAt: string;
  repairDeadline?: string | null;
  cancelledAt?: string | null;
  cancelCode?: string | null;
  cancelReason?: string | null;
  cancelledFromStatus?: string | null;
  memberCount?: number;
  viewer?: ViewerSummary;
}

export interface CardAction {
  label: string;
  href: string;
  icon?: 'plus' | 'eye' | 'send' | 'package' | 'alert' | 'folder' | 'ticket' | 'key';
}

export type StepState = 'done' | 'current' | 'upcoming';

export interface MissionCardView {
  stamp: { label: string; tone: 'stamp' | 'muted' | 'danger' };
  /** Four timeline steps (RSVP, Match, Sleigh, Party). */
  steps: StepState[];
  meta: { label: string; value: string }[];
  /** Bold lead-in (danger on cancelled cards) and the rest of the status sentence. */
  lead: string | null;
  status: string;
  primary: CardAction & { variant: 'primary' | 'secondary' | 'ghost' };
  secondary: CardAction | null;
  cancelled: boolean;
  /** "Opened 01 Nov" / "Cancelled 22 Nov". */
  tabDate: string;
}

export const CANCEL_REASON_TEXT: Record<string, string> = {
  HEAD_ELF_CANCELLED: 'Cancelled by the Head Elf',
  ADMIN_CANCELLED: 'Cancelled by KovertKlaus support',
  NOT_ENOUGH_AGENTS: 'Not enough agents joined',
  DRAW_FAILED: 'The draw couldn’t find a valid match',
  HEAD_ELF_UNRESPONSIVE: 'The Head Elf didn’t respond in time',
  REPAIR_DEADLINE_MISSED: 'The draw problem wasn’t fixed by the deadline',
};

/** `12 DEC` for data rows. */
export function dataDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase();
}

/** `12 Dec` for sentences. */
export function sentenceDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function money(value: number | string | null, currency: string): string {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n}`;
  }
}

function budget(m: MissionListItem): string {
  const min = Number(m.budgetMin ?? 0);
  const max = Number(m.budgetMax ?? 0);
  if (!min || min === max) return money(max, m.currency);
  return `${money(min, m.currency)}–${money(max, m.currency)}`;
}

/**
 * The card for one mission, from the viewer's point of view.
 *
 * @param m - A list entry (with `viewer`; older responses without it fall back to "View mission").
 * @param now - Today, injectable for tests.
 */
export function missionCardView(m: MissionListItem, now: Date = new Date()): MissionCardView {
  const v: ViewerSummary = m.viewer ?? { isHeadElf: false, isMember: true, codename: null, wishlistItems: 0, hasTarget: false, shippingStatus: 'PENDING', blocking: [] };
  const base = `/exchange/${m.code}`;
  const view: CardAction = { label: 'View mission', href: base, icon: 'folder' };
  const comms: CardAction = { label: 'Mission Comms', href: `${base}#mission-comms`, icon: 'send' };
  const manage: CardAction = { label: 'Manage mission', href: base, icon: 'folder' };
  const wishlist: CardAction = m.isWhiteElephant
    ? { label: v.wishlistItems ? 'Edit my gift' : 'Add my gift', href: `${base}#add-wishlist-item`, icon: 'plus' }
    : { label: v.wishlistItems ? 'Edit my wishlist' : 'Build my wishlist', href: `${base}#add-wishlist-item`, icon: 'plus' };
  const roleStamp = v.isHeadElf ? { label: 'Head Elf', tone: 'stamp' as const } : { label: 'Elf Agent', tone: 'muted' as const };
  const agents = `${m.memberCount ?? 0}${m.maxParticipants ? ` / ${m.maxParticipants}` : ''}`;
  const phase = getNextMilestoneCountdown({ ...m, virtualSystemDate: now });
  const stage = phase.stage;
  const steps = (current: number, allDone = false): StepState[] =>
    [1, 2, 3, 4].map((s) => (allDone || s < current ? 'done' : s === current ? 'current' : 'upcoming'));
  const opened = `Opened ${sentenceDate(m.createdAt)}`;

  // Cancelled (design option B: void stamp, reason in bold red, deleted 90 days later).
  if (m.status === 'CANCELLED') {
    const purge = m.cancelledAt ? new Date(new Date(m.cancelledAt).getTime() + PURGE_AFTER_MS) : null;
    const pre = !m.cancelledFromStatus || m.cancelledFromStatus === 'RECRUITING' || m.cancelledFromStatus === 'SETUP';
    const note = m.cancelCode === 'HEAD_ELF_CANCELLED' && m.cancelReason ? ` “${m.cancelReason}”` : '';
    return {
      stamp: roleStamp,
      steps: steps(pre ? 1 : 3).map((s) => (s === 'current' ? 'upcoming' : s)),
      meta: [
        { label: 'Budget', value: budget(m) },
        { label: pre ? 'RSVP by' : 'Ship by', value: dataDate(pre ? m.inviteCutoffDate : m.shippingDate ?? m.executionDate) },
        { label: 'Agents', value: agents },
      ],
      lead: `${CANCEL_REASON_TEXT[m.cancelCode ?? ''] ?? 'Cancelled'}.`,
      status: `${note}${pre ? ' Nothing was drawn or shipped.' : ''}${purge ? ` Deleted on ${sentenceDate(purge)}.` : ''}`.trim(),
      primary: { ...view, variant: 'ghost' },
      secondary: null,
      cancelled: true,
      tabDate: `Cancelled ${sentenceDate(m.cancelledAt)}`,
    };
  }

  // Completed (or past Exchange Day).
  if (phase.isComplete) {
    return {
      stamp: { label: 'Completed', tone: 'muted' },
      steps: steps(4, true),
      meta: [
        { label: 'Budget', value: budget(m) },
        { label: 'Exchange', value: dataDate(m.executionDate) },
        { label: 'Agents', value: agents },
      ],
      lead: null,
      status: 'Mission complete. The file stays here as your record.',
      primary: { ...view, variant: 'ghost' },
      secondary: null,
      cancelled: false,
      tabDate: opened,
    };
  }

  const meta = (second: { label: string; value: string }) => [{ label: 'Budget', value: budget(m) }, second, { label: 'Agents', value: agents }];

  // Draw paused for repair.
  if (m.repairDeadline && (m.status === 'RECRUITING' || m.status === 'SETUP')) {
    const by = sentenceDate(m.repairDeadline);
    if (v.isHeadElf) {
      return {
        stamp: { label: 'Draw paused', tone: 'danger' },
        steps: steps(2),
        meta: meta({ label: 'Fix by', value: dataDate(m.repairDeadline) }),
        lead: null,
        status: `The draw is paused. Fix what blocks it by ${by}, or the mission is cancelled.`,
        primary: { label: 'Fix the draw', href: base, icon: 'alert', variant: 'primary' },
        secondary: manage,
        cancelled: false,
        tabDate: opened,
      };
    }
    if (v.blocking.length) {
      const fix: CardAction = v.blocking.includes('EMPTY_WISHLIST')
        ? { label: m.isWhiteElephant ? 'Add my gift' : 'Fix my wishlist', href: `${base}#add-wishlist-item`, icon: 'alert' }
        : v.blocking.includes('MISSING_ADDRESS')
          ? { label: 'Fix my address', href: base, icon: 'alert' }
          : { label: 'Verify my email', href: '/verify-email', icon: 'alert' };
      return {
        stamp: { label: 'Action needed', tone: 'danger' },
        steps: steps(2),
        meta: meta({ label: 'Fix by', value: dataDate(m.repairDeadline) }),
        lead: null,
        status: `The draw is waiting on you. ${fix.label} by ${by} so the mission can go ahead.`,
        primary: { ...fix, variant: 'primary' },
        secondary: view,
        cancelled: false,
        tabDate: opened,
      };
    }
    return {
      stamp: roleStamp,
      steps: steps(2),
      meta: meta({ label: 'Fix by', value: dataDate(m.repairDeadline) }),
      lead: null,
      status: 'The draw is paused while the Head Elf sorts out a problem. Nothing for you to do.',
      primary: { ...view, variant: 'ghost' },
      secondary: comms,
      cancelled: false,
      tabDate: opened,
    };
  }

  // Stage 1: RSVP open.
  if (stage === 1) {
    const draw = sentenceDate(m.assignmentDate);
    if (v.isHeadElf) {
      return {
        stamp: roleStamp,
        steps: steps(1),
        meta: meta({ label: 'RSVP by', value: dataDate(m.inviteCutoffDate) }),
        lead: null,
        status: `Recruiting. ${m.memberCount ?? 0} agents so far; RSVP closes ${sentenceDate(m.inviteCutoffDate)}.`,
        primary: { label: 'Invite agents', href: base, icon: 'send', variant: 'primary' },
        secondary: manage,
        cancelled: false,
        tabDate: opened,
      };
    }
    return {
      stamp: roleStamp,
      steps: steps(1),
      meta: meta({ label: 'RSVP by', value: dataDate(m.inviteCutoffDate) }),
      lead: null,
      status: v.wishlistItems
        ? `Recruiting. Your ${m.isWhiteElephant ? 'gift is' : 'Wishlist Manifest is'} ready for the draw on ${draw}.`
        : m.isWhiteElephant
          ? 'Recruiting. Add the gift you will bring to the party.'
          : `Recruiting. Add at least one Manifest Item before the draw on ${draw}.`,
      primary: { ...wishlist, variant: 'primary' },
      secondary: view,
      cancelled: false,
      tabDate: opened,
    };
  }

  // Stage 2: RSVP closed, waiting for the draw.
  if (stage === 2) {
    const draw = sentenceDate(m.assignmentDate);
    return {
      stamp: roleStamp,
      steps: steps(2),
      meta: meta({ label: 'Draw', value: dataDate(m.assignmentDate) }),
      lead: null,
      status: v.isHeadElf ? `RSVP is closed. Targets are drawn on ${draw}.` : `RSVP is closed. You get your target on ${draw}.`,
      primary: v.isHeadElf ? { ...manage, variant: 'primary' } : v.isMember ? { ...wishlist, variant: 'primary' } : { ...view, variant: 'primary' },
      secondary: v.isHeadElf || !v.isMember ? comms : view,
      cancelled: false,
      tabDate: opened,
    };
  }

  // Stage 3: targets drawn, shipping.
  if (stage === 3) {
    const shipBy = { label: 'Ship by', value: dataDate(m.shippingDate ?? m.executionDate) };
    if (!v.hasTarget) {
      return {
        stamp: roleStamp,
        steps: steps(3),
        meta: meta(shipBy),
        lead: null,
        status: m.isWhiteElephant ? `Bring your gift on ${sentenceDate(m.executionDate)}.` : 'Targets are drawn. Agents are shipping their gifts.',
        primary: { ...view, variant: 'primary' },
        secondary: comms,
        cancelled: false,
        tabDate: opened,
      };
    }
    if (v.shippingStatus === 'SHIPPED' || v.shippingStatus === 'LOCAL_DELIVERY') {
      const local = v.shippingStatus === 'LOCAL_DELIVERY';
      return {
        stamp: { label: local ? 'Delivered' : 'Shipped', tone: 'stamp' },
        steps: steps(3),
        meta: meta({ label: 'Arrive by', value: dataDate(m.executionDate) }),
        lead: null,
        status: local ? 'You logged your doorstep drop. Nice work, agent.' : 'Your gift is on the way. Tracking keeps you protected from Coal Citations.',
        primary: { label: local ? 'View mission' : 'Track delivery', href: base, icon: 'package', variant: 'secondary' },
        secondary: comms,
        cancelled: false,
        tabDate: opened,
      };
    }
    return {
      stamp: roleStamp,
      steps: steps(3),
      meta: meta(shipBy),
      lead: null,
      status: `Targets are drawn. Ship by ${sentenceDate(m.shippingDate ?? m.executionDate)} and add tracking to stay protected from Coal Citations.`,
      primary: { label: 'Add tracking', href: base, icon: 'package', variant: 'primary' },
      secondary: { label: 'See my target', href: base, icon: 'eye' },
      cancelled: false,
      tabDate: opened,
    };
  }

  // Stage 4: Party.
  return {
    stamp: roleStamp,
    steps: steps(4),
    meta: meta({ label: 'Exchange', value: dataDate(m.executionDate) }),
    lead: null,
    status: `Exchange Day is ${sentenceDate(m.executionDate)}. Open your gift, then thank your Secret Santa.`,
    primary: { label: 'Post a thank-you', href: base, icon: 'send', variant: 'primary' },
    secondary: view,
    cancelled: false,
    tabDate: opened,
  };
}
