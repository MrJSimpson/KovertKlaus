/**
 * @file intel-messages.ts
 * @description Anonymous Intel messaging between a Secret Santa and their target.
 *
 * Tier 1 (what): `listIntelMessages` and `sendIntelMessage` implement `/api/messages` for both the
 * edge worker (SaaS) and the Next.js route (self-hosted). `validateIntelMessage` and
 * `toIntelView` are the pure rules underneath them.
 * Tier 2 (why): The exchange page's Intel stream only ever lived in browser state, so nothing was
 * delivered. Each agent has two private conversations once targets are drawn: one with the
 * target they give to, and one with the Secret Santa who gives to them. The Santa's identity
 * must never reach the target, so responses carry no user IDs, only which conversation a message
 * belongs to and whether the viewer wrote it.
 * Tier 3 (how): A conversation is defined by the CURRENT assignment. After a target swap, the old
 * pair's messages stop showing, so nobody reads intel meant for someone else. Messages are plain
 * text, at most `INTEL_MESSAGE_MAX_CHARS`, and each agent may send `INTEL_MESSAGES_PER_HOUR` per
 * mission. Sending closes when the mission is COMPLETED. The Head Elf has no special access.
 */

import type { PrismaClient } from '@prisma/client';
import { sanitizeText } from '@/lib/security';

/** Longest Intel message, in characters, after trimming. */
export const INTEL_MESSAGE_MAX_CHARS = 500;

/** Messages one agent may send per mission in any rolling hour. */
export const INTEL_MESSAGES_PER_HOUR = 20;

/**
 * Which of the viewer's two conversations a message belongs to.
 * `target`: with the agent the viewer gives a gift to. `santa`: with the viewer's anonymous Secret Santa.
 */
export type IntelChannel = 'target' | 'santa';

/** One message as the viewer may see it. Carries no user IDs. */
export interface IntelMessageView {
  id: string;
  channel: IntelChannel;
  fromMe: boolean;
  text: string;
  createdAt: string;
}

/** HTTP-shaped result shared by the worker and the Next route. */
export interface IntelResult {
  status: number;
  body: Record<string, unknown>;
}

interface StoredMessage {
  id: string;
  senderId: string;
  recipientId: string;
  messageText: string;
  isFromSanta: boolean;
  createdAt: Date;
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
    return { ok: false, error: `Intel messages are limited to ${INTEL_MESSAGE_MAX_CHARS} characters.` };
  }
  return { ok: true, text: clean };
}

/** True when `value` names a conversation. */
export function isIntelChannel(value: unknown): value is IntelChannel {
  return value === 'target' || value === 'santa';
}

/**
 * Converts a stored message to the viewer's view, or null when the viewer is not part of it.
 *
 * `isFromSanta` records which way the message travelled: true means giver to target.
 */
export function toIntelView(msg: StoredMessage, viewerId: string): IntelMessageView | null {
  const fromMe = msg.senderId === viewerId;
  if (!fromMe && msg.recipientId !== viewerId) return null;
  // The viewer's own Santa-side messages go to their target; received Santa-side ones come from their Santa.
  const channel: IntelChannel = msg.isFromSanta === fromMe ? 'target' : 'santa';
  return { id: msg.id, channel, fromMe, text: msg.messageText, createdAt: msg.createdAt.toISOString() };
}

/** The viewer's current target and Secret Santa in one mission, or null when not enrolled. */
async function resolvePair(db: PrismaClient, exchangeId: string, userId: string) {
  const member = await db.exchangeMember.findUnique({
    where: { exchangeId_userId: { exchangeId, userId } },
    select: { targetUserId: true, exchange: { select: { status: true } } },
  });
  if (!member) return null;
  const santa = await db.exchangeMember.findFirst({
    where: { exchangeId, targetUserId: userId },
    select: { userId: true },
  });
  return { targetId: member.targetUserId, santaId: santa?.userId ?? null, status: member.exchange.status };
}

/**
 * Lists the viewer's two conversations in a mission, oldest first.
 *
 * @param db - App-schema Prisma client.
 * @param exchangeId - Mission ID.
 * @param userId - Signed-in agent.
 */
export async function listIntelMessages(db: PrismaClient, exchangeId: string, userId: string): Promise<IntelResult> {
  const pair = await resolvePair(db, exchangeId, userId);
  if (!pair) return { status: 403, body: { error: 'You are not enrolled in this mission.' } };

  const conversations = [];
  if (pair.targetId) {
    conversations.push(
      { senderId: userId, recipientId: pair.targetId, isFromSanta: true },
      { senderId: pair.targetId, recipientId: userId, isFromSanta: false },
    );
  }
  if (pair.santaId) {
    conversations.push(
      { senderId: pair.santaId, recipientId: userId, isFromSanta: true },
      { senderId: userId, recipientId: pair.santaId, isFromSanta: false },
    );
  }

  const rows = conversations.length
    ? await db.exchangeMessage.findMany({
        where: { exchangeId, OR: conversations },
        orderBy: { createdAt: 'asc' },
        take: 200,
      })
    : [];

  return {
    status: 200,
    body: {
      success: true,
      hasTarget: Boolean(pair.targetId),
      hasSanta: Boolean(pair.santaId),
      canSend: pair.status !== 'COMPLETED',
      maxChars: INTEL_MESSAGE_MAX_CHARS,
      messages: rows.map((r) => toIntelView(r, userId)).filter((m): m is IntelMessageView => m !== null),
    },
  };
}

/**
 * Sends one Intel message to the viewer's target or Secret Santa.
 *
 * @param db - App-schema Prisma client.
 * @param input - Mission, sender, conversation and raw text.
 * @param nowMs - Current time, injectable for tests.
 */
export async function sendIntelMessage(
  db: PrismaClient,
  input: { exchangeId: string; userId: string; channel: unknown; text: unknown },
  nowMs = Date.now()
): Promise<IntelResult> {
  if (!isIntelChannel(input.channel)) {
    return { status: 400, body: { error: "channel must be 'target' or 'santa'." } };
  }
  const checked = validateIntelMessage(input.text);
  if (!checked.ok) return { status: 400, body: { error: checked.error } };

  const pair = await resolvePair(db, input.exchangeId, input.userId);
  if (!pair) return { status: 403, body: { error: 'You are not enrolled in this mission.' } };
  if (pair.status === 'COMPLETED') return { status: 409, body: { error: 'This mission is complete; Intel channels are closed.' } };

  const recipientId = input.channel === 'target' ? pair.targetId : pair.santaId;
  if (!recipientId) return { status: 409, body: { error: 'Targets have not been assigned yet.' } };

  const sentLastHour = await db.exchangeMessage.count({
    where: { exchangeId: input.exchangeId, senderId: input.userId, createdAt: { gte: new Date(nowMs - 60 * 60 * 1000) } },
  });
  if (sentLastHour >= INTEL_MESSAGES_PER_HOUR) {
    return { status: 429, body: { error: `Limit reached: ${INTEL_MESSAGES_PER_HOUR} Intel messages per hour.` } };
  }

  const created = await db.exchangeMessage.create({
    data: {
      exchangeId: input.exchangeId,
      senderId: input.userId,
      recipientId,
      messageText: checked.text,
      isFromSanta: input.channel === 'target',
    },
  });
  return { status: 201, body: { success: true, message: toIntelView(created, input.userId) } };
}
