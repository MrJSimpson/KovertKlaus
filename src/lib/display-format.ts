/**
 * @file display-format.ts
 * @description Small display helpers for the refreshed signed-in pages.
 *
 * Tier 1 (what): `formatBudget` ("$25–$50"), `relativeTime` ("2h ago", "Yesterday"),
 * `stripLeadingEmoji` (alert titles without their emoji prefix).
 * Tier 2 (why): The Design System puts no emoji in interface chrome; notification titles are stored
 * with an emoji prefix (`mission-*.ts`) until Alerts gets its `kind` field, so the dashboard's alert
 * card strips it for display. Budgets and times read the same on every card.
 * Tier 3 (how): Pure; `now` is injectable for tests.
 */

/** "$25–$50", or "$40" when there is no minimum (or it equals the maximum). */
export function formatBudget(min: number | string | null | undefined, max: number | string | null | undefined, currency = 'USD'): string {
  const fmt = (v: number) => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
    } catch {
      return `${v}`;
    }
  };
  const lo = Number(min ?? 0);
  const hi = Number(max ?? 0);
  return !lo || lo === hi ? fmt(hi) : `${fmt(lo)}–${fmt(hi)}`;
}

/** "Just now", "5m ago", "2h ago", "Yesterday", "3 days ago", then "12 Dec". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const mins = Math.floor((now.getTime() - t.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Drops leading emoji (and the space after them) from a title: "🎯 Targets drawn" → "Targets drawn". */
export function stripLeadingEmoji(title: string): string {
  return title.replace(/^(?:[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️]+\s*)+/u, '').trim() || title;
}
