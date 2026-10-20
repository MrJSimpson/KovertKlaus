/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import { composeNudge, dispatchNudge, nextDeadline, relativeDay, NUDGE_COOLDOWN_MS, type NudgeMission } from './nudge';

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const MISSION: NudgeMission = {
  inviteCutoffDate: D('2026-11-10'),
  assignmentDate: D('2026-11-15'),
  shippingDate: D('2026-12-10'),
  executionDate: D('2026-12-20'),
  isWhiteElephant: false,
};
const at = (s: string) => Date.parse(`${s}T12:00:00Z`);

test('Nudge - the next deadline follows the timeline and lasts through its day', () => {
  assert.strictEqual(nextDeadline(MISSION, 'PENDING', at('2026-11-01'))?.key, 'cutoff');
  assert.strictEqual(nextDeadline(MISSION, 'PENDING', at('2026-11-10'))?.key, 'cutoff');
  assert.strictEqual(nextDeadline(MISSION, 'PENDING', at('2026-11-11'))?.key, 'draw');
  assert.strictEqual(nextDeadline(MISSION, 'PENDING', at('2026-11-20'))?.key, 'ship');
  assert.strictEqual(nextDeadline(MISSION, 'PENDING', at('2026-12-21')), null);
});

test('Nudge - ship-by is skipped once the agent shipped or chose hand delivery, or when the mission has none', () => {
  assert.strictEqual(nextDeadline(MISSION, 'SHIPPED', at('2026-11-20'))?.key, 'exchange');
  assert.strictEqual(nextDeadline(MISSION, 'LOCAL_DELIVERY', at('2026-11-20'))?.key, 'exchange');
  assert.strictEqual(nextDeadline({ ...MISSION, shippingDate: null }, 'PENDING', at('2026-11-20'))?.key, 'exchange');
});

test('Nudge - the reminder names the deadline, the date and what to do', () => {
  const now = at('2026-12-07');
  assert.strictEqual(relativeDay(D('2026-12-07'), now), 'today');
  assert.strictEqual(relativeDay(D('2026-12-08'), now), 'tomorrow');
  const text = composeNudge(nextDeadline(MISSION, 'PENDING', now)!, now);
  assert.strictEqual(text, 'Reminder from your Head Elf: Ship-by deadline is Thu, Dec 10 (in 3 days). Send your gift and add the tracking number (or mark it as hand delivery).');
  assert.ok(text.length <= 500);
  const we = composeNudge(nextDeadline({ ...MISSION, isWhiteElephant: true }, 'PENDING', at('2026-11-12'))!, at('2026-11-12'));
  assert.match(we, /White Elephant Manifest item/);
});

/** Fake Prisma surface used by dispatchNudge and sendIntelMessage. */
function fakeDb() {
  const notifications: any[] = [];
  const messages: any[] = [];
  const db = {
    notification: {
      findFirst: async ({ where }: any) =>
        notifications.find((n) => n.userId === where.userId && n.exchangeId === where.exchangeId && n.createdAt >= where.createdAt.gte) ?? null,
      create: async ({ data }: any) => notifications.push({ ...data, createdAt: new Date(NOW) }),
    },
    exchangeMember: {
      findUnique: async ({ where }: any) =>
        ['boss', 'u2'].includes(where.exchangeId_userId.userId)
          ? { userId: where.exchangeId_userId.userId, targetUserId: null, exchange: { status: 'MATCHED', completedAt: null, executionDate: MISSION.executionDate, organizerId: 'boss' } }
          : null,
      findFirst: async () => null,
      findMany: async () => [],
    },
    exchangeMessage: {
      count: async () => 0,
      create: async ({ data }: any) => {
        const row = { id: `m${messages.length + 1}`, createdAt: new Date(NOW), ...data };
        messages.push(row);
        return row;
      },
    },
  };
  return { db: db as any, notifications, messages };
}

let NOW = at('2026-12-07');
const member = (overrides: Record<string, unknown> = {}) => ({
  userId: 'u2',
  exchangeId: 'ex1',
  shippingStatus: 'PENDING',
  user: { email: 'pal@x.com', name: 'Pal', emailNotifications: true },
  exchange: { ...MISSION, id: 'ex1', title: 'Family Swap', code: 'ABCD-1234', organizerId: 'boss', organizer: { name: 'Holly' } },
  ...overrides,
});

test('Nudge - posts to Command, notifies and emails; then cools down', async () => {
  NOW = at('2026-12-07');
  const fake = fakeDb();
  const emails: any[] = [];
  const deps = { baseUrl: 'https://kk.test/', sendEmail: async (e: any) => { emails.push(e); return { success: true }; } };

  const res = await dispatchNudge(fake.db, deps, member(), NOW);
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(fake.messages.length, 1);
  assert.strictEqual(fake.messages[0].channel, 'COMMAND');
  assert.strictEqual(fake.messages[0].senderId, 'boss');
  assert.strictEqual(fake.messages[0].recipientId, 'u2');
  assert.match(fake.messages[0].messageText, /Ship-by deadline is Thu, Dec 10/);
  assert.strictEqual(fake.notifications.length, 1);
  assert.strictEqual(emails[0].actionUrl, 'https://kk.test/exchange/ABCD-1234');

  const again = await dispatchNudge(fake.db, deps, member(), NOW + 60_000);
  assert.strictEqual(again.status, 429);
  assert.strictEqual(fake.messages.length, 1);
  assert.strictEqual((await dispatchNudge(fake.db, deps, member(), NOW + NUDGE_COOLDOWN_MS + 1)).status, 200);
});

test('Nudge - no email when the agent opted out; refused with no deadline left or for the Head Elf', async () => {
  NOW = at('2026-12-07');
  const fake = fakeDb();
  const emails: any[] = [];
  const deps = { baseUrl: 'https://kk.test', sendEmail: async (e: any) => { emails.push(e); return { success: true }; } };
  const optedOut = member({ user: { email: 'pal@x.com', name: 'Pal', emailNotifications: false } });
  assert.strictEqual((await dispatchNudge(fake.db, deps, optedOut, NOW)).status, 200);
  assert.strictEqual(emails.length, 0);
  assert.strictEqual((await dispatchNudge(fakeDb().db, deps, member(), at('2026-12-21'))).status, 409);
  assert.strictEqual((await dispatchNudge(fakeDb().db, deps, member({ userId: 'boss' }), NOW)).status, 400);
});
