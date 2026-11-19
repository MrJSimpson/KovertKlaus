/**
 * @file alerts.ts
 * @description Pure helpers for the Alerts page: day groups, time labels and icons.
 *
 * Tier 1 (what): `groupAlerts` sorts notifications into Today / This week / Earlier,
 * `alertTimeLabel` gives each one a short time (`9:14 AM`, `Tue`, `Oct 24`), and `ALERT_ICON`
 * maps a notification kind to its icon.
 * Tier 2 (why): Visual refresh (2.0.0-beta, design canvas "Alerts"): alerts read as a timeline
 * instead of a flat list, so the newest problems stand out.
 * Tier 3 (how): Days are the viewer's local calendar days (the page runs in the browser). "This
 * week" means the six days before today, so a weekday label never repeats one in Today.
 */

import type { IconName } from '@/components/brand/Icon';
import type { NotificationKind } from '@/lib/notification-copy';

export type AlertGroupKey = 'today' | 'week' | 'earlier';

export const ALERT_GROUP_LABEL: Record<AlertGroupKey, string> = {
  today: 'Today',
  week: 'This week',
  earlier: 'Earlier',
};

/** Local midnight of `now`'s day. */
function startOfDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Which group an alert created at `iso` falls in, seen at `now`. Future times count as today. */
export function alertGroup(iso: string, now: Date): AlertGroupKey {
  const t = new Date(iso).getTime();
  const today = startOfDay(now);
  if (t >= today) return 'today';
  // Six calendar days back; `new Date(y, m, d - 6)` keeps DST days whole.
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  return t >= weekStart ? 'week' : 'earlier';
}

/** Alerts in their groups, in order, skipping empty groups; items keep their order (newest first). */
export function groupAlerts<T extends { createdAt: string }>(items: T[], now: Date): Array<{ key: AlertGroupKey; label: string; items: T[] }> {
  const groups: Record<AlertGroupKey, T[]> = { today: [], week: [], earlier: [] };
  for (const item of items) groups[alertGroup(item.createdAt, now)].push(item);
  return (Object.keys(groups) as AlertGroupKey[])
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ key, label: ALERT_GROUP_LABEL[key], items: groups[key] }));
}

/** `9:14 AM` today, `Tue` this week, `Oct 24` earlier (`Oct 24, 2025` in another year). */
export function alertTimeLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const group = alertGroup(iso, now);
  if (group === 'today') return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (group === 'week') return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** The full date and time, for the label's `title` and `dateTime`. */
export function alertFullTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

/** The icon each kind of alert shows. */
export const ALERT_ICON: Record<NotificationKind, IconName> = {
  target: 'target',
  draw: 'clock',
  paused: 'pause',
  action: 'alert',
  cancelled: 'ban',
  deleted: 'trash',
  'agent-left': 'user',
  join: 'plus',
  invite: 'ticket',
  milestone: 'calendar',
  coal: 'alert',
  cleared: 'star',
  shipped: 'package',
  message: 'send',
  general: 'bell',
};

