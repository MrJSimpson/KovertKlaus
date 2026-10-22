/**
 * @file intel-messages.ts
 * @description Mission messaging: Command, Intel and Debrief channels.
 *
 * Tier 1 (what): `listIntelMessages` and `sendIntelMessage` implement `/api/messages` for both the
 * edge worker (SaaS) and the Next.js route (self-hosted). `validateIntelMessage`, `toMessageView`
 * and `debriefWindow` are the pure rules underneath them.
 * Tier 2 (why): The exchange page's message stream only ever lived in browser state. A mission
 * needs three kinds of conversation, each with its own audience and lifetime:
 *  - COMMAND: the Head Elf and one agent, privately (questions, nudges). Send until completion.
 *  - INTEL: a Secret Santa and their target. The Santa stays anonymous, so views carry no user
 *    IDs for this channel. Send from the draw until completion.
 *  - DEBRIEF: any agent to the whole mission. Send only after completion; readable for
 *    `DEBRIEF_RETENTION_DAYS` days after it, then hidden (rows are kept).
 * COMMAND and INTEL threads stay readable permanently.
 * Tier 3 (how): Each stored row carries its `channel`; INTEL rows also record direction in
 * `isFromSanta`. Intel threads follow the CURRENT assignment, so after a target swap the old
 * pair's messages stop showing. Text is plain, at most `INTEL_MESSAGE_MAX_CHARS`, and an agent may
 * send `INTEL_MESSAGES_PER_HOUR` messages per mission across all channels.
 */

import type { PrismaClient } from '@prisma/client';
import { sanitizeText } from '@/lib/security';
import { isMissionClosed, MISSION_CLOSED_RESULT } from '@/lib/mission-cancel';

/** Longest message, in characters, after trimming. */
export const INTEL_MESSAGE_MAX_CHARS = 500;

/** Messages one agent may send per mission in any rolling hour, all channels together. */
export const INTEL_MESSAGES_PER_HOUR = 20;

/** Days after completion that Debrief messages stay readable. */
export const DEBRIEF_RETENTION_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Client-facing channel names. */
export type MessageChannelName = 'command' | 'intel' | 'debrief';

/** Which side of the Intel pair the viewer is talking to. */
export type IntelSide = 'target' | 'santa';

/** One message as the viewer may see it. */
export interface MessageView {
  id: string;
  channel: MessageChannelName;
  /**
   * Conversation key from the viewer's side: `intel:target`, `intel:santa`, `command:<otherUserId>`
   * or `debrief`. An agent's Command thread key names the Head Elf; the Head Elf has one per agent.
   */
  thread: string;
  fromMe: boolean;
  text: string;
  createdAt: string;
  /** Command and Debrief only. Never present on Intel messages. */
  sender?: { codename: string; isHeadElf: boolean };
}

/** HTTP-shaped result shared by the worker and the Next route. */
export interface IntelResult {
  status: number;
  body: Record<string, unknown>;
}

interface StoredMessage {
  id: string;
  channel: string;
  senderId: string;
  recipientId: string | null;
  messageText: string;
  isFromSanta: boolean;
  createdAt: Date;
}

/** Mission facts the rules need. */
export interface MissionTimes {
  status: string;
  completedAt: Date | null;
  executionDate: Date;
}

/**
 * Checks and cleans a message body.
 *
 * @param text - Raw request value.
 * @returns The cleaned text, or an error suitable for a 400 response.
 */
export function validateIntelMessage(text: unknown): { ok: true; text: string } | { ok: false; error: string } {
  if (typeof text !== 'string') return { ok: false, error: 'Message text is required.' };
  const clean = sanitizeText(text);
  if (!clean) return { ok: false, error: 'Message text is required.' };
  if (clean.length > INTEL_MESSAGE_MAX_CHARS) {
    return { ok: false, error: `Messages are limited to ${INTEL_MESSAGE_MAX_CHARS} characters.` };
  }
  return { ok: true, text: clean };
}

/**
 * Whether Debrief is open, and until when.
 *
 * The window starts at `completedAt`; missions completed before that column existed fall back to
 * their Exchange Day.
 */
export function debriefWindow(mission: MissionTimes, nowMs = Date.now()): { open: boolean; until: Date | null } {
  if (mission.status !== 'COMPLETED') return { open: false, until: null };
  const start = mission.completedAt ?? mission.executionDate;
  const until = new Date(start.getTime() + DEBRIEF_RETENTION_DAYS * DAY_MS);
  return { open: nowMs < until.getTime(), until };
}

/**
 * Converts a stored message to the viewer's view, or null when the viewer may not see it.
 *
 * @param msg - Stored row.
 * @param viewerId - Signed-in agent.
 * @param organizerId - The mission's Head Elf.
 * @param codenames - Mission codename by user ID (for Command and Debrief senders).
 */
export function toMessageView(
  msg: StoredMessage,
  viewerId: string,
  organizerId: string,
  codenames: Map<string, string> = new Map()
): MessageView | null {
  const fromMe = msg.senderId === viewerId;
  const base = { id: msg.id, fromMe, text: msg.messageText, createdAt: msg.createdAt.toISOString() };
  const sender = () => ({ codename: codenames.get(msg.senderId) ?? 'Agent: Unknown', isHeadElf: msg.senderId === organizerId });

  if (msg.channel === 'DEBRIEF') {
    return { ...base, channel: 'debrief', thread: 'debrief', sender: sender() };
  }
  if (!fromMe && msg.recipientId !== viewerId) return null;
  if (msg.channel === 'COMMAND') {
    const other = fromMe ? msg.recipientId! : msg.senderId;
    return { ...base, channel: 'command', thread: `command:${other}`, sender: sender() };
  }
  // INTEL: the viewer's own Santa-side messages go to their target; received Santa-side ones come from their Santa.
  const side: IntelSide = msg.isFromSanta === fromMe ? 'target' : 'santa';
  return { ...base, channel: 'intel', thread: `intel:${side}` };
}

/** The viewer's place in one mission, or null when not enrolled. */
async function resolveContext(db: PrismaClient, exchangeId: string, userId: string) {
  const member = await db.exchangeMember.findUnique({
    where: { exchangeId_userId: { exchangeId, userId } },
    select: {
      targetUserId: true,
      exchange: { select: { status: true, completedAt: true, executionDate: true, organizerId: true } },
    },
  });
  if (!member) return null;
  const santa = await db.exchangeMember.findFirst({ where: { exchangeId, targetUserId: userId }, select: { userId: true } });
  const mission = member.exchange;
  return {
    mission,
    organizerId: mission.organizerId,
    isHeadElf: mission.organizerId === userId,
    targetId: member.targetUserId,
    santaId: santa?.userId ?? null,
    completed: mission.status === 'COMPLETED',
    closed: isMissionClosed(mission.status),
  };
}

/** Mission codename (`ExchangeMember.codename`, else the agent's name) by user ID. */
async function loadCodenames(db: PrismaClient, exchangeId: string): Promise<Map<string, string>> {
  const members = await db.exchangeMember.findMany({
    where: { exchangeId },
    select: { userId: true, codename: true, user: { select: { name: true } } },
  });
  return new Map(members.map((m) => [m.userId, m.codename || m.user.name]));
}

/**
 * Lists every conversation the viewer can read in a mission, oldest first.
 *
 * @param db - App-schema Prisma client.
 * @param exchangeId - Mission ID.
 * @param userId - Signed-in agent.
 * @param nowMs - Current time, injectable for tests.
 */
export async function listIntelMessages(db: PrismaClient, exchangeId: string, userId: string, nowMs = Date.now()): Promise<IntelResult> {
  const ctx = await resolveContext(db, exchangeId, userId);
  if (!ctx) return { status: 403, body: { error: 'You are not enrolled in this mission.' } };

  const debrief = debriefWindow(ctx.mission, nowMs);
  const clauses: Record<string, unknown>[] = [];

  // COMMAND: every Command message involves the Head Elf, so the Head Elf reads them all.
  if (ctx.isHeadElf) {
    clauses.push({ channel: 'COMMAND', OR: [{ senderId: userId }, { recipientId: userId }] });
  } else {
    clauses.push(
      { channel: 'COMMAND', senderId: userId, recipientId: ctx.organizerId },
      { channel: 'COMMAND', senderId: ctx.organizerId, recipientId: userId },
    );
  }
  // INTEL: only the current pairs.
  if (ctx.targetId) {
    clauses.push(
      { channel: 'INTEL', senderId: userId, recipientId: ctx.targetId, isFromSanta: true },
      { channel: 'INTEL', senderId: ctx.targetId, recipientId: userId, isFromSanta: false },
    );
  }
  if (ctx.santaId) {
    clauses.push(
      { channel: 'INTEL', senderId: ctx.santaId, recipientId: userId, isFromSanta: true },
      { channel: 'INTEL', senderId: userId, recipientId: ctx.santaId, isFromSanta: false },
    );
  }
  if (debrief.open) clauses.push({ channel: 'DEBRIEF' });

  const rows = (
    await db.exchangeMessage.findMany({
      where: { exchangeId, OR: clauses },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })
  ).reverse();
  const codenames = await loadCodenames(db, exchangeId);

  return {
    status: 200,
    body: {
      success: true,
      isHeadElf: ctx.isHeadElf,
      hasTarget: Boolean(ctx.targetId),
      hasSanta: Boolean(ctx.santaId),
      canSendCommand: !ctx.completed && !ctx.closed,
      canSendIntel: !ctx.completed && !ctx.closed && Boolean(ctx.targetId || ctx.santaId),
      canSendDebrief: debrief.open && !ctx.closed,
      debriefOpenUntil: debrief.until?.toISOString() ?? null,
      maxChars: INTEL_MESSAGE_MAX_CHARS,
      // Head Elf picks a Command recipient from the roster; agents always write to the Head Elf.
      commandRecipients: ctx.isHeadElf
        ? [...codenames].filter(([id]) => id !== userId).map(([id, codename]) => ({ userId: id, codename }))
        : [{ userId: ctx.organizerId, codename: codenames.get(ctx.organizerId) ?? 'Head Elf' }],
      messages: rows
        .map((r) => toMessageView(r, userId, ctx.organizerId, codenames))
        .filter((m): m is MessageView => m !== null),
    },
  };
}

/**
 * Sends one message.
 *
 * @param db - App-schema Prisma client.
 * @param input - `channel` is `command` | `intel` | `debrief`. `to` is the agent's user ID for a
 *   Head Elf Command message, or `target` | `santa` for Intel; it is ignored otherwise.
 * @param nowMs - Current time, injectable for tests.
 */
export async function sendIntelMessage(
  db: PrismaClient,
  input: { exchangeId: string; userId: string; channel: unknown; to?: unknown; text: unknown },
  nowMs = Date.now()
): Promise<IntelResult> {
  const { channel, to } = input;
  if (channel !== 'command' && channel !== 'intel' && channel !== 'debrief') {
    return { status: 400, body: { error: "channel must be 'command', 'intel' or 'debrief'." } };
  }
  const checked = validateIntelMessage(input.text);
  if (!checked.ok) return { status: 400, body: { error: checked.error } };

  const ctx = await resolveContext(db, input.exchangeId, input.userId);
  if (!ctx) return { status: 403, body: { error: 'You are not enrolled in this mission.' } };
  if (isMissionClosed(ctx.mission.status)) return MISSION_CLOSED_RESULT;

  let recipientId: string | null = null;
  let isFromSanta = false;

  if (channel === 'debrief') {
    if (!ctx.completed) return { status: 409, body: { error: 'Debrief opens when the mission is complete.' } };
    if (!debriefWindow(ctx.mission, nowMs).open) {
      return { status: 409, body: { error: `Debrief closed ${DEBRIEF_RETENTION_DAYS} days after the mission completed.` } };
    }
  } else {
    if (ctx.completed) return { status: 409, body: { error: 'This mission is complete; Command and Intel channels are closed.' } };
    if (channel === 'command') {
      if (ctx.isHeadElf) {
        if (typeof to !== 'string' || to === input.userId) return { status: 400, body: { error: 'Choose an agent to message.' } };
        const enrolled = await db.exchangeMember.findUnique({
          where: { exchangeId_userId: { exchangeId: input.exchangeId, userId: to } },
          select: { userId: true },
        });
        if (!enrolled) return { status: 404, body: { error: 'That agent is not enrolled in this mission.' } };
        recipientId = to;
      } else {
        recipientId = ctx.organizerId;
      }
    } else {
      if (to !== 'target' && to !== 'santa') return { status: 400, body: { error: "Intel messages go to 'target' or 'santa'." } };
      recipientId = to === 'target' ? ctx.targetId : ctx.santaId;
      if (!recipientId) return { status: 409, body: { error: 'Targets have not been assigned yet.' } };
      isFromSanta = to === 'target';
    }
  }

  const sentLastHour = await db.exchangeMessage.count({
    where: { exchangeId: input.exchangeId, senderId: input.userId, createdAt: { gte: new Date(nowMs - 60 * 60 * 1000) } },
  });
  if (sentLastHour >= INTEL_MESSAGES_PER_HOUR) {
    return { status: 429, body: { error: `Limit reached: ${INTEL_MESSAGES_PER_HOUR} messages per hour.` } };
  }

  const created = await db.exchangeMessage.create({
    data: {
      exchangeId: input.exchangeId,
      channel: channel.toUpperCase() as 'COMMAND' | 'INTEL' | 'DEBRIEF',
      senderId: input.userId,
      recipientId,
      messageText: checked.text,
      isFromSanta,
    },
  });
  const codenames = channel === 'intel' ? new Map<string, string>() : await loadCodenames(db, input.exchangeId);
  return { status: 201, body: { success: true, message: toMessageView(created, input.userId, ctx.organizerId, codenames) } };
}
