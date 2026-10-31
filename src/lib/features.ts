/**
 * @file features.ts
 * @description The copy for the Features & Specs page (`/features`).
 *
 * Tier 1 (what): Feature groups (`FEATURE_GROUPS`) and the facts they quote (`FEATURE_FACTS`), in
 * plain language, rendered by `src/app/features/page.tsx`.
 * Tier 2 (why): The old page quoted things that were no longer true (a license date that does not
 * exist, three carriers instead of four, citation tiers worded loosely) and missed most of what
 * shipped since alpha (owner request 2026-10-31). Copy that quotes numbers drifts unless something
 * checks it.
 * Tier 3 (how): Platform caps come straight from `PLATFORM_LIMIT_BOUNDS` (safe in the browser).
 * Numbers that live in server-only modules are written here and checked against their sources by
 * `features.test.ts`, so a change there fails the tests until this page is updated.
 */

import { PLATFORM_LIMIT_BOUNDS } from '@/lib/platform-limits';

/** Numbers the page quotes. `features.test.ts` checks each against the code that enforces it. */
export const FEATURE_FACTS = {
  maxAgents: PLATFORM_LIMIT_BOUNDS.maxMissionAgents.default,
  minAgents: PLATFORM_LIMIT_BOUNDS.maxMissionAgents.min,
  maxHostedMissions: PLATFORM_LIMIT_BOUNDS.maxActiveHostedMissions.default,
  maxWishlistItems: PLATFORM_LIMIT_BOUNDS.maxWishlistItems.default,
  maxItemQuantity: PLATFORM_LIMIT_BOUNDS.maxItemQuantity.default,
  /** `PRODUCT_FETCH_TIMEOUT_MS` in `src/lib/product-fetch.ts`. */
  productFetchSeconds: 2.5,
  /** `deriveAccountStatus` in `src/lib/demerits.ts`. */
  citationsRestricted: 3,
  citationsSuspended: 4,
  /** `PURGE_AFTER_MS` in `src/lib/mission-cancel.ts`. */
  cancelledPurgeDays: 90,
  /** `RESET_LINK_TTL_MS` in `src/lib/password-reset.ts`. */
  resetLinkMinutes: 30,
  /** `JOIN_LIMITS` in `src/lib/join-throttle.ts`. */
  wrongCodesPerHour: 10,
  /** Carriers whose tracking numbers protect an agent from Coal Citations. */
  carriers: ['USPS', 'FedEx', 'UPS', 'DHL'] as const,
} as const;

/** One feature group: an icon, a heading, a lead sentence and short points. */
export interface FeatureGroup {
  id: string;
  icon: string;
  heading: string;
  lead: string;
  points: string[];
}

const f = FEATURE_FACTS;

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'fair-draw',
    icon: '🔗',
    heading: 'A fair draw, every time',
    lead: 'On Assignment Day, KovertKlaus draws one gift circle through every agent, so everyone gives once and receives once.',
    points: [
      'Nobody draws themselves, and no two agents draw each other.',
      'The circle is drawn at random (Sattolo\'s algorithm), so nobody can steer who gets whom.',
      'Head Elves can keep pairs apart (partners, roommates). A rule always works both ways, and a rule that would make the draw impossible is refused before it is saved.',
      'If something blocks the draw, such as a missing address, the mission pauses and tells exactly who needs to fix what, instead of failing.',
      'The Head Elf can swap a target after the draw, and the circle stays whole.',
    ],
  },
  {
    id: 'secrecy',
    icon: '🕶️',
    heading: 'Secrets stay secret',
    lead: 'Agents know each other by codename. Real names and addresses only go where they are needed.',
    points: [
      'Every agent gets a codename for each mission and can reroll it before accepting.',
      'Only the Head Elf sees real names, so they can confirm who joined.',
      'Your Secret Santa sees your name and shipping address because they need them to send your gift.',
      'Sizes, measurements, favorites and allergies are shown to the Head Elf only if you switch "Head Elf can see" on.',
      'Someone with a mission code who is not in the mission sees only its title, dates and budget.',
      'No ads, no analytics, no tracking. See the Privacy Policy for exactly what is kept and why.',
    ],
  },
  {
    id: 'wishlists',
    icon: '📋',
    heading: 'Wishlists that ship',
    lead: 'Paste a store link and KovertKlaus fills in the item for you.',
    points: [
      `Title, picture and price are fetched from the store page. If the store doesn't answer within ${f.productFetchSeconds} seconds, you type the details instead, so you are never stuck waiting.`,
      `Up to ${f.maxWishlistItems} items per Secret Santa wishlist, with a quantity of up to ${f.maxItemQuantity} each.`,
      'Each item stays within the mission budget. The Head Elf decides whether the whole list may go over it.',
      'Sizes, allergies and dislikes travel with your list, so your Secret Santa can choose well.',
    ],
  },
  {
    id: 'shipping',
    icon: '📦',
    heading: 'Shipping and Coal Citations',
    lead: 'Coal Citations keep missions reliable without anyone having to chase people.',
    points: [
      `Add a tracking number from ${f.carriers.join(', ').replace(/, ([^,]*)$/, ' or $1')} and you are protected from Coal Citations for that gift.`,
      'A citation is only for a gift that never shipped and has no tracking by the party date.',
      `${f.citationsRestricted} Coal Citations limits you to in-person missions; ${f.citationsSuspended} or more suspends your account.`,
      'Every mission you complete afterwards removes one citation automatically.',
      'Citations follow fixed rules. KovertKlaus does not step into personal disputes between agents.',
    ],
  },
  {
    id: 'mission-tools',
    icon: '🎄',
    heading: 'Everything a Head Elf needs',
    lead: 'One invite link, a clear timeline and tools for when plans change.',
    points: [
      `Missions for ${f.minAgents} to ${f.maxAgents} agents. A Head Elf can run up to ${f.maxHostedMissions} missions at once.`,
      'Invite by email or share one link. Late Passes let someone join after RSVP closes.',
      'Four stages: RSVP, Match, Sleigh, Party. A notification bell shows what needs attention, and the Head Elf can nudge agents by email.',
      'Mission Comms for messages, an After-Action Report for thank-yous, and one guess at who your Secret Santa was.',
      `Cancelling notifies every agent. A cancelled mission is deleted ${f.cancelledPurgeDays} days later, keeping only an anonymous record of what happened.`,
    ],
  },
  {
    id: 'kovert-delivery',
    icon: '🎅',
    heading: 'Kovert Delivery',
    lead: 'Deliver your gift to their door in person, without being seen.',
    points: [
      'Invitations carry a private Kovert Delivery pass, and agents accept a Property Access Accord before joining.',
      'The recipient gets one guess at who delivered it.',
      'Stay unseen and earn the Kovert Klaus badge; get caught and they earn Vigilant Elf.',
    ],
  },
  {
    id: 'white-elephant',
    icon: '🐘',
    heading: 'White Elephant, in person',
    lead: 'White Elephant missions happen at a real party, because stealing gifts is more fun face to face.',
    points: [
      'Every White Elephant mission is in person.',
      'Each agent brings exactly one gift.',
    ],
  },
  {
    id: 'security',
    icon: '🔒',
    heading: 'Built to be safe',
    lead: 'Protections that work quietly in the background.',
    points: [
      'Passwords are stored as salted one-way hashes; sessions use a secure, HTTP-only cookie.',
      `Forgot your password? A single-use reset link by email, valid for ${f.resetLinkMinutes} minutes.`,
      `Sign-in, sign-up, password resets and mission codes are rate-limited; after ${f.wrongCodesPerHour} wrong mission codes in an hour, you wait.`,
      'Everything is sent over HTTPS.',
    ],
  },
];

/** The license summary under the feature cards. Mirrors `LICENSE.md`. */
export const LICENSE_SUMMARY = {
  label: 'Business Source License 1.1',
  heading: 'Free to self-host for non-commercial use',
  text:
    'You can run, change and self-host KovertKlaus free of charge for personal, family, non-profit, educational, home-lab or other non-commercial use. ' +
    'Running it as a paid or commercial hosted service is reserved to its author, Joshua Simpson. ' +
    'If the project is ever sold, the buyer must keep a complete open-source version available; the code becomes GPLv3 open source if that promise is broken, if the project closes, or if its author can no longer run it.',
  licenseUrl: 'https://github.com/MrJSimpson/KovertKlaus/blob/main/LICENSE.md',
};
