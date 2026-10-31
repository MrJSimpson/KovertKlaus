/**
 * @file announcements.ts
 * @description User-friendly release announcements shown in the What's New pop-up.
 *
 * Tier 1 (what): `ANNOUNCEMENTS` lists one entry per release, newest first, written for Elf Agents
 * and Head Elves rather than developers. `hasUnseenAnnouncement` drives the "What's New" dot.
 * Tier 2 (why): `CHANGELOG.md` is technical and lives in the repository; people using the app need
 * a plain-language "what changed for me" view inside the app.
 * Tier 3 (how): Every release pull request adds an entry here whose `version` equals `APP_VERSION`
 * (enforced by `src/lib/version.test.ts`; see `docs/VERSIONING.md`). The content is static, so it
 * works in the self-hosted build and the SaaS static export alike. Never put credentials here.
 * An entry with a `stage` is staged: it ships with a release but is shown only while the platform's
 * release stage (North Pole setting) is that stage, so the beta announcement appears the moment an
 * admin flips the switch (owner decision 2026-10-29: no waitlist email, in-app only).
 */

import { DEFAULT_RELEASE_STAGE, type ReleaseStage } from '@/lib/platform-limits';

/** One highlight line in an announcement. */
export interface AnnouncementHighlight {
  emoji: string;
  title: string;
  text: string;
  /** Applies only to the self-hosted edition (shown with a label). */
  selfHostedOnly?: boolean;
}

/** One release announcement. */
export interface Announcement {
  /** Matches `APP_VERSION` for the release it announces (no leading `v`). */
  version: string;
  /** Release date, `YYYY-MM-DD`. */
  date: string;
  title: string;
  summary: string;
  highlights: AnnouncementHighlight[];
  /** Staged entry: shown only while the release stage is this one. Its badge shows the stage. */
  stage?: ReleaseStage;
}

/** Newest first. */
export const ANNOUNCEMENTS: Announcement[] = [
  {
    version: '0.7.0-alpha',
    stage: 'BETA',
    date: '2026-11-01',
    title: 'KovertKlaus beta: everyone is welcome',
    summary: 'Season 1 has begun. Anyone can now create an account and run a Secret Santa or White Elephant mission. No invite code needed.',
    highlights: [
      {
        emoji: '🎄',
        title: 'Open sign-up',
        text: 'Sign up from the home page with just your email. Invite your family, friends or coworkers with your mission\'s invite link, and they can join in a minute.',
      },
      {
        emoji: '🎁',
        title: 'Plan your season',
        text: 'Each Head Elf can run up to 5 missions at once, with up to 50 agents in each. Finished and cancelled missions do not count.',
      },
      {
        emoji: '💬',
        title: 'Tell us what you think',
        text: 'This is a beta, so some things may still be rough. Use the Feedback button in the bottom-right corner to report a problem or share an idea. We read every one.',
      },
    ],
  },
  {
    version: '0.8.0-alpha',
    date: '2026-10-30',
    title: 'Password reset, and Head Elves see who joined',
    summary: 'You can now reset a forgotten password by email, and a Head Elf can see the real name behind each codename in their mission.',
    highlights: [
      {
        emoji: '🔑',
        title: 'Forgot your password?',
        text: 'Use "Forgot your password?" on the sign-in form. We email you a link that works once and lasts 30 minutes. Choosing a new password signs you out on your other devices.',
      },
      {
        emoji: '🕵️',
        title: 'Head Elves know who joined',
        text: 'A Head Elf now sees each agent\'s real name under their codename, so they can check everyone who joined is someone they invited. Other agents still see only codenames.',
      },
    ],
  },
  {
    version: '0.7.1-alpha',
    date: '2026-10-29',
    title: 'Joining and mission settings fixes',
    summary: 'Invitation keys now work only while a mission is recruiting, and mission settings tell you exactly what needs fixing.',
    highlights: [
      {
        emoji: '🔒',
        title: 'No late arrivals',
        text: 'An unused invitation key could let someone join a mission after targets were drawn, or after it ended. Now every way of joining works only while the mission is still recruiting and has room.',
      },
      {
        emoji: '📝',
        title: 'Clearer settings errors',
        text: 'If a Head Elf\'s settings change can\'t be saved, the message now says which rule it broke instead of just "Validation failed". A mission can\'t be switched between Secret Santa and White Elephant after it is created.',
      },
    ],
  },
  {
    version: '0.7.0-alpha',
    date: '2026-10-29',
    title: 'Bigger missions and wishlist quantities',
    summary: 'Missions hold up to 50 agents, wishlists let you ask for more than one of an item, and KovertKlaus gets ready to open to everyone.',
    highlights: [
      {
        emoji: '🔢',
        title: 'Ask for more than one',
        text: 'Each wishlist item has a quantity, from 1 to 25. The price is for one, and if your Head Elf limits the whole list, every one counts toward the total. A wishlist holds up to 20 different items.',
      },
      {
        emoji: '👥',
        title: 'Missions up to 50 agents',
        text: 'Head Elves can set a mission\'s size anywhere from 4 to 50 agents, up from 25.',
      },
      {
        emoji: '💬',
        title: 'Send feedback from any page',
        text: 'Signed-in agents have a Feedback button in the bottom-right corner. Report a bug or share an idea, and it goes straight to the KovertKlaus team.',
      },
      {
        emoji: '🧹',
        title: 'Tidier dashboard',
        text: 'Your dashboard now lists every mission you run or have joined, with search and filters, and you can hide completed or cancelled ones.',
      },
      {
        emoji: '🛡️',
        title: 'Safer sign-in and sign-up',
        text: 'Repeated wrong passwords now have to wait, and new accounts are limited per network, so nobody can guess passwords or flood KovertKlaus with fake accounts.',
      },
    ],
  },
  {
    version: '0.6.3-alpha',
    date: '2026-10-24',
    title: 'Your target email arrives on Assignment Day',
    summary: 'When a mission draws targets on its own on Assignment Day, every agent now reliably gets the email with their target.',
    highlights: [
      {
        emoji: '🎯',
        title: 'Assignment emails always go out',
        text: 'On Assignment Day the draw happens automatically and every agent is emailed their target. That email could get cut off before it was sent; now the draw waits until every email is on its way. You still get the notice in the app too.',
      },
    ],
  },
  {
    version: '0.6.2-alpha',
    date: '2026-10-24',
    title: 'Clearer Get Data results and security updates',
    summary: 'Get Data no longer fills in a store name or a "robot check" as your item, and KovertKlaus is running on the latest security fixes.',
    highlights: [
      {
        emoji: '🔗',
        title: 'No more store names as item names',
        text: 'Some stores refuse lookups. Before, Get Data could fill the item name with the store\'s web address or a "Robot or human?" message. Now it leaves the form empty and asks you to fill in the details yourself.',
      },
      {
        emoji: '🛡️',
        title: 'Security updates',
        text: 'Everything KovertKlaus is built on has been updated to the latest versions, including important security fixes.',
      },
      {
        emoji: '🖥️',
        title: 'Self-hosted: please update',
        text: 'This release fixes serious security issues in Next.js that affect self-hosted servers. Update your instance as soon as you can.',
        selfHostedOnly: true,
      },
    ],
  },
  {
    version: '0.6.1-alpha',
    date: '2026-10-24',
    title: 'Get Data works again',
    summary: 'Pasting a store link and clicking Get Data now fills in the item for you, as it was always meant to.',
    highlights: [
      {
        emoji: '🔗',
        title: 'Get Data fills in store items',
        text: 'When you add a store-bought item, paste its link and click Get Data. The name, price and picture are filled in for you. Some stores do not allow lookups; if nothing appears, type in the details yourself.',
      },
    ],
  },
  {
    version: '0.6.0-alpha',
    date: '2026-10-23',
    title: 'A notification bell and safer draws',
    summary: 'Notifications now live in one tidy place, the draw always makes one big gift circle, and missions that cannot draw get a chance to fix things instead of quietly stalling.',
    highlights: [
      {
        emoji: '🔔',
        title: 'A notification bell',
        text: 'Your notifications moved into a bell at the top of the dashboard. Open it to see them ten at a time, jump straight to the mission they are about, accept or decline invitations, and remove the ones you are done with.',
      },
      {
        emoji: '🔁',
        title: 'One gift circle for everyone',
        text: 'Every Secret Santa draw now makes one circle through the whole mission, so two agents never end up drawing each other. Target swaps keep the circle intact too.',
      },
      {
        emoji: '🛠️',
        title: 'A chance to fix things before the draw',
        text: 'If a mission is not ready on Assignment Day (too few agents, a missing shipping address, an empty wishlist, or rules that make a draw impossible), the draw pauses and shows Draw Paused. The Head Elf and the agents involved are told exactly what to fix, and the draw happens as soon as it is fixed.',
      },
      {
        emoji: '🛑',
        title: 'Cancelling a mission',
        text: 'A Head Elf can now cancel a mission that is not finished. Everyone is told, the mission becomes read-only so you can still save what you need, and nobody receives a Coal Citation.',
      },
      {
        emoji: '⚡',
        title: 'Faster and more reliable',
        text: 'The dashboard and Account Preferences no longer fail with a resource error, pages load with less work behind the scenes, and draws and swaps no longer report an error after they actually worked.',
      },
    ],
  },
  {
    version: '0.5.0-alpha',
    date: '2026-10-20',
    title: 'Codenames and wishlists for every mission',
    summary: 'Thanks to your feedback, every mission now gives you a fresh codename and its own wishlist, adding gifts is simpler, and the mission page shows you just what you need.',
    highlights: [
      {
        emoji: '🕵️',
        title: 'A new codename for each mission',
        text: 'When you join a mission you get a random codename like "Agent: Snowy Spider". Not a fan? Tap Draw another as often as you like, then Accept codename to keep it. Codenames are set once sign-ups close.',
      },
      {
        emoji: '🎁',
        title: 'One wishlist per mission',
        text: 'Your wishlist now lives on the mission page and belongs to that mission only, so changing it never affects another mission. Lists you already had were kept.',
      },
      {
        emoji: '🛍️',
        title: 'Easier to add gifts',
        text: 'Pick Store-bought gift, paste a link and tap Get Data to fill in the name, price and picture for you. Or pick Personalized gift for something handmade or specially crafted, and describe it with an estimated price.',
      },
      {
        emoji: '💵',
        title: 'Gifts stay within the spending limit',
        text: 'Every gift needs a price, and no single gift can cost more than the mission\'s spending limit. Head Elves decide whether a whole wishlist may add up to more than the limit; it may unless they turn that off.',
      },
      {
        emoji: '💬',
        title: 'A tidier mission page',
        text: 'Mission Comms now sits right under the Elf Agents list. After targets are drawn, that list shows just the people you can message: your Head Elf, your target and your Secret Santa (whose name stays secret).',
      },
      {
        emoji: '❄️',
        title: 'A fresh winter look',
        text: 'New Christmas colors in light mode, blue and gold in dark mode, easier-to-tap buttons on phones, and a wider After-Action Report so your thank-you notes and photos have room to shine.',
      },
    ],
  },
  {
    version: '0.4.0-alpha',
    date: '2026-10-15',
    title: 'Smarter nudges and safer password changes',
    summary: 'Reminders from your Head Elf now tell you exactly what is due next, and changing your password signs out every other device.',
    highlights: [
      {
        emoji: '🔔',
        title: 'Nudges that say what is due',
        text: 'When your Head Elf nudges you, the reminder names your next deadline and the date, like "Ship-by deadline is Thu, Dec 10 (in 3 days)", and tells you what to do. It also appears in your Command channel, so you can reply right there.',
      },
      {
        emoji: '🔐',
        title: 'Password change signs out other devices',
        text: 'If you change your password, every other browser or phone signed in to your account is signed out. The device you used stays signed in.',
      },
      {
        emoji: '🧪',
        title: 'Try it with demo data',
        text: 'Running your own server? One command loads demo agents and missions so you can explore every stage before inviting real people.',
        selfHostedOnly: true,
      },
    ],
  },
  {
    version: '0.3.0-alpha',
    date: '2026-10-15',
    title: 'Mission Comms, email invitations and a team roster',
    summary:
      'Talk to your team inside each mission, invite people by email, and keep track of who has joined. Plus a round of reliability and security fixes behind the scenes.',
    highlights: [
      {
        emoji: '💬',
        title: 'Mission Comms',
        text: 'Every mission now has three channels. Command connects you with your Head Elf. Intel lets you message your Secret Santa target without revealing who you are, and lets your target reply. Debrief opens for everyone once the mission is complete.',
      },
      {
        emoji: '✉️',
        title: 'Email invitations',
        text: 'Head Elves can invite people by email. New people get a link to create their account and join in one step; people who already have an account can accept or decline from the mission page or their dashboard.',
      },
      {
        emoji: '👥',
        title: 'Elf Agents roster',
        text: 'The mission page lists everyone who has joined and, for the Head Elf, everyone still invited. Resend or withdraw an invitation right from the roster.',
      },
      {
        emoji: '📅',
        title: 'Change your mission dates',
        text: 'Head Elves can move the cutoff, draw, ship-by and exchange dates as plans change. KovertKlaus keeps the dates in order and never moves a date into the past.',
      },
      {
        emoji: '🔗',
        title: 'Mission links that just work',
        text: 'Every mission link, including the ones in invitation emails, now opens the right mission.',
      },
      {
        emoji: '📧',
        title: 'Emails are back',
        text: 'Fixed a problem that stopped welcome, invitation, assignment and reminder emails from being sent.',
      },
      {
        emoji: '🔐',
        title: 'Safer sign-in',
        text: 'Sessions now expire after a day of inactivity, so a forgotten browser does not stay signed in forever.',
      },
      {
        emoji: '📣',
        title: 'This page',
        text: 'Announcements like this one tell you what is new after every update. Look for the What’s New link.',
      },
      {
        emoji: '🛠️',
        title: 'First-run admin setup',
        text: 'New installations no longer ship with a default administrator password. The server prints a one-time setup code and you choose your own.',
        selfHostedOnly: true,
      },
    ],
  },
  {
    version: '0.2.0-alpha',
    date: '2026-10-06',
    title: 'Alpha: family and friends testing begins',
    summary: 'KovertKlaus opened to its first testers.',
    highlights: [
      { emoji: '🎁', title: 'Text-only gifts', text: 'Wish for handmade gifts, experiences or anything without a store link.' },
      { emoji: '📱', title: 'Better on phones', text: 'Dialogs slide up from the bottom on small screens, and text fields no longer zoom in on iPhone.' },
    ],
  },
];

/** The newest released version with an announcement (staged entries excluded). */
export const LATEST_ANNOUNCEMENT_VERSION = ANNOUNCEMENTS.find((a) => !a.stage)!.version;

/** The entries shown while the platform is at `stage`, newest first. */
export function visibleAnnouncements(stage: ReleaseStage = DEFAULT_RELEASE_STAGE): Announcement[] {
  return ANNOUNCEMENTS.filter((a) => !a.stage || a.stage === stage);
}

/** Unique key of an entry: its version, plus the stage for a staged one (e.g. `0.7.0-alpha+beta`). */
export function announcementKey(a: Announcement): string {
  return a.stage ? `${a.version}+${a.stage.toLowerCase()}` : a.version;
}

/** Key of the newest entry shown at `stage`; what opening the pop-up records as seen. */
export function latestAnnouncementKey(stage: ReleaseStage = DEFAULT_RELEASE_STAGE): string {
  return announcementKey(visibleAnnouncements(stage)[0]);
}

/** Browser storage key holding the last announcement key the viewer opened. */
export const ANNOUNCEMENT_SEEN_KEY = 'kovertklaus:lastSeenAnnouncement';

/** True when the viewer has not opened the newest announcement shown at `stage` yet. */
export function hasUnseenAnnouncement(lastSeenKey: string | null | undefined, stage: ReleaseStage = DEFAULT_RELEASE_STAGE): boolean {
  return lastSeenKey !== latestAnnouncementKey(stage);
}
