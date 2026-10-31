/**
 * @file feedback.ts
 * @description In-app feedback: agents submit it, North Pole admins triage it.
 *
 * Tier 1 (what): `submitFeedback` implements `POST /api/feedback`; `listFeedback`,
 * `updateFeedbackStatus` and `deleteFeedback` implement `/api/northpole/feedback`. Both the edge
 * worker (SaaS) and the Next.js routes (self-hosted) call these.
 * Tier 2 (why): Alpha and beta testers had no way to report a bug or idea from inside the app
 * (carried since W40). Owner decisions (2026-10-27): signed-in agents only; type + message plus
 * automatic context; stored in the database and triaged in the North Pole, with no email (saves
 * the Brevo daily quota).
 * Tier 3 (how): One `Feedback` row per submission in the app schema. The app version comes from
 * the server build, never the client; the page URL is reduced to its path so query strings
 * (codes, tokens) are not stored. Each agent may send `MAX_FEEDBACK_PER_DAY` in any 24 hours.
 */

import type { PrismaClient } from '@prisma/client';
import { APP_VERSION } from '@/lib/version';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Kinds of feedback an agent can pick. */
export const FEEDBACK_TYPES = ['BUG', 'IDEA', 'OTHER'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** Triage states in the North Pole. New submissions start as `NEW`. */
export const FEEDBACK_STATUSES = ['NEW', 'REVIEWED', 'DONE'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Longest message accepted. */
export const MAX_FEEDBACK_LENGTH = 2000;

/** Submissions one agent may send in any 24 hours. */
export const MAX_FEEDBACK_PER_DAY = 10;

/** Rows the North Pole list returns at most. */
export const FEEDBACK_LIST_LIMIT = 200;

const MAX_PAGE_PATH_LENGTH = 300;
const MAX_USER_AGENT_LENGTH = 300;

/** HTTP-shaped result shared by the worker and the Next routes. */
export interface FeedbackResult {
  status: number;
  body: Record<string, unknown>;
}

/** `https://x/exchange/AB-12?code=…#y` → `/exchange/AB-12`. Anything unparsable is dropped. */
export function pagePath(pageUrl: unknown): string | null {
  if (typeof pageUrl !== 'string' || !pageUrl.trim()) return null;
  try {
    const path = new URL(pageUrl.trim(), 'https://kovertklaus.invalid').pathname;
    return path.slice(0, MAX_PAGE_PATH_LENGTH);
  } catch {
    return null;
  }
}

/**
 * Signed-in app pages where the floating Feedback button may appear.
 *
 * An allowlist, not a blocklist: public pages (home, features, sign-in, registration, password
 * reset) and any page added later stay free of the button unless they are listed here
 * (owner decision 2026-10-31: registered agents only, never on the home page).
 */
export const FEEDBACK_PAGE_PREFIXES = ['/dashboard', '/exchange'] as const;

/**
 * Whether the Feedback button belongs on a page.
 *
 * @param pathname - The page path, e.g. `/exchange/ABC123`.
 * @returns `true` only for a listed prefix itself or a path below it (`/dashboard`,
 *   `/dashboard/…`), never for a look-alike such as `/dashboardx`.
 */
export function showsFeedbackButton(pathname: string): boolean {
  return FEEDBACK_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Stores one piece of feedback from a signed-in agent.
 *
 * @param input.userId - The signed-in agent (the route has verified the session).
 * @param input.type - `BUG`, `IDEA` or `OTHER`.
 * @param input.message - 1 to `MAX_FEEDBACK_LENGTH` characters after trimming.
 * @param input.pageUrl - The page the agent was on; only its path is kept.
 * @param input.userAgent - The request's `User-Agent` header, cut to 300 characters.
 */
export async function submitFeedback(
  db: PrismaClient,
  input: { userId: string; type: unknown; message: unknown; pageUrl?: unknown; userAgent?: string | null },
  nowMs = Date.now()
): Promise<FeedbackResult> {
  const type = typeof input.type === 'string' ? input.type.toUpperCase() : '';
  if (!(FEEDBACK_TYPES as readonly string[]).includes(type)) {
    return { status: 400, body: { error: 'Pick Bug, Idea or Other.' } };
  }
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!message) return { status: 400, body: { error: 'Write a message first.' } };
  if (message.length > MAX_FEEDBACK_LENGTH) {
    return { status: 400, body: { error: `Keep it under ${MAX_FEEDBACK_LENGTH} characters.` } };
  }

  const recent = await db.feedback.count({ where: { userId: input.userId, createdAt: { gt: new Date(nowMs - DAY_MS) } } });
  if (recent >= MAX_FEEDBACK_PER_DAY) {
    return { status: 429, body: { error: `You've sent ${MAX_FEEDBACK_PER_DAY} reports today. Thank you! Please try again tomorrow.` } };
  }

  const row = await db.feedback.create({
    data: {
      userId: input.userId,
      type,
      message,
      pagePath: pagePath(input.pageUrl),
      appVersion: APP_VERSION,
      userAgent: input.userAgent ? input.userAgent.slice(0, MAX_USER_AGENT_LENGTH) : null,
    },
    select: { id: true },
  });
  return { status: 201, body: { success: true, id: row.id } };
}

/**
 * The North Pole list, newest first, with the sender's name and email.
 *
 * @param db - Owner-role client (`adminDb`); the route has verified the admin session.
 * @param filter.status - One of `FEEDBACK_STATUSES`; anything else lists every status.
 * @param filter.type - One of `FEEDBACK_TYPES`; anything else lists every type.
 */
export async function listFeedback(db: PrismaClient, filter: { status?: string | null; type?: string | null }): Promise<FeedbackResult> {
  const status = filter.status?.toUpperCase();
  const type = filter.type?.toUpperCase();
  const where = {
    ...(status && (FEEDBACK_STATUSES as readonly string[]).includes(status) ? { status } : {}),
    ...(type && (FEEDBACK_TYPES as readonly string[]).includes(type) ? { type } : {}),
  };
  const [rows, totalCount, newCount] = await Promise.all([
    db.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: FEEDBACK_LIST_LIMIT,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.feedback.count({ where }),
    db.feedback.count({ where: { status: 'NEW' } }),
  ]);
  return {
    status: 200,
    body: {
      success: true,
      totalCount,
      newCount,
      feedback: rows.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        message: r.message,
        pagePath: r.pagePath,
        appVersion: r.appVersion,
        userAgent: r.userAgent,
        createdAt: r.createdAt,
        userName: r.user.name,
        userEmail: r.user.email,
      })),
    },
  };
}

/** Moves one submission to another triage state: `{ id, status }`. */
export async function updateFeedbackStatus(db: PrismaClient, input: { id: unknown; status: unknown }): Promise<FeedbackResult> {
  if (typeof input.id !== 'string' || !input.id) return { status: 400, body: { error: 'id is required' } };
  const status = typeof input.status === 'string' ? input.status.toUpperCase() : '';
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(status)) {
    return { status: 400, body: { error: `status must be one of ${FEEDBACK_STATUSES.join(', ')}` } };
  }
  const updated = await db.feedback.updateMany({ where: { id: input.id }, data: { status } });
  if (updated.count === 0) return { status: 404, body: { error: 'Feedback not found' } };
  return { status: 200, body: { success: true } };
}

/** Deletes one submission (spam, duplicates). */
export async function deleteFeedback(db: PrismaClient, id: unknown): Promise<FeedbackResult> {
  if (typeof id !== 'string' || !id) return { status: 400, body: { error: 'id is required' } };
  const deleted = await db.feedback.deleteMany({ where: { id } });
  if (deleted.count === 0) return { status: 404, body: { error: 'Feedback not found' } };
  return { status: 200, body: { success: true } };
}
