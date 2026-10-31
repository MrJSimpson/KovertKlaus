/**
 * @file legal.ts
 * @description The Privacy Policy and Terms of Service shown at `/privacy` and `/terms`.
 *
 * Tier 1 (what): Plain-language policy text as structured sections (`PRIVACY_POLICY`,
 * `TERMS_OF_SERVICE`), rendered by `LegalPage`. One source for both editions' pages and tests.
 * Tier 2 (why): BETA opens sign-up to the public, and accounts hold home addresses, clothing sizes
 * and allergies, so people need to know what is collected, who sees it and how to remove it
 * (owner decision 2026-10-31). KovertKlaus is not a commercial product yet; the policies say so and
 * will be replaced before it becomes one.
 * Tier 3 (how): Adapted from the Basecamp open-source policies (CC BY 4.0, attribution in
 * `LEGAL_ATTRIBUTION`), rewritten for what this codebase actually does: Cloudflare hosting, Neon
 * database, Brevo email, no payments, no analytics, no self-service account deletion yet. These
 * pages cover the hosted service at kovertklaus.com; a self-hosted install is run by its operator.
 * Keep this file in step with the code when data handling changes.
 */

/** Where privacy requests and questions go. */
export const LEGAL_CONTACT_EMAIL = 'privacy@kovertklaus.com';

/** Shown as "Last updated" on both pages. Change it whenever the text changes. */
export const LEGAL_UPDATED = 'October 31, 2026';

/** Minimum age for an account (US COPPA). */
export const MINIMUM_AGE = 13;

/** The person who runs kovertklaus.com. */
export const OPERATOR_NAME = 'Joshua Simpson';

/** Credit required by the CC BY 4.0 license of the source policies. */
export const LEGAL_ATTRIBUTION = {
  text: 'Adapted from the Basecamp open-source policies',
  sourceUrl: 'https://github.com/basecamp/policies',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  changes: 'Rewritten and shortened for KovertKlaus.',
};

/** One block inside a section: a paragraph or a bulleted list. */
export type LegalBlock = { kind: 'p'; text: string } | { kind: 'list'; items: string[] };

/** One section of a policy page. */
export interface LegalSection {
  /** Anchor id, e.g. `what-we-collect`. */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

/** A whole policy page. */
export interface LegalDocument {
  title: string;
  /** Shown in a highlighted box under the title. */
  notice: string;
  intro: string;
  sections: LegalSection[];
}

const p = (text: string): LegalBlock => ({ kind: 'p', text });
const list = (...items: string[]): LegalBlock => ({ kind: 'list', items });

const NOT_COMMERCIAL =
  'KovertKlaus is free and is not a commercial product (yet). It is in beta and run by one person. ' +
  'This policy describes the service as it is today. Before KovertKlaus charges for anything or becomes a commercial product, ' +
  'its terms, conditions and privacy policy will change, and we will tell you before the new versions apply.';

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  notice: NOT_COMMERCIAL,
  intro:
    `KovertKlaus (kovertklaus.com) is run by ${OPERATOR_NAME}. This policy explains what information we collect when you use it, ` +
    'why, who can see it, and how to get it changed or removed. We never sell your information, show you ads, or use analytics or tracking tools.',
  sections: [
    {
      id: 'what-we-collect',
      heading: 'What we collect and why',
      blocks: [
        p('**Your account.** Your name, email address and password. Your password is stored only as a salted one-way hash, so we cannot read it. We use your email to sign you in and to send mission emails, such as invitations, assignment notices and password resets.'),
        p('**Your gift dossier (optional).** Shipping address and delivery notes, clothing sizes and measurements, favorite colors, hobbies, dislikes, and allergies or diet. These exist so your Secret Santa can choose a gift and send it. Allergies and diet can be health information: only add what you are comfortable sharing.'),
        p('**What you do in missions.** Missions you run or join, your codename, your Wishlist Manifest (including product links you paste), shipping and tracking numbers, Mission Comms messages, After-Action Reports, Secret Santa guesses and Coal Citations.'),
        p('**Invitations.** When a Head Elf invites you, we store your email address and whether the invitation was accepted, and we send you the invitation email.'),
        p('**Feedback you send.** Your message, the page you were on, the app version and your browser type.'),
        p('**Security records.** To stop abuse, we count failed sign-ins, password resets, sign-ups and wrong mission codes using one-way digests of email addresses and network (IP) addresses, deleted after about a day. Our system log can record an email or network address when something goes wrong or a limit is reached; the oldest entries are removed as the log fills.'),
        p('**Cookies and browser storage.** One cookie keeps you signed in; it expires after 24 hours without activity. Your browser also stores your account ID, display name and light or dark theme choice. There are no advertising, analytics or tracking cookies.'),
        p('We do not collect payment details (KovertKlaus is free), your precise location, or your contacts.'),
      ],
    },
    {
      id: 'who-sees-what',
      heading: 'Who sees what inside KovertKlaus',
      blocks: [
        list(
          'Other agents in a mission see you by your codename, not your real name.',
          'The Head Elf of a mission sees your real name, so they can confirm who joined.',
          'Your Secret Santa sees your name, shipping address and the gift dossier details you filled in, because they need them to choose and send your gift.',
          'The Head Elf sees your sizes, measurements, favorites and allergies only if you switch "Head Elf can see" on for them in your profile.',
          'Your Wishlist Manifest is shown to your Secret Santa. Mission Comms messages and After-Action Reports are shown to the agents in that mission.',
          'Someone who has a mission code but is not in the mission sees only its title, dates, budget and the Head Elf\'s codename.'
        ),
      ],
    },
    {
      id: 'sharing',
      heading: 'Who we share it with',
      blocks: [
        p('We use a few service providers to run KovertKlaus. They handle your information only to provide their service to us:'),
        list(
          'Cloudflare hosts the website and app and carries all traffic, so it handles network (IP) addresses and the requests your browser sends.',
          'Neon hosts the database where your account, dossier and missions are stored.',
          'Brevo sends our emails, so it receives your email address, your name and the content of emails we send you.'
        ),
        p('When you paste a product link into a Wishlist Manifest, our server visits that page to fill in the item. The store sees a request from our server, not from you.'),
        p('Our providers may store and process data in the United States and other countries where they operate.'),
        p('We will disclose information if the law requires it, for example a valid court order or subpoena. Where the law allows, we will tell you before doing so.'),
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your choices and rights',
      blocks: [
        list(
          'You can view and change your profile and gift dossier at any time in the app.',
          'You can turn mission emails off in your profile. Some emails, such as password resets, are always sent.',
          `To get a copy of your information, correct something you cannot change yourself, or delete your account, email ${LEGAL_CONTACT_EMAIL} from the address on your account. Deleting your account in the app is coming; until then, we handle deletion requests by email.`,
          'We answer requests within 30 days. Depending on where you live (for example California or the European Union), you may have further rights under local law; ask us and we will help.'
        ),
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep it',
      blocks: [
        list(
          'Your account and dossier stay until you ask us to delete your account.',
          'A cancelled mission is deleted 90 days after it was cancelled. We keep only an anonymous record of its outcome and the reason, with no names.',
          'A completed mission stays as a read-only record for the agents who took part.',
          'When we delete your account, we remove your profile, dossier, Wishlist Manifests, messages and reports. If you run a mission that is still active, we will work with you to finish or cancel it first.',
          'Security records are deleted after about a day. Copies in database backups are removed when those backups expire.'
        ),
      ],
    },
    {
      id: 'security',
      heading: 'How we protect it',
      blocks: [
        p('All traffic is encrypted (HTTPS). Passwords are stored as salted one-way hashes. Sign-in, sign-up, password resets and mission codes are rate-limited. Only the operator can reach the database. If we learn of a breach that affects your information, we will tell you by email without undue delay.'),
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      blocks: [
        p(`You must be at least ${MINIMUM_AGE} to have an account. Younger children can take part in a family mission through a parent's account. If we learn that someone under ${MINIMUM_AGE} has an account, we will delete it.`),
      ],
    },
    {
      id: 'self-hosted',
      heading: 'Self-hosted KovertKlaus',
      blocks: [
        p('KovertKlaus can also be installed and run by others on their own servers. This policy covers only kovertklaus.com. A self-hosted installation is run by its own operator, who is responsible for its data.'),
      ],
    },
    {
      id: 'changes',
      heading: 'Changes and questions',
      blocks: [
        p('We will update this policy when KovertKlaus changes how it handles information, and before it becomes a commercial product. For significant changes we will notify you in the app or by email before they apply.'),
        p(`Questions or requests: ${LEGAL_CONTACT_EMAIL}.`),
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Terms of Service',
  notice: NOT_COMMERCIAL,
  intro:
    `These terms are the agreement between you and ${OPERATOR_NAME}, who runs KovertKlaus at kovertklaus.com ("KovertKlaus", "we", "us"). ` +
    'By creating an account or using KovertKlaus, you agree to them and to our Privacy Policy. They are written to be read; if something is unclear, ask us.',
  sections: [
    {
      id: 'accounts',
      heading: 'Your account',
      blocks: [
        list(
          `You must be at least ${MINIMUM_AGE} years old and a human. Accounts created by bots or other automated means are not allowed.`,
          'One person per account. Use your own name and an email address you control.',
          'Keep your password safe. You are responsible for what happens under your account. If you think someone else has used it, reset your password and tell us.'
        ),
      ],
    },
    {
      id: 'fair-use',
      heading: 'Using KovertKlaus fairly',
      blocks: [
        p('You agree not to:'),
        list(
          'harass, threaten or deceive other agents, or impersonate someone else;',
          'send or request gifts that are illegal, dangerous, or meant to offend;',
          'use another agent\'s name, address or other details for anything except sending their gift;',
          'try to get into missions or accounts that are not yours, including by guessing mission codes;',
          'scrape, overload, probe or attack the service, or get around its limits;',
          'use KovertKlaus to break the law.'
        ),
        p('A Head Elf is responsible for the missions they run: who they invite, the dates and budget they set, and approving the draw.'),
      ],
    },
    {
      id: 'gifts',
      heading: 'Gifts and the people you exchange with',
      blocks: [
        list(
          'KovertKlaus helps people organize gift exchanges. We are not a party to any gift: we do not buy, sell, ship or insure gifts, and we do not handle money.',
          'Gifts, shipping, delivery and anything that goes wrong between agents are between the agents involved. We do not arbitrate personal disputes.',
          'Coal Citations are given and removed automatically by the rules described in the app. Support does not change them by hand.'
        ),
      ],
    },
    {
      id: 'content',
      heading: 'Your content',
      blocks: [
        p('What you add (your dossier, Wishlist Manifests, messages and reports) remains yours. You give us permission to store it and show it to the people described in our Privacy Policy, only so KovertKlaus can work. You confirm you have the right to share what you post.'),
      ],
    },
    {
      id: 'beta',
      heading: 'A free service in beta',
      blocks: [
        list(
          'KovertKlaus is free. It is in beta: expect bugs, changes and the occasional outage.',
          'We may change, pause or remove features at any time, with or without notice. We will try to give notice before changes that affect missions in progress.',
          'Keep your own note of anything important, such as addresses and tracking numbers. We back up the service, but we cannot promise that data will never be lost.'
        ),
      ],
    },
    {
      id: 'termination',
      heading: 'Suspending or closing accounts',
      blocks: [
        p('We may suspend or close an account that breaks these terms or puts other agents at risk. You can stop using KovertKlaus at any time and ask us to delete your account (see the Privacy Policy).'),
      ],
    },
    {
      id: 'liability',
      heading: 'No warranty, limited liability',
      blocks: [
        p('KovertKlaus is provided "as is" and "as available", without warranties of any kind, to the extent the law allows. To the extent the law allows, we are not liable for any direct, indirect or consequential losses arising from your use of KovertKlaus, including lost, late or unsuitable gifts. Some places do not allow these limits, so they may not all apply to you.'),
      ],
    },
    {
      id: 'self-hosted',
      heading: 'The KovertKlaus software',
      blocks: [
        p('These terms cover the hosted service at kovertklaus.com. The KovertKlaus source code is licensed separately under the license in its repository. A self-hosted installation is run by its own operator under that operator\'s terms.'),
      ],
    },
    {
      id: 'changes',
      heading: 'Changes, governing law and contact',
      blocks: [
        list(
          'We may update these terms. For significant changes we will notify you in the app or by email before they apply. Continuing to use KovertKlaus after that means you accept the new terms.',
          'These terms are governed by the laws of the State of Washington, USA.',
          `Questions: ${LEGAL_CONTACT_EMAIL}.`
        ),
      ],
    },
  ],
};
