/**
 * @file demo-db.ts
 * @description Loads (or removes) a demo dataset so people can try KovertKlaus locally before
 * running their own server. Self-hosted edition only.
 *
 * Tier 1 (what): `npm run demo:load` creates six demo Elf Agents and three Holiday Missions at
 * different stages (recruiting, drawn and shipping, completed White Elephant), with Wishlist
 * Manifests, Command/Intel/Debrief messages, an invitation and notifications. `npm run demo:remove`
 * deletes all of it. See docs/DEMO_DATABASE.md.
 * Tier 2 (why): The old `prisma/kovertklaus_test_db.sql` was a schema-only dump that went stale
 * with every schema change and contained nothing to try. Generating the demo from the live Prisma
 * client keeps it current, and dates are relative to the load time so the missions always look
 * "in progress".
 * Tier 3 (how): Demo users have `@demo.invalid` addresses (a reserved domain that can never receive
 * mail) and `isWorkshop: true`, so North Pole can filter them and removal is exact. No password is
 * stored in the repo: one is generated at load time and printed once (or taken from DEMO_PASSWORD).
 * The script refuses to run in SaaS mode or against a non-local database host unless
 * `--allow-remote-host` is passed. Loading again replaces the previous demo data.
 */

import { randomBytes, randomInt } from 'node:crypto';
import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { generateInviteCode, validatePassword } from '../src/lib/security';
import { executeLinkedListDraw } from '../src/lib/draw';

/** Every demo account uses this reserved domain (RFC 2606: never resolves, never receives mail). */
export const DEMO_EMAIL_DOMAIN = 'demo.invalid';

/** Hosts treated as local. Docker Compose reaches Postgres as `kovertklaus-db` or `db`. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'kovertklaus-db', 'db', 'postgres', 'host.docker.internal']);

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the connection string points at a local or Docker Compose database. */
export function isLocalDatabaseUrl(connectionString: string | undefined): boolean {
  if (!connectionString) return false;
  try {
    return LOCAL_HOSTS.has(new URL(connectionString).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** A random password that satisfies `validatePassword` (upper, lower, digit, symbol, 16+ chars). */
export function generateDemoPassword(): string {
  const symbols = '!@#$%^&*-_+=';
  const core = randomBytes(12).toString('base64url').replace(/[-_]/g, '');
  const password = `${core}A7${symbols[randomInt(symbols.length)]}k`;
  return validatePassword(password).isValid ? password : generateDemoPassword();
}

/** The demo cast. Holly is the Head Elf of every demo mission. */
export const DEMO_AGENTS = [
  { key: 'holly', name: 'Holly Berry', codename: 'Jolly Penguin', city: 'Tacoma', state: 'WA' },
  { key: 'juniper', name: 'Juniper Frost', codename: 'Frosty Owl', city: 'Olympia', state: 'WA' },
  { key: 'rudy', name: 'Rudy Nordlund', codename: 'Sparkly Reindeer', city: 'Bremerton', state: 'WA' },
  { key: 'ivy', name: 'Ivy Garland', codename: 'Evergreen Scout', city: 'Seattle', state: 'WA' },
  { key: 'nick', name: 'Nick Kringle', codename: 'Midnight Courier', city: 'Spokane', state: 'WA' },
  { key: 'pepper', name: 'Pepper Minty', codename: 'Peppermint Elf', city: 'Portland', state: 'OR' },
] as const;

type AgentKey = (typeof DEMO_AGENTS)[number]['key'];

/**
 * Wishlist ideas per agent: [name, price in USD]. Text-only items (no URL) are first-class gifts.
 * Every item has a price and costs at most $30, the lowest Secret Santa limit below.
 */
const WISHLISTS: Record<AgentKey, Array<[string, number]>> = {
  holly: [['Cast-iron waffle maker', 28], ['Peppermint bark sampler', 18], ['Wool hiking socks (size M)', 22]],
  juniper: [['Watercolor travel set', 29], ['Hardcover mystery novel', 24], ['Hand-knit beanie, any color', 15]],
  rudy: [['Bluetooth meat thermometer', 29], ['Hot sauce flight', 27], ['Board game: cooperative', 26]],
  ivy: [['Houseplant (low light)', 25], ['Ceramic pour-over coffee set', 27], ['Handwritten recipe card', 10]],
  nick: [['Headlamp, rechargeable', 30], ['Puzzle (1000 pieces)', 20], ['Fleece blanket', 28]],
  pepper: [['Scented candle trio', 26], ['Mini indoor herb garden', 24], ['Fuzzy slippers (size 8)', 21]],
};

/** One White Elephant item each (the 1-item rule). */
const WHITE_ELEPHANT_ITEMS: Record<AgentKey, [string, number]> = {
  holly: ['Singing fish wall plaque', 20],
  juniper: ['Giant gummy bear', 18],
  rudy: ['Bacon-scented candle', 15],
  ivy: ['Desktop zen garden', 22],
  nick: ['Inflatable unicorn horn for cats', 12],
  pepper: ['Mystery box (wrapped twice)', 20],
};

/** Removes every demo user and the missions they organize. Returns the number of users removed. */
export async function removeDemoData(): Promise<number> {
  const users = await db.user.findMany({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return 0;
  // Exchanges cascade to members, messages, invitations and reports; organizer has no cascade.
  await db.exchange.deleteMany({ where: { organizerId: { in: ids } } });
  await db.exchangeMember.deleteMany({ where: { OR: [{ userId: { in: ids } }, { targetUserId: { in: ids } }] } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

/** Creates the demo dataset. Returns the login emails. */
export async function loadDemoData(password: string, nowMs = Date.now()): Promise<string[]> {
  const day = (offset: number) => new Date(Math.floor(nowMs / DAY_MS) * DAY_MS + offset * DAY_MS);
  const passwordHash = await hashPassword(password);

  // Agents. Each mission membership gets its own Wishlist Manifest (see `enroll`).
  const users = {} as Record<AgentKey, { id: string }>;
  for (const a of DEMO_AGENTS) {
    const user = await db.user.create({
      data: {
        email: `${a.key}@${DEMO_EMAIL_DOMAIN}`,
        name: a.name,
        passwordHash,
        city: a.city,
        state: a.state,
        country: 'US',
        favoriteColors: 'Forest green, cranberry red',
        isWorkshop: true,
        emailNotifications: false,
      },
    });
    users[a.key] = { id: user.id };
  }
  const holly = users.holly.id;
  const codenameOf = (key: AgentKey) => DEMO_AGENTS.find((a) => a.key === key)!.codename;
  /** Enrolls agents with a fresh list for this mission: their wishlist, or their one White Elephant gift. */
  const enroll = async (exchangeId: string, keys: AgentKey[], isWhiteElephant: boolean) => {
    for (const k of keys) {
      const userId = users[k].id;
      const items = isWhiteElephant ? [WHITE_ELEPHANT_ITEMS[k]] : WISHLISTS[k];
      await db.exchangeMember.create({
        data: {
          exchangeId,
          userId,
          codename: codenameOf(k),
          role: k === 'holly' ? 'ORGANIZER' : 'MEMBER',
          wishlist: {
            create: {
              userId,
              name: isWhiteElephant ? 'White Elephant Gift' : 'Wishlist',
              type: isWhiteElephant ? 'WHITE_ELEPHANT' : 'STANDARD',
              wishlistItems: { create: items.map(([name, price]) => ({ item: { create: { userId, name, url: '', price } } })) },
            },
          },
        },
      });
    }
  };

  // 1. Recruiting Secret Santa: try inviting, editing dates, the Command channel.
  const recruiting = await db.exchange.create({
    data: {
      title: 'Demo: Family Secret Santa', description: 'A recruiting mission. Invite agents, edit the timeline, then run the draw.',
      code: generateInviteCode(), organizerId: holly, budgetMin: 20, budgetMax: 40,
      inviteCutoffDate: day(7), assignmentDate: day(10), shippingDate: day(30), executionDate: day(40), status: 'RECRUITING',
      paymentStatus: 'EXEMPT_SELF_HOSTED',
    },
  });
  await enroll(recruiting.id, ['holly', 'juniper', 'rudy', 'ivy'], false);
  await db.missionInvitation.create({ data: { exchangeId: recruiting.id, email: `cousin.eddie@${DEMO_EMAIL_DOMAIN}`, invitedById: holly } });
  await db.exchangeMessage.create({
    data: { exchangeId: recruiting.id, channel: 'COMMAND', senderId: users.rudy.id, recipientId: holly, messageText: 'Is the budget per gift or total? Happy either way.', isFromSanta: false, createdAt: day(-1) },
  });
  await db.exchangeMessage.create({
    data: { exchangeId: recruiting.id, channel: 'COMMAND', senderId: holly, recipientId: users.rudy.id, messageText: 'Per gift: $20 to $40. Thanks for checking!', isFromSanta: false },
  });

  // 2. Drawn Secret Santa: targets assigned, one gift shipped, Intel between Santa and target.
  const office = await db.exchange.create({
    data: {
      title: 'Demo: Office Secret Santa', description: 'Targets are drawn. Check your assignment, message your target anonymously, ship your gift.',
      code: generateInviteCode(), organizerId: holly, budgetMax: 30,
      inviteCutoffDate: day(-10), assignmentDate: day(-3), shippingDate: day(10), executionDate: day(20), status: 'MATCHED',
      drawVerifiedAt: day(-3), paymentStatus: 'EXEMPT_SELF_HOSTED',
    },
  });
  const officeKeys: AgentKey[] = ['holly', 'juniper', 'rudy', 'ivy', 'nick', 'pepper'];
  await enroll(office.id, officeKeys, false);
  const assignments = executeLinkedListDraw(officeKeys.map((k) => ({ id: users[k].id, name: k, hasWishlistAttached: true })));
  for (const a of assignments) {
    await db.exchangeMember.update({ where: { exchangeId_userId: { exchangeId: office.id, userId: a.agentId } }, data: { targetUserId: a.targetId } });
  }
  const juniperTarget = assignments.find((a) => a.agentId === users.juniper.id)!.targetId;
  await db.exchangeMember.update({
    where: { exchangeId_userId: { exchangeId: office.id, userId: users.juniper.id } },
    data: { shippingStatus: 'SHIPPED', trackingNumber: '9400100000000000000000', shippedAt: day(-1) },
  });
  await db.exchangeMessage.create({
    data: { exchangeId: office.id, channel: 'INTEL', senderId: users.juniper.id, recipientId: juniperTarget, messageText: 'Your gift is on its way. Do you prefer dark or milk chocolate?', isFromSanta: true, createdAt: day(-1) },
  });
  await db.exchangeMessage.create({
    data: { exchangeId: office.id, channel: 'INTEL', senderId: juniperTarget, recipientId: users.juniper.id, messageText: 'Dark, please! Thank you, mystery Santa.', isFromSanta: false },
  });

  // 3. Completed White Elephant: after-action Debrief.
  const party = await db.exchange.create({
    data: {
      title: 'Demo: White Elephant Night', description: 'A finished in-person White Elephant. Read the Debrief.',
      code: generateInviteCode(), organizerId: holly, budgetMax: 25, isWhiteElephant: true, isLocalOnly: true, eventLocation: 'Community center, Room B',
      inviteCutoffDate: day(-30), assignmentDate: day(-25), executionDate: day(-3), status: 'COMPLETED', completedAt: day(-2),
      paymentStatus: 'EXEMPT_SELF_HOSTED',
    },
  });
  await enroll(party.id, officeKeys, true);
  await db.exchangeMessage.createMany({
    data: [
      { exchangeId: party.id, channel: 'DEBRIEF', senderId: users.nick.id, messageText: 'The singing fish was stolen three times. Legendary.', isFromSanta: false, createdAt: day(-2) },
      { exchangeId: party.id, channel: 'DEBRIEF', senderId: holly, messageText: 'Thanks for coming, everyone. Same time next year!', isFromSanta: false, createdAt: day(-2) },
    ],
  });

  await db.notification.create({
    data: { userId: users.juniper.id, title: '🎯 Target Assigned: Demo: Office Secret Santa', message: 'Your Secret Santa target is ready. Open the mission to see their Wishlist Manifest.', exchangeId: office.id },
  });

  return DEMO_AGENTS.map((a) => `${a.key}@${DEMO_EMAIL_DOMAIN}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const remove = args.has('--remove');

  if ((process.env.MODE || '').toUpperCase() === 'SAAS') {
    console.error('✖ The demo database is for the self-hosted edition only (MODE=SAAS is set).');
    process.exit(1);
  }
  if (!isLocalDatabaseUrl(process.env.DATABASE_URL) && !args.has('--allow-remote-host')) {
    console.error('✖ DATABASE_URL does not point at a local database. Refusing to touch it.');
    console.error('  Pass --allow-remote-host only if this really is a throwaway database.');
    process.exit(1);
  }

  const removed = await removeDemoData();
  if (remove) {
    console.log(removed ? `✔ Removed ${removed} demo agents and their missions.` : 'No demo data found.');
    return;
  }

  const password = process.env.DEMO_PASSWORD || generateDemoPassword();
  const check = validatePassword(password);
  if (!check.isValid) {
    console.error(`✖ DEMO_PASSWORD is not strong enough: ${check.error}`);
    process.exit(1);
  }
  const emails = await loadDemoData(password);

  console.log(`\n✔ Demo data loaded${removed ? ' (previous demo data replaced)' : ''}.\n`);
  console.log('  Sign in at /signin with any of these accounts:');
  for (const e of emails) console.log(`    ${e}${e.startsWith('holly@') ? '   (Head Elf of every demo mission)' : ''}`);
  if (process.env.DEMO_PASSWORD) {
    console.log('\n  Password: the value of DEMO_PASSWORD.');
  } else {
    console.log(`\n  Password (shown once, not stored anywhere): ${password}`);
  }
  console.log('\n  Remove it all with: npm run demo:remove\n');
}

if (process.argv[1] && /demo-db\.ts$/.test(process.argv[1])) {
  main()
    .catch((err) => {
      console.error('✖ Demo load failed:', err);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
