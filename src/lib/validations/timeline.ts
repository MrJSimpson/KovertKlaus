/**
 * @file timeline.ts
 * @description Rules for moving a Holiday Mission's timeline dates after creation.
 *
 * Tier 1 (what): `changeEventDate(timeline, eventIndex, newDate, today)` moves one date;
 * `changeEventDates(timeline, changes, today)` moves several at once. Both return the fields to
 * write, or throw a `TimelineChangeError` that explains which rule failed.
 * Tier 2 (why): Edits used to re-run the creation validator on all four dates, which rejects any
 * date before today. Once the Go/No-Go cutoff had passed, the Head Elf could not move any date,
 * not even a future ship deadline. Only the dates being changed should be checked against today.
 * Tier 3 (how): The timeline is indexed 0 Go/No-Go cutoff, 1 Target Draw, 2 Ship Deadline
 * (optional), 3 Exchange Day. A changed date must be after today, and after applying every change
 * the dates that are set must run strictly forward in index order. Checking the finished timeline
 * (rather than each change in turn) lets the Head Elf push several dates back together without
 * having to save them in a particular order. Dates compare by UTC calendar day.
 */

/** Timeline events in order. The index is the `eventIndex` used by `changeEventDate`. */
export const TIMELINE_EVENTS = ['inviteCutoffDate', 'assignmentDate', 'shippingDate', 'executionDate'] as const;

/** One timeline field on `Exchange`. */
export type TimelineEvent = (typeof TIMELINE_EVENTS)[number];

/** Display names, matching the mission page. */
export const TIMELINE_EVENT_LABELS: Record<TimelineEvent, string> = {
  inviteCutoffDate: 'Go/No-Go Date',
  assignmentDate: 'Target Draw Date',
  shippingDate: 'Ship Deadline',
  executionDate: 'Exchange Day',
};

/** A mission's current dates. Only the ship deadline may be unset. */
export type Timeline = Record<TimelineEvent, Date | string | null>;

/** A rejected date change. `message` is safe to show the Head Elf. */
export class TimelineChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimelineChangeError';
  }
}

/** UTC calendar day (`YYYY-MM-DD`) of a date or date string, or null when unparseable. */
function dayKey(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function formatDay(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Validates moving several timeline dates at once.
 *
 * Entries equal to the current date are ignored, so a client may send the whole form.
 *
 * @param timeline - The mission's current dates.
 * @param changes - New dates by field (`YYYY-MM-DD` or ISO strings, or Dates).
 * @param today - The current time.
 * @returns Only the fields that actually change, as Dates ready to write.
 * @throws TimelineChangeError when a date is invalid, not after today, or out of order.
 */
export function changeEventDates(
  timeline: Timeline,
  changes: Partial<Record<TimelineEvent, Date | string | null | undefined>>,
  today: Date
): Partial<Record<TimelineEvent, Date>> {
  const todayKey = dayKey(today)!;
  const next: Record<TimelineEvent, string | null> = {
    inviteCutoffDate: dayKey(timeline.inviteCutoffDate),
    assignmentDate: dayKey(timeline.assignmentDate),
    shippingDate: dayKey(timeline.shippingDate),
    executionDate: dayKey(timeline.executionDate),
  };
  const updates: Partial<Record<TimelineEvent, Date>> = {};

  for (const [field, raw] of Object.entries(changes)) {
    if (!(TIMELINE_EVENTS as readonly string[]).includes(field)) {
      throw new TimelineChangeError(`Unknown timeline event: ${field}`);
    }
    const event = field as TimelineEvent;
    if (raw == null || raw === '') continue; // left blank: keep the current date
    const key = dayKey(raw);
    if (!key) throw new TimelineChangeError(`${TIMELINE_EVENT_LABELS[event]} is not a valid date.`);
    if (key === next[event]) continue;
    if (key <= todayKey) {
      throw new TimelineChangeError(`${TIMELINE_EVENT_LABELS[event]} must be after today.`);
    }
    next[event] = key;
    updates[event] = new Date(`${key}T00:00:00Z`);
  }

  // Every set date must come strictly after the previous set date.
  let previous: TimelineEvent | null = null;
  for (const event of TIMELINE_EVENTS) {
    const key = next[event];
    if (!key) continue;
    if (previous && key <= next[previous]!) {
      throw new TimelineChangeError(
        `${TIMELINE_EVENT_LABELS[event]} (${formatDay(key)}) must be after ${TIMELINE_EVENT_LABELS[previous]} (${formatDay(next[previous]!)}).`
      );
    }
    previous = event;
  }

  return updates;
}

/**
 * Validates moving one timeline date.
 *
 * @param timeline - The mission's current dates.
 * @param eventIndex - 0 Go/No-Go, 1 Target Draw, 2 Ship Deadline, 3 Exchange Day.
 * @param newDate - The requested date.
 * @param today - The current time.
 * @returns The field to write (empty when the date is unchanged).
 * @throws TimelineChangeError for an unknown index or a date that breaks the rules.
 */
export function changeEventDate(timeline: Timeline, eventIndex: number, newDate: Date | string, today: Date) {
  const event = TIMELINE_EVENTS[eventIndex];
  if (!Number.isInteger(eventIndex) || !event) {
    throw new TimelineChangeError(`eventIndex must be 0 to ${TIMELINE_EVENTS.length - 1}.`);
  }
  return changeEventDates(timeline, { [event]: newDate }, today);
}

/**
 * Route-level wrapper used by the worker and the Next route for `PATCH /api/operations` `dates`.
 *
 * Completed missions are frozen. Any other rule failure becomes a 400 with the rule's message.
 *
 * @param exchange - The mission's current status and dates.
 * @param dates - The request's `dates` object (whole form or just the changed fields).
 * @param now - The current time.
 */
export function resolveTimelineUpdate(
  exchange: Timeline & { status: string },
  dates: unknown,
  now: Date
): { ok: true; data: Partial<Record<TimelineEvent, Date>> } | { ok: false; status: number; error: string } {
  if (exchange.status === 'COMPLETED') {
    return { ok: false, status: 409, error: 'This mission is complete; its dates can no longer change.' };
  }
  if (!dates || typeof dates !== 'object') {
    return { ok: false, status: 400, error: 'dates must be an object of timeline fields.' };
  }
  try {
    return { ok: true, data: changeEventDates(exchange, dates as Record<TimelineEvent, string>, now) };
  } catch (err) {
    if (err instanceof TimelineChangeError) return { ok: false, status: 400, error: err.message };
    throw err;
  }
}
