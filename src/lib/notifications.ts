/**
 * @file notifications.ts
 * @description In-app notifications: list the caller's open ones with a link, and remove them.
 *
 * Tier 1 (what): `listMyNotifications` and `dismissNotifications` implement `/api/notifications`
 * for both the edge worker (SaaS) and the Next.js route (self-hosted). `notificationHref` and
 * `pageNotifications` are the pure pieces the dashboard's notification panel relies on.
 * Tier 2 (why): Notifications used to stack under the dashboard welcome card with no way to clear
 * them, so one troubled mission could bury the page. The panel behind the header bell shows them
 * ten at a time, links each one to the place that needs attention, and lets agents remove them.
 * Tier 3 (how): A `Notification` row stores only `exchangeId`, so the link is derived when listing:
 * the mission's code becomes `/exchange/<code>`. Removing sets `isAcknowledged` (rows are kept),
 * scoped to the caller, so an agent can never touch another agent's notifications.
 */

import type { PrismaClient } from '@prisma/client';

/** Notifications per page in the panel. */
export const NOTIFICATION_PAGE_SIZE = 10;

/** Most notifications one request may remove. */
export const MAX_DISMISS_IDS = 100;

/**
 * Most open notifications one list request loads (newest first); `total` reports the full count.
 * Unbounded loads exceeded the Worker CPU limit once a user had piled up thousands (2026-10-21).
 */
export const MAX_LISTED_NOTIFICATIONS = 100;

/** HTTP-shaped result shared by the worker and the Next route. */
export interface NotificationResult {
  status: number;
  body: Record<string, unknown>;
}

/** One open notification as the panel receives it. */
export interface NotificationView {
  id: string;
  title: string;
  message: string;
  exchangeId: string | null;
  createdAt: string;
  /** Where the notification's "Open" link goes; `null` when there is nowhere to send the agent. */
  href: string | null;
}

/** The page a notification about a mission opens. */
export function notificationHref(exchangeCode: string | null | undefined): string | null {
  return exchangeCode ? `/exchange/${encodeURIComponent(exchangeCode)}` : null;
}

/** One page (0-based) of `items`, plus the page count; an out-of-range page clamps to the last. */
export function pageNotifications<T>(items: T[], page: number, size = NOTIFICATION_PAGE_SIZE): { items: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.min(Math.max(0, Math.floor(page) || 0), pageCount - 1);
  return { items: items.slice(safePage * size, safePage * size + size), page: safePage, pageCount };
}

/**
 * Creates a notification, or refreshes the existing one with the same `dedupeKey` for this user.
 *
 * A refreshed notice moves to the top and shows again even if the agent removed it, so a problem
 * that persists stays visible as one row instead of one new row per lifecycle run.
 */
export async function notifyOnce(
  db: PrismaClient,
  input: { userId: string; dedupeKey: string; title: string; message: string; exchangeId?: string | null }
): Promise<void> {
  const fields = { title: input.title, message: input.message, exchangeId: input.exchangeId ?? null };
  await db.notification.upsert({
    where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } },
    create: { userId: input.userId, dedupeKey: input.dedupeKey, ...fields },
    update: { ...fields, isAcknowledged: false, createdAt: new Date() },
  });
}

/** The caller's open (unremoved) notifications, newest first, each with its link. */
export async function listMyNotifications(db: PrismaClient, userId: string): Promise<NotificationResult> {
  const where = { userId, isAcknowledged: false };
  const [rows, total] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_LISTED_NOTIFICATIONS,
      select: { id: true, title: true, message: true, exchangeId: true, createdAt: true },
    }),
    db.notification.count({ where }),
  ]);

  const exchangeIds = [...new Set(rows.map((r) => r.exchangeId).filter((id): id is string => Boolean(id)))];
  const exchanges = exchangeIds.length
    ? await db.exchange.findMany({ where: { id: { in: exchangeIds } }, select: { id: true, code: true } })
    : [];
  const codeById = new Map(exchanges.map((e) => [e.id, e.code]));

  const notifications: NotificationView[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    message: r.message,
    exchangeId: r.exchangeId,
    createdAt: new Date(r.createdAt).toISOString(),
    href: notificationHref(r.exchangeId ? codeById.get(r.exchangeId) : null),
  }));

  return { status: 200, body: { success: true, notifications, total } };
}

/** Removes the caller's notifications: `{ ids: string[] }` or `{ all: true }`. */
export async function dismissNotifications(
  db: PrismaClient,
  input: { userId: string; ids?: unknown; all?: unknown }
): Promise<NotificationResult> {
  const where: { userId: string; isAcknowledged: false; id?: { in: string[] } } = { userId: input.userId, isAcknowledged: false };

  if (input.all !== true) {
    if (!Array.isArray(input.ids) || input.ids.length === 0 || !input.ids.every((id) => typeof id === 'string' && id.length > 0)) {
      return { status: 400, body: { error: 'Provide notification ids or all: true' } };
    }
    if (input.ids.length > MAX_DISMISS_IDS) {
      return { status: 400, body: { error: `Remove at most ${MAX_DISMISS_IDS} notifications at once` } };
    }
    where.id = { in: input.ids as string[] };
  }

  const result = await db.notification.updateMany({ where, data: { isAcknowledged: true } });
  return { status: 200, body: { success: true, removed: result.count } };
}
