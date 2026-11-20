/**
 * @file guides.ts
 * @description The public how-to guides: their addresses, search text and content.
 *
 * Tier 1 (what): `GUIDES` (how a mission runs, White Elephant rules, exclusions, self-hosting),
 * `GUIDES_INDEX` (the `/guides` page), `guideBySlug`, and `GUIDE_FACTS`, the numbers the copy states.
 * Tier 2 (why): Owner decisions 2026-11-10 and 2026-11-19: plain-language guides shipped with the
 * visual refresh so the site can be found this season; addresses under `/guides`; linked from the
 * footer and the front page; each ends with a "start a mission" link. The text was approved by the
 * owner before the pages were built. White Elephant tips beyond the house rules are labelled as such.
 * Tier 3 (how): Content is data (`GuideBlock`), rendered by `src/components/guides/GuideArticle.tsx`.
 * `guides.test.ts` checks `GUIDE_FACTS` against the code (steal freeze, partner minimum) and the
 * exclusion examples against the real feasibility check, so the guides cannot drift from the app.
 */

import type { IllustrationName } from '@/components/art/illustrations';

/** Text inside a block: plain, bold, inline code or a link. */
export type Inline = string | { strong: string } | { code: string } | { href: string; text: string };

/** One block of a guide. */
export type GuideBlock =
  | { type: 'p'; text: Inline[] }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: Inline[][] }
  | { type: 'ol'; items: Inline[][] }
  | { type: 'code'; lines: string[] }
  | { type: 'note'; text: Inline[] }
  | { type: 'examples'; items: { works: boolean; title: string; text: string }[] };

export interface Guide {
  slug: string;
  /** Page address, also listed in `SITEMAP_PATHS`. */
  path: string;
  /** Page heading. */
  title: string;
  /** `<title>` and share title. */
  searchTitle: string;
  /** Meta description. */
  description: string;
  /** One line for the guide cards. */
  summary: string;
  /** First paragraph under the heading. */
  lead: string;
  art: IllustrationName;
  cta: { label: string; href: string };
  blocks: GuideBlock[];
}

/** Numbers the guides state, checked against the code by `guides.test.ts`. */
export const GUIDE_FACTS = {
  /** A White Elephant gift freezes after this many steals (`whiteElephant.ts` default). */
  freezeAfterSteals: 3,
  /** Allowed partners every agent keeps (`draw.ts` feasibility check). */
  minAllowedPartners: 2,
  /** Agents who must be ready for a Secret Santa draw (`MIN_PARTICIPANTS` in `draw.ts`). */
  minReadyAgents: 4,
  /** Carriers whose tracking protects from Coal Citations (`FEATURE_FACTS.carriers`). */
  carriers: ['USPS', 'FedEx', 'UPS', 'DHL'],
  /** Days until a cancelled mission is deleted (`PURGE_AFTER_MS` in `mission-cancel.ts`). */
  cancelledPurgeDays: 90,
  /** Owner recommendation (2026-11-19): at least this many days between stages. */
  minDaysBetweenStages: 7,
  /** So a mission starts this many weeks before Exchange Day (the dates make four equal gaps). */
  minLeadWeeks: 4,
} as const;

const START = '/register?next=start';
const SOURCE = 'https://github.com/MrJSimpson/KovertKlaus';

export const GUIDES_INDEX = {
  path: '/guides',
  title: 'Gift exchange guides',
  searchTitle: 'Gift exchange guides | KovertKlaus',
  description:
    'Plain-language guides: an online Secret Santa step by step, keeping couples apart, White Elephant rules, and hosting KovertKlaus yourself.',
  lead: 'Short, practical guides for running a gift exchange people actually enjoy.',
} as const;

export const GUIDES: Guide[] = [
  {
    slug: 'how-a-mission-runs',
    path: '/guides/how-a-mission-runs',
    title: 'How a Secret Santa mission runs',
    searchTitle: 'How to run an online Secret Santa, step by step | KovertKlaus',
    description:
      'Every stage of an online Secret Santa, from invitations to the draw, shipping and Exchange Day, and what the organizer and each player do.',
    summary: 'Every stage from the first invite to Exchange Day, and who does what.',
    lead:
      'A KovertKlaus Secret Santa runs in four stages: RSVP, Match, Sleigh and Party. Here’s what happens in each one and who does what. The Head Elf is the organizer; Elf Agents are everyone taking part, the Head Elf included.',
    art: 'rsvp',
    cta: { label: 'Start a Secret Santa', href: START },
    blocks: [
      { type: 'h2', text: 'Before you start (Head Elf)' },
      {
        type: 'ul',
        items: [
          [{ strong: 'Pick a budget.' }, ' Each item on a wishlist has to fit it.'],
          [
            { strong: 'Pick Exchange Day,' },
            ' when everyone opens their gifts. KovertKlaus sets the other three dates for you, evenly spaced between today and Exchange Day: ',
            { strong: 'RSVP by' },
            ' (the last day to join), ',
            { strong: 'Assignment Day' },
            ' (the draw) and ',
            { strong: 'Ship by' },
            ' (the last day to send gifts).',
          ],
        ],
      },
      {
        type: 'note',
        text: [
          'We recommend at least 7 days between stages, so everyone has time to do their part. That means starting the mission at least four weeks before Exchange Day.',
        ],
      },
      { type: 'h2', text: '1. RSVP: everyone joins' },
      { type: 'h3', text: 'Head Elf' },
      {
        type: 'ul',
        items: [
          ['Start a mission and invite people by email or by sharing the mission code.'],
          ['People you invite by email join straight away. Anyone using the code needs your approval first.'],
          ['A Late Pass lets someone join after RSVP closes.'],
          ['Need to keep couples or family apart? Add blocked pairs (see ', { href: '/guides/secret-santa-exclusions', text: 'Secret Santa with exclusions' }, ').'],
        ],
      },
      { type: 'h3', text: 'Agents' },
      {
        type: 'ul',
        items: [
          [{ strong: 'Accept a codename.' }, ' Everyone gets one for the mission; reroll it until you like it.'],
          [{ strong: 'Build your Wishlist Manifest.' }, ' Paste a store link and KovertKlaus fills in the item.'],
          [{ strong: 'Add your shipping address on your Profile,' }, ' plus sizes, allergies and dislikes if you like.'],
          [{ strong: 'Verify your email address.' }],
        ],
      },
      { type: 'h2', text: '2. Match: the draw' },
      {
        type: 'ul',
        items: [
          [
            { strong: 'On Assignment Day, KovertKlaus draws one gift circle' },
            ' through every agent. Each agent learns only who they’re buying for (their target), in the app and by email. The Head Elf can also draw early.',
          ],
          [{ strong: 'The draw needs at least four agents who are ready:' }, ' at least one gift on their wishlist, a shipping address and a verified email.'],
          [{ strong: 'If someone isn’t ready, the mission pauses.' }, ' It tells exactly who needs to fix what, and the draw runs once they have.'],
          [{ strong: 'The Head Elf can swap a target after the draw' }, ' without breaking the circle.'],
        ],
      },
      { type: 'h2', text: '3. Sleigh: shopping and shipping' },
      {
        type: 'ul',
        items: [
          [
            { strong: 'Agents:' },
            ' open your target’s dossier (their wishlist, sizes, dislikes and address), buy a gift, and ship it by the Ship-by date. Then ',
            { strong: 'add the tracking number' },
            ' (USPS, FedEx, UPS or DHL).',
          ],
          [{ strong: 'Head Elf:' }, ' nudge anyone who is behind. They get a reminder by email.'],
          [
            { strong: 'About Coal Citations:' },
            ' a citation is only for a gift that never shipped and has no tracking by Exchange Day. Tracking protects you, even if the parcel is late.',
          ],
        ],
      },
      { type: 'h2', text: '4. Party: Exchange Day' },
      {
        type: 'ul',
        items: [
          [{ strong: 'Open your gift.' }],
          [{ strong: 'Make one guess' }, ' at who your Secret Santa was.'],
          [{ strong: 'Post a thank-you' }, ' in the After-Action Report.'],
          [{ strong: 'Mission Comms' }, ' is open the whole time for messages to the group.'],
        ],
      },
      { type: 'h2', text: 'When plans change' },
      {
        type: 'ul',
        items: [
          [{ strong: 'Someone can’t take part?' }, ' They can leave before the draw.'],
          [{ strong: 'Need to call it off?' }, ' Cancelling notifies every agent. A cancelled mission is deleted after 90 days.'],
        ],
      },
    ],
  },
  {
    slug: 'white-elephant',
    path: '/guides/white-elephant',
    title: 'How to run a White Elephant exchange',
    searchTitle: 'How to run a White Elephant gift exchange (rules and stealing) | KovertKlaus',
    description:
      'Simple White Elephant rules: turn order, how stealing works, the three-steal freeze and the final swap. Plus tips for budgets and big groups.',
    summary: 'The rules, how stealing works, and how to keep it moving.',
    lead:
      'A White Elephant is a party game: everyone brings one wrapped gift, and on your turn you open a new gift or steal one someone already opened. Here are rules that keep it fair and fun.',
    art: 'party',
    cta: { label: 'Start a White Elephant mission', href: START },
    blocks: [
      { type: 'h2', text: 'Before the party' },
      {
        type: 'ul',
        items: [
          [{ strong: 'Set a budget.' }, ' $20–$30 is common. Everyone brings one wrapped gift in that range.'],
          [{ strong: 'Decide on the theme, if any:' }, ' funny, useful, homemade, or anything goes.'],
          [{ strong: 'Plan for time.' }, ' Allow two to three minutes per player.'],
        ],
      },
      { type: 'h2', text: 'The rules' },
      {
        type: 'ol',
        items: [
          [{ strong: 'Draw numbers' }, ' to set the turn order.'],
          [{ strong: 'Player 1 opens' }, ' a gift from the pile and shows it to everyone.'],
          [{ strong: 'Each following player chooses:' }, ' open a new gift from the pile, or steal a gift someone already opened.'],
          [
            { strong: 'If your gift is stolen,' },
            ' you choose right away: steal a different gift, or open one from the pile. You can’t steal back the gift that was just taken from you.',
          ],
          [{ strong: 'A gift freezes after its third steal.' }, ' Whoever holds it then keeps it for the rest of the game.'],
          [{ strong: 'A turn ends when someone opens a gift from the pile.' }],
          [
            { strong: 'The final swap.' },
            ' Once the pile is empty, Player 1 gets one last turn: keep their gift, or swap with any gift that isn’t frozen. Then the game is over.',
          ],
        ],
      },
      { type: 'h2', text: 'Optional house rules' },
      {
        type: 'note',
        text: ['These go beyond the standard rules above, which are the ones KovertKlaus uses. Agree on them before the first turn.'],
      },
      {
        type: 'ul',
        items: [
          [{ strong: 'Big group (20+)?' }, ' Freeze gifts after two steals so the game doesn’t drag.'],
          [{ strong: 'Make steals visible.' }, ' Put a sticker or mark on a gift each time it’s stolen, so everyone can see when it freezes.'],
          [{ strong: 'Want more mystery?' }, ' Keep gifts wrapped until the end, and let people steal blind.'],
        ],
      },
      { type: 'h2', text: 'How KovertKlaus helps' },
      {
        type: 'p',
        text: [
          'KovertKlaus organizes the party before it starts: invite everyone with one code, set the date and budget, and each agent registers the one gift they’re bringing, so nobody forgets. The game itself happens face to face, because stealing gifts is more fun in person.',
        ],
      },
    ],
  },
  {
    slug: 'secret-santa-exclusions',
    path: '/guides/secret-santa-exclusions',
    title: 'Secret Santa with exclusions',
    searchTitle: 'Secret Santa with exclusions: keep couples and families apart | KovertKlaus',
    description:
      'How to run a Secret Santa where couples, families or roommates can’t draw each other, and why some exclusion setups can’t work.',
    summary: 'Keep couples, families and roommates from drawing each other.',
    lead:
      'In many groups, some people shouldn’t draw each other: couples who already buy for each other, siblings, roommates. Exclusions let you block those pairs and still get a fair, random draw.',
    art: 'match',
    cta: { label: 'Start a Secret Santa', href: START },
    blocks: [
      { type: 'h2', text: 'How exclusions work in KovertKlaus' },
      {
        type: 'ul',
        items: [
          [{ strong: 'The Head Elf (the organizer) adds blocked pairs' }, ' on the mission page, after both people have joined and before the draw.'],
          [{ strong: 'A blocked pair works both ways.' }, ' If Sam can’t draw Alex, Alex can’t draw Sam either.'],
          [
            { strong: 'Everyone gives once and receives once,' },
            ' in one big gift circle. Nobody draws themselves, and no two people simply swap gifts with each other.',
          ],
        ],
      },
      { type: 'h2', text: 'Why some setups are refused' },
      {
        type: 'p',
        text: ['Every rule removes options, and too many rules can make a fair draw impossible. So KovertKlaus checks each new rule and refuses it if:'],
      },
      {
        type: 'ul',
        items: [
          ['someone would have ', { strong: 'fewer than two people' }, ' they’re allowed to draw, or'],
          ['the rules would make ', { strong: 'one gift circle' }, ' impossible.'],
        ],
      },
      { type: 'p', text: ['You find out when you add the rule, not on draw day.'] },
      { type: 'h2', text: 'Examples' },
      {
        type: 'examples',
        items: [
          { works: true, title: 'Three couples (six people)', text: 'Block each couple. Everyone still has four people they can draw.' },
          { works: true, title: 'Two couples (four people)', text: 'Block each couple. Everyone still has two options, so it works.' },
          {
            works: false,
            title: 'A family of four plus one friend',
            text: 'Block every family pair, and each family member can only draw the friend. That’s refused: everyone needs at least two options. Invite a few more people, or block fewer pairs.',
          },
        ],
      },
      { type: 'h2', text: 'Tips' },
      {
        type: 'ul',
        items: [
          ['Block only the pairs that matter. Every extra rule makes the draw more predictable.'],
          ['Groups of six or more give exclusions the most room.'],
        ],
      },
    ],
  },
  {
    slug: 'self-hosted-secret-santa',
    path: '/guides/self-hosted-secret-santa',
    title: 'Self-hosted Secret Santa',
    searchTitle: 'Self-hosted Secret Santa: run KovertKlaus on your own server | KovertKlaus',
    description: 'Run your own Secret Santa and White Elephant app with Docker. Free for you, your family, your company or your club.',
    summary: 'Run KovertKlaus on your own computer or server.',
    lead: 'KovertKlaus is free to run on your own computer or server. Your names, addresses and wishlists stay on a machine you control.',
    art: 'server',
    cta: { label: 'Prefer not to host it? Start a mission here', href: START },
    blocks: [
      { type: 'h2', text: 'Who it’s for' },
      {
        type: 'ul',
        items: [
          ['Families or friend groups with someone who runs a home server.'],
          ['Companies, schools and clubs that keep people’s data in-house.'],
          ['Anyone who likes to tinker.'],
        ],
      },
      { type: 'h2', text: 'What you need' },
      {
        type: 'ul',
        items: [['A computer or server with Docker.'], ['Git and Node.js 24 or later.'], ['About ten minutes.']],
      },
      { type: 'h2', text: 'Quick start' },
      {
        type: 'code',
        lines: [`git clone ${SOURCE}.git`, 'cd KovertKlaus', 'npm run db:password', 'docker compose up -d'],
      },
      {
        type: 'p',
        text: [
          'Then open ',
          { code: 'http://localhost:2425' },
          '. The first time it starts, the server prints a one-time setup code (',
          { code: 'docker logs kovertklaus-app' },
          '). Use it at ',
          { code: '/northpole/setup' },
          ' to create your administrator account.',
        ],
      },
      { type: 'h2', text: 'Good to know' },
      {
        type: 'ul',
        items: [
          [{ strong: 'Email is optional.' }, ' Without an email service, new accounts skip email verification, and people join with the mission code you share.'],
          [
            { strong: 'Want to try it first?' },
            ' ',
            { code: 'npm run demo:load' },
            ' adds demo agents and missions, and ',
            { code: 'npm run demo:remove' },
            ' takes them out again.',
          ],
          [{ strong: 'Backups, updates and email setup' }, ' are covered in the ', { href: `${SOURCE}#readme`, text: 'README' }, '.'],
        ],
      },
      { type: 'h2', text: 'License' },
      {
        type: 'p',
        text: [
          'You can run, change and self-host KovertKlaus free of charge: for yourself, your family and friends, or your own company, school, club or non-profit. Selling it to others as a hosted service is reserved to its author. ',
          { href: `${SOURCE}/blob/main/LICENSE.md`, text: 'Read the license' },
          '.',
        ],
      },
    ],
  },
];

/** The guide at `/guides/<slug>`, or `undefined`. */
export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
