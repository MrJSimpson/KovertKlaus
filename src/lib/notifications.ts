/**
 * @file notifications.ts
 * @description In-app notifications: list the caller's open ones with a link, and remove them.
 *
 * Tier 1 (what): `listMyNotifications` and `dismissNotifications` implement `/api/notifications`
 * for both the edge worker (SaaS) and the Next.js route (self-hosted). The list splits into pinned
 * notices (problems that block a mission; they cannot be removed) and the rest.
 * Tier 2 (why): Notifications used to stack under the dashboard welcome card with no way to clear
 * them, so one troubled mission could bury the page. The Alerts page (2.0.0-beta) pins what needs
 * action, groups the rest by day, links each one to the place that needs attention, and lets agents
 * remove one or all of them.
 * Tier 3 (how): A `Notification` row stores only `exchangeId`, so the link and mission name are
 * derived when listing. Pinned notices are either derived from the agent's state (a missing
 * shipping address) or stored repair notices (`mission-repair.ts` deletes those once the mission is
 * fixed). Removing sets `isAcknowledged` (rows are kept), scoped to the caller and never on a pinned
 * notice, so an agent can never touch another agent's notifications.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { displayTitle, notificationKind, PINNED_KEY_PREFIXES, type NotificationKind } from '@/lib/notification-copy';

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

/** One open notification as the Alerts page receives it. */
export interface NotificationView {
  id: string;
  /** Without the emoji and `: <mission>` suffix that titles stored before 2.0.0-beta carried. */
  title: string;
  message: string;
  exchangeId: string | null;
  /** The mission's name, shown on its own line; `null` when the notice has no (existing) mission. */
  missionName: string | null;
  /** Picks the icon. */
  kind: NotificationKind;
  createdAt: string;
  /** Where the notification's "Open" link goes; `null` when there is nowhere to send the agent. */
  href: string | null;
}

/**
 * A notice that stays until its problem is fixed: derived from the agent's state (`shipping-address`)
 * or a stored repair notice (its notification id). The agent cannot remove it.
 */
export interface PinnedAlert extends NotificationView {
  /** `danger`: a mission is stuck. `warning`: the agent should act soon. */
  tone: 'danger' | 'warning';
  /** `shipping`: the button opens the shipping address form instead of following `href`. */
  action: 'shipping' | null;
  actionLabel: string;
}

/** Missions that are over no longer need anything from the agent. */
const FINISHED_STATUSES = ['COMPLETED', 'CANCELLED'] as const;

/** Rows that are pinned (stored repair notices). */
const PINNED_WHERE: Prisma.NotificationWhereInput = {
  OR: PINNED_KEY_PREFIXES.map((prefix) => ({ dedupeKey: { startsWith: `${prefix}:` } })),
};

/**
 * Rows that are not pinned. `NOT startsWith` alone would also drop rows without a key (SQL `NULL`),
 * so key-less rows are matched explicitly.
 */
const UNPINNED_WHERE: Prisma.NotificationWhereInput = {
  OR: [{ dedupeKey: null }, { AND: PINNED_KEY_PREFIXES.map((prefix) => ({ NOT: { dedupeKey: { startsWith: `${prefix}:` } } })) }],
};

/**
 * The pinned notice for a missing shipping address: a remote Secret Santa mission (not local-only,
 * not White Elephant) that is still running needs one, or its draw pauses.
 */
async function shippingAddressAlert(db: PrismaClient, userId: string): Promise<PinnedAlert | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { streetAddress: true, city: true, state: true, zipCode: true },
  });
  if (!user || (user.streetAddress && user.city && user.state && user.zipCode)) return null;
  const membership = await db.exchangeMember.findFirst({
    where: { userId, exchange: { isLocalOnly: false, isWhiteElephant: false, status: { notIn: [...FINISHED_STATUSES] } } },
    orderBy: { joinedAt: 'asc' },
    select: { exchange: { select: { id: true, title: true } } },
  });
  if (!membership) return null;
  return {
    id: 'shipping-address',
    title: 'Action needed: add your shipping address',
    message: 'Your Secret Santa needs an address to send your gift. The draw waits until every agent has one.',
    exchangeId: membership.exchange.id,
    missionName: membership.exchange.title,
    kind: 'action',
    createdAt: new Date(0).toISOString(),
    href: null,
    tone: 'warning',
    action: 'shipping',
    actionLabel: 'Add my address',
  };
}

type NotificationRow = { id: string; title: string; message: string; exchangeId: string | null; dedupeKey: string | null; createdAt: Date };

const ROW_SELECT = { id: true, title: true, message: true, exchangeId: true, dedupeKey: true, createdAt: true } as const;

/** Rows → views, with each mission's name and link. */
async function toViews(db: PrismaClient, rows: NotificationRow[]): Promise<NotificationView[]> {
  const exchangeIds = [...new Set(rows.map((r) => r.exchangeId).filter((id): id is string => Boolean(id)))];
  const exchanges = exchangeIds.length
    ? await db.exchange.findMany({ where: { id: { in: exchangeIds } }, select: { id: true, code: true, title: true } })
    : [];
  const byId = new Map(exchanges.map((e) => [e.id, e]));
  return rows.map((r) => {
    const ex = r.exchangeId ? byId.get(r.exchangeId) : undefined;
    return {
      id: r.id,
      title: displayTitle(r.title, ex?.title),
      message: r.message,
      exchangeId: r.exchangeId,
      missionName: ex?.title ?? null,
      kind: notificationKind(r.dedupeKey, r.title),
      createdAt: new Date(r.createdAt).toISOString(),
      href: notificationHref(ex?.code),
    };
  });
}

/** The page a notification about a mission opens. */
export function notificationHref(exchangeCode: string | null | undefined): string | null {
  return exchangeCode ? `/exchange/${encodeURIComponent(exchangeCode)}` : null;
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

/**
 * The caller's open notifications, newest first: `pinned` (cannot be removed) and `notifications`
 * (the rest, at most `MAX_LISTED_NOTIFICATIONS`; `total` counts all of them).
 * `summary: true` skips the rows and returns only `total` and `pinnedCount` (the header badge).
 */
export async function listMyNotifications(db: PrismaClient, userId: string, options: { summary?: boolean } = {}): Promise<NotificationResult> {
  const open = { userId, isAcknowledged: false };
  const unpinned = { AND: [open, UNPINNED_WHERE] };
  const pinnedWhere = { AND: [open, PINNED_WHERE] };

  if (options.summary) {
    const [total, pinnedStored, address] = await Promise.all([
      db.notification.count({ where: unpinned }),
      db.notification.count({ where: pinnedWhere }),
      shippingAddressAlert(db, userId),
    ]);
    return { status: 200, body: { success: true, total, pinnedCount: pinnedStored + (address ? 1 : 0) } };
  }

  const [rows, total, pinnedRows, address] = await Promise.all([
    db.notification.findMany({ where: unpinned, orderBy: { createdAt: 'desc' }, take: MAX_LISTED_NOTIFICATIONS, select: ROW_SELECT }),
    db.notification.count({ where: unpinned }),
    db.notification.findMany({ where: pinnedWhere, orderBy: { createdAt: 'desc' }, select: ROW_SELECT }),
    shippingAddressAlert(db, userId),
  ]);

  const [notifications, pinnedViews] = await Promise.all([toViews(db, rows), toViews(db, pinnedRows)]);
  const pinned: PinnedAlert[] = pinnedViews.map((v) => ({
    ...v,
    tone: 'danger',
    action: null,
    actionLabel: v.kind === 'paused' ? 'Fix the draw' : 'Open mission',
  }));
  if (address) pinned.push(address);

  return { status: 200, body: { success: true, notifications, total, pinned } };
}

/** Removes the caller's notifications: `{ ids: string[] }` or `{ all: true }`. Pinned ones stay. */
export async function dismissNotifications(
  db: PrismaClient,
  input: { userId: string; ids?: unknown; all?: unknown }
): Promise<NotificationResult> {
  const conditions: Prisma.NotificationWhereInput[] = [{ userId: input.userId, isAcknowledged: false }, UNPINNED_WHERE];

  if (input.all !== true) {
    if (!Array.isArray(input.ids) || input.ids.length === 0 || !input.ids.every((id) => typeof id === 'string' && id.length > 0)) {
      return { status: 400, body: { error: 'Provide notification ids or all: true' } };
    }
    if (input.ids.length > MAX_DISMISS_IDS) {
      return { status: 400, body: { error: `Remove at most ${MAX_DISMISS_IDS} notifications at once` } };
    }
    conditions.push({ id: { in: input.ids as string[] } });
  }

  const result = await db.notification.updateMany({ where: { AND: conditions }, data: { isAcknowledged: true } });
  return { status: 200, body: { success: true, removed: result.count } };
}
