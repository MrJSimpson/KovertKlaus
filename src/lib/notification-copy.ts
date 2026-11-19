/**
 * @file notification-copy.ts
 * @description Every in-app notification's key, title and message, in one place.
 *
 * Tier 1 (what): One function per kind of notification returns `{ dedupeKey, title, message }` for
 * `notifyOnce`. `notificationKind` maps a stored notification back to its kind (for the Alerts
 * page icon), and `displayTitle` tidies titles stored before this copy existed.
 * Tier 2 (why): Visual refresh (2.0.0-beta, owner decision 2026-11-19: rewrite the wording). The
 * Alerts page shows the mission name on its own line, so titles no longer repeat it or carry an
 * emoji, and the same wording used to be copied between the Next routes, the worker and the libs.
 * Tier 3 (how): The kind is the `dedupeKey` prefix (text before the first `:`). Notices that may
 * repeat (broadcasts, nudges) get a unique key per send, so they still stack. Rows stored before
 * 2.0.0-beta without a key are classified by their old title.
 */

/** What an alert is about; picks its icon on the Alerts page. */
export type NotificationKind =
  | 'target'
  | 'draw'
  | 'paused'
  | 'action'
  | 'cancelled'
  | 'deleted'
  | 'agent-left'
  | 'join'
  | 'invite'
  | 'milestone'
  | 'coal'
  | 'cleared'
  | 'shipped'
  | 'message'
  | 'general';

/** A notification ready for `notifyOnce` (plus `userId` and `exchangeId`). */
export interface NoticeCopy {
  dedupeKey: string;
  title: string;
  message: string;
}

/**
 * Key prefixes of pinned notices: repair notices that block a mission. `mission-repair.ts` deletes
 * them once the mission is fixed, so agents cannot remove them and Clear all skips them.
 */
export const PINNED_KEY_PREFIXES = ['repair', 'repair-agent'] as const;

/** `dedupeKey` prefix → kind. */
const KIND_BY_PREFIX: Record<string, NotificationKind> = {
  'target-assigned': 'target',
  'draw-blocked': 'draw',
  repair: 'paused',
  'repair-agent': 'action',
  'mission-cancelled': 'cancelled',
  'mission-deleted': 'deleted',
  'mission-deleted-account': 'deleted',
  'agent-account-deleted': 'agent-left',
  'join-requests': 'join',
  'join-request-decided': 'join',
  invited: 'invite',
  'recruitment-closed': 'milestone',
  'shipping-deadline': 'milestone',
  'exchange-day': 'milestone',
  'coal-issued': 'coal',
  'coal-cleared': 'cleared',
  'gift-shipped': 'shipped',
  broadcast: 'message',
  nudge: 'message',
};

/** Title starts of notifications stored before 2.0.0-beta without a key. */
const LEGACY_TITLE_KINDS: Array<[string, NotificationKind]> = [
  ['🎯', 'target'],
  ['📢', 'message'],
  ['🔔 Mission Nudge', 'message'],
  ['📩', 'invite'],
  ['🔒', 'milestone'],
  ['📦 Shipping Deadline', 'milestone'],
  ['🎉', 'milestone'],
  ['⚠️ Penalty', 'coal'],
  ['🌟', 'cleared'],
  ['🎁', 'shipped'],
  ['📦 Parcel', 'shipped'],
];

/** The kind of a stored notification, from its key, else its pre-2.0 title. */
export function notificationKind(dedupeKey: string | null | undefined, title: string): NotificationKind {
  if (dedupeKey) {
    const kind = KIND_BY_PREFIX[dedupeKey.split(':')[0]];
    if (kind) return kind;
  }
  for (const [start, kind] of LEGACY_TITLE_KINDS) if (title.startsWith(start)) return kind;
  return 'general';
}

/**
 * A title as the Alerts page shows it. Pre-2.0 titles started with an emoji and ended with
 * `: <mission name>`, which the page now shows on its own line; both are dropped.
 */
export function displayTitle(title: string, missionName: string | null | undefined): string {
  let t = title.replace(/^[^\p{L}\p{N}]+/u, '');
  if (missionName && t.endsWith(`: ${missionName}`)) t = t.slice(0, -(missionName.length + 2));
  return t.trim() || title;
}

/** A key that never repeats, for notices that should stack (each broadcast or nudge is its own). */
function uniqueKey(prefix: string, exchangeId: string): string {
  return `${prefix}:${exchangeId}:${crypto.randomUUID()}`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Every notification the app sends, by kind. */
export const NOTICE = {
  targetAssigned: (exchangeId: string): NoticeCopy => ({
    dedupeKey: `target-assigned:${exchangeId}`,
    title: 'Target assigned',
    message: 'Your target is ready. Open the mission to see their Wishlist Manifest.',
  }),

  drawFailed: (exchangeId: string, reason: string): NoticeCopy => ({
    dedupeKey: `draw-blocked:${exchangeId}`,
    title: 'Target draw pending',
    message: `The automatic draw on Assignment Day did not work (${reason}). Check the exclusion rules on the mission page.`,
  }),

  drawTooFew: (exchangeId: string, agents: number): NoticeCopy => ({
    dedupeKey: `draw-blocked:${exchangeId}`,
    title: 'Not enough agents to draw',
    message: `Assignment Day arrived with ${agents} ${plural(agents, 'agent', 'agents')}. The draw needs at least 4.`,
  }),

  missionPaused: (exchangeId: string, lines: string[], deadlineText: string): NoticeCopy => ({
    dedupeKey: `repair:${exchangeId}`,
    title: 'Mission paused: fix the draw',
    message: `The draw is on hold: ${lines.join(' ')} Remove the agent or extend the timeline by ${deadlineText}, or the mission will be cancelled. Recruiting is open again.`,
  }),

  agentActionNeeded: (exchangeId: string, todo: string, deadlineText: string): NoticeCopy => ({
    dedupeKey: `repair-agent:${exchangeId}`,
    title: 'Action needed: the draw is waiting on you',
    message: `Please ${todo} by ${deadlineText}, or the Head Elf may remove you from the mission.`,
  }),

  /** `message` is built by the caller: who cancelled, the reason, and per-agent notes. */
  missionCancelled: (exchangeId: string, message: string): NoticeCopy => ({
    dedupeKey: `mission-cancelled:${exchangeId}`,
    title: 'Mission cancelled',
    message,
  }),

  /** `by`: "You", "A KovertKlaus admin" or "KovertKlaus automatically". The mission is gone, so the message names it. */
  missionDeleted: (exchangeId: string, by: string, missionName: string): NoticeCopy => ({
    dedupeKey: `mission-deleted:${exchangeId}`,
    title: 'Mission deleted',
    message: `${by} permanently deleted the cancelled mission "${missionName}" and all its data. This cannot be undone.`,
  }),

  /** Stored without a mission link (account deletion), so the message names the mission. */
  agentLeft: (exchangeId: string, userId: string, missionName: string): NoticeCopy => ({
    dedupeKey: `agent-account-deleted:${exchangeId}:${userId}`,
    title: 'An agent left',
    message: `An agent deleted their KovertKlaus account and is no longer in "${missionName}". The draw has not happened yet, so nothing else changes.`,
  }),

  /** The mission is gone, so the message names it. */
  missionRemovedWithAccount: (exchangeId: string, missionName: string): NoticeCopy => ({
    dedupeKey: `mission-deleted-account:${exchangeId}`,
    title: 'Mission removed',
    message: `The Head Elf of "${missionName}" deleted their KovertKlaus account, so this finished mission and its history were deleted with it.`,
  }),

  joinRequests: (exchangeId: string, pending: number): NoticeCopy => ({
    dedupeKey: `join-requests:${exchangeId}`,
    title: plural(pending, 'Join request', `${pending} join requests`),
    message: `${plural(pending, 'An agent has', `${pending} agents have`)} asked to join with the mission code. Approve or decline on the mission page.`,
  }),

  /** Stored without a mission link (the agent is not in it), so the message names the mission. */
  joinDeclined: (exchangeId: string, missionName: string): NoticeCopy => ({
    dedupeKey: `join-request-decided:${exchangeId}`,
    title: 'Request declined',
    message: `The Head Elf declined your request to join "${missionName}".`,
  }),

  joinApproved: (exchangeId: string): NoticeCopy => ({
    dedupeKey: `join-request-decided:${exchangeId}`,
    title: "You're in",
    message: 'The Head Elf approved your request. Open the mission to pick your codename and fill in your Wishlist Manifest.',
  }),

  invited: (exchangeId: string, headElfName: string | null | undefined): NoticeCopy => ({
    dedupeKey: `invited:${exchangeId}`,
    title: 'Mission invitation',
    message: `${headElfName || 'A Head Elf'} invited you to join this mission. Accept or decline here or on the mission page.`,
  }),

  recruitmentClosed: (exchangeId: string): NoticeCopy => ({
    dedupeKey: `recruitment-closed:${exchangeId}`,
    title: 'Recruiting closed',
    message: 'The RSVP cutoff has passed. No new agents can join, and the mission moved to setup.',
  }),

  shippingDeadline: (exchangeId: string): NoticeCopy => ({
    dedupeKey: `shipping-deadline:${exchangeId}`,
    title: 'Shipping deadline reached',
    message: 'Gifts should be on their way now. Add your tracking number or confirm local delivery on the mission page.',
  }),

  exchangeDay: (exchangeId: string): NoticeCopy => ({
    dedupeKey: `exchange-day:${exchangeId}`,
    title: 'Exchange Day is here',
    message: 'Exchange Day has arrived. Enjoy the unwrapping!',
  }),

  coalIssued: (exchangeId: string, points: number, status: string): NoticeCopy => ({
    dedupeKey: `coal-issued:${exchangeId}`,
    title: 'Coal Citation issued',
    message: `Your gift was not shipped or delivered by Exchange Day, so you received 1 Coal Citation. You now have ${points}. Account status: ${status}.`,
  }),

  coalCleared: (exchangeId: string, points: number, status: string): NoticeCopy => ({
    dedupeKey: `coal-cleared:${exchangeId}`,
    title: 'Coal Citation cleared',
    message: `You delivered your gift, so 1 Coal Citation was removed. You now have ${points}. Account status: ${status}.`,
  }),

  giftShipped: (exchangeId: string, delivery: { local: true } | { local: false; carrierName: string; tracking: string }): NoticeCopy => ({
    dedupeKey: `gift-shipped:${exchangeId}`,
    title: delivery.local ? 'Gift on its way by hand' : 'Gift shipped',
    message: delivery.local
      ? 'Your Secret Santa will deliver your gift in person. Keep an eye out!'
      : `Your Secret Santa shipped your gift with ${delivery.carrierName}. Tracking number: ${delivery.tracking}.`,
  }),

  broadcast: (exchangeId: string, text: string): NoticeCopy => ({
    dedupeKey: uniqueKey('broadcast', exchangeId),
    title: 'Message from the Head Elf',
    message: text,
  }),

  nudge: (exchangeId: string, text: string): NoticeCopy => ({
    dedupeKey: uniqueKey(NUDGE_KEY_PREFIX, exchangeId),
    title: 'Reminder from the Head Elf',
    message: text,
  }),
} as const;

/** `dedupeKey` prefix of nudges; the nudge cooldown looks them up by it. */
export const NUDGE_KEY_PREFIX = 'nudge';
