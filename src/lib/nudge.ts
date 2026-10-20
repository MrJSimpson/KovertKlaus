/**
 * @file nudge.ts
 * @description Head Elf nudges: a reminder about the agent's next upcoming mission deadline.
 *
 * Tier 1 (what): `nextDeadline` picks the agent's next deadline, `composeNudge` words the reminder,
 * and `dispatchNudge` delivers it as a Command message, an in-app notification and an email. The
 * edge worker (SaaS) and the Next.js route (self-hosted) both call `dispatchNudge`.
 * Tier 2 (why): The old nudge sent the same fixed text ("update your Wishlist Manifest") at every
 * stage and never appeared in the Command thread, so it was often irrelevant and left no record
 * between the Head Elf and the agent.
 * Tier 3 (how): Deadlines in timeline order: invite cutoff, target draw, ship-by (optional, and
 * skipped once this agent has shipped or chosen hand delivery), exchange day. A deadline stays
 * "upcoming" through the end of its day. The Command message goes through `sendIntelMessage`, so
 * the channel rules apply (closed once the mission is complete; hourly message limit). One nudge
 * per agent per `NUDGE_COOLDOWN_MS` keeps it from becoming spam.
 */

import type { PrismaClient } from '@prisma/client';
import { sendIntelMessage } from '@/lib/intel-messages';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimum time between two nudges to the same agent in the same mission. */
export const NUDGE_COOLDOWN_MS = 12 * 60 * 60 * 1000;

/** Notification title prefix; also how the cooldown finds the last nudge. */
export const NUDGE_TITLE_PREFIX = '🔔 Mission Nudge';

/** HTTP-shaped result shared by the worker and the Next route. */
export interface NudgeResult {
  status: number;
  body: Record<string, unknown>;
}

/** The mission dates and agent state a nudge depends on. */
export interface NudgeMission {
  inviteCutoffDate: Date;
  assignmentDate: Date;
  shippingDate: Date | null;
  executionDate: Date;
  isWhiteElephant: boolean;
}

/** One deadline the agent still has ahead of them. */
export interface Deadline {
  key: 'cutoff' | 'draw' | 'ship' | 'exchange';
  label: string;
  date: Date;
  action: string;
}

/**
 * The agent's next deadline that has not passed yet, or null when none remain.
 *
 * @param mission - Mission timeline.
 * @param shippingStatus - This agent's `ExchangeMember.shippingStatus`.
 * @param nowMs - Current time, injectable for tests.
 */
export function nextDeadline(mission: NudgeMission, shippingStatus: string, nowMs = Date.now()): Deadline | null {
  const manifest = mission.isWhiteElephant ? 'White Elephant Manifest item' : 'Wishlist Manifest';
  const candidates: Array<Deadline | null> = [
    { key: 'cutoff', label: 'Recruitment closes', date: mission.inviteCutoffDate, action: `Make sure your ${manifest} is ready.` },
    {
      key: 'draw',
      label: 'Targets are drawn',
      date: mission.assignmentDate,
      action: mission.isWhiteElephant ? `Add your ${manifest} before the draw.` : `Finish your ${manifest} before the draw so your Secret Santa knows what to get you.`,
    },
    mission.shippingDate && shippingStatus === 'PENDING'
      ? { key: 'ship', label: 'Ship-by deadline is', date: mission.shippingDate, action: 'Send your gift and add the tracking number (or mark it as hand delivery).' }
      : null,
    { key: 'exchange', label: 'Exchange day is', date: mission.executionDate, action: shippingStatus === 'PENDING' ? 'Make sure your gift is on its way.' : 'Get ready for the reveal.' },
  ];
  for (const c of candidates) {
    if (c && new Date(c.date).getTime() + DAY_MS > nowMs) return { ...c, date: new Date(c.date) };
  }
  return null;
}

/** "today", "tomorrow" or "in N days", counted in whole UTC days. */
export function relativeDay(date: Date, nowMs = Date.now()): string {
  const dayOf = (ms: number) => Math.floor(ms / DAY_MS);
  const days = dayOf(date.getTime()) - dayOf(nowMs);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/**
 * The reminder text, e.g. "Reminder from your Head Elf: Ship-by deadline is Mon, Dec 15 (in 3 days).
 * Send your gift and add the tracking number (or mark it as hand delivery)."
 */
export function composeNudge(deadline: Deadline, nowMs = Date.now()): string {
  const when = deadline.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `Reminder from your Head Elf: ${deadline.label} ${when} (${relativeDay(deadline.date, nowMs)}). ${deadline.action}`;
}

/** The nudged member, as loaded by the routes (`include: { user: true, exchange: { include: { organizer: true } } }`). */
export interface NudgeTarget {
  userId: string;
  exchangeId: string;
  shippingStatus: string;
  user: { email: string | null; name: string | null; emailNotifications: boolean | null };
  exchange: NudgeMission & { id: string; title: string; code: string; organizerId: string; organizer: { name: string } };
}

/** Runtime-specific pieces: the public site URL and the nudge email sender. */
export interface NudgeDeps {
  baseUrl: string;
  sendEmail: (email: {
    recipientEmail: string;
    recipientName: string;
    organizerName: string;
    exchangeTitle: string;
    message: string;
    actionUrl: string;
  }) => Promise<{ success: boolean }>;
}

/**
 * Sends the nudge: Command message, in-app notification and (if the agent allows it) email.
 *
 * @param db - App-schema Prisma client.
 * @param deps - Site URL and email sender for this runtime.
 * @param member - The scoped, loaded member to nudge.
 * @param nowMs - Current time, injectable for tests.
 */
export async function dispatchNudge(db: PrismaClient, deps: NudgeDeps, member: NudgeTarget, nowMs = Date.now()): Promise<NudgeResult> {
  const { exchange } = member;
  if (member.userId === exchange.organizerId) return { status: 400, body: { error: 'You cannot nudge yourself.' } };

  const deadline = nextDeadline(exchange, member.shippingStatus, nowMs);
  if (!deadline) return { status: 409, body: { error: 'This mission has no upcoming deadlines to remind anyone about.' } };

  const lastNudge = await db.notification.findFirst({
    where: {
      userId: member.userId,
      exchangeId: exchange.id,
      title: { startsWith: NUDGE_TITLE_PREFIX },
      createdAt: { gte: new Date(nowMs - NUDGE_COOLDOWN_MS) },
    },
    select: { createdAt: true },
  });
  if (lastNudge) {
    const hours = Math.ceil((lastNudge.createdAt.getTime() + NUDGE_COOLDOWN_MS - nowMs) / (60 * 60 * 1000));
    return { status: 429, body: { error: `This agent was nudged recently. You can nudge again in about ${hours} h.` } };
  }

  const text = composeNudge(deadline, nowMs);
  const command = await sendIntelMessage(
    db,
    { exchangeId: exchange.id, userId: exchange.organizerId, channel: 'command', to: member.userId, text },
    nowMs
  );
  if (command.status >= 400) return { status: command.status, body: command.body };

  await db.notification.create({
    data: {
      userId: member.userId,
      title: `${NUDGE_TITLE_PREFIX}: ${exchange.title}`,
      message: text,
      exchangeId: exchange.id,
    },
  });

  let emailed = false;
  if (member.user.email && member.user.emailNotifications !== false) {
    try {
      const sent = await deps.sendEmail({
        recipientEmail: member.user.email,
        recipientName: member.user.name || 'Operative',
        organizerName: exchange.organizer.name,
        exchangeTitle: exchange.title,
        message: text,
        actionUrl: `${deps.baseUrl.replace(/\/+$/, '')}/exchange/${exchange.code}`,
      });
      emailed = sent.success;
    } catch (err) {
      console.warn('[Nudge] email failed', err);
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      message: `Nudge sent: ${deadline.label} ${relativeDay(deadline.date, nowMs)}.${emailed ? '' : ' (In-app and Command only; no email.)'}`,
      deadline: { key: deadline.key, date: deadline.date.toISOString() },
    },
  };
}
