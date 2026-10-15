/**
 * @file announcements.ts
 * @description User-friendly release announcements shown on `/announcements`.
 *
 * Tier 1 (what): `ANNOUNCEMENTS` lists one entry per release, newest first, written for Elf Agents
 * and Head Elves rather than developers. `hasUnseenAnnouncement` drives the "What's New" dot.
 * Tier 2 (why): `CHANGELOG.md` is technical and lives in the repository; people using the app need
 * a plain-language "what changed for me" page inside the app.
 * Tier 3 (how): Every release pull request adds an entry here whose `version` equals `APP_VERSION`
 * (enforced by `src/lib/version.test.ts`; see `docs/VERSIONING.md`). The page is static, so it
 * works in the self-hosted build and the SaaS static export alike. Never put credentials here.
 */

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
}

/** Newest first. */
export const ANNOUNCEMENTS: Announcement[] = [
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

/** The newest announced version. */
export const LATEST_ANNOUNCEMENT_VERSION = ANNOUNCEMENTS[0].version;

/** Browser storage key holding the last announcement version the viewer opened. */
export const ANNOUNCEMENT_SEEN_KEY = 'kovertklaus:lastSeenAnnouncement';

/** True when the viewer has not opened the newest announcement yet. */
export function hasUnseenAnnouncement(lastSeenVersion: string | null | undefined): boolean {
  return lastSeenVersion !== LATEST_ANNOUNCEMENT_VERSION;
}
