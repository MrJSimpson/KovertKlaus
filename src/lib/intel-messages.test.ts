/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import {
  validateIntelMessage,
  toIntelView,
  sendIntelMessage,
  listIntelMessages,
  INTEL_MESSAGE_MAX_CHARS,
  INTEL_MESSAGES_PER_HOUR,
} from './intel-messages';

const at = new Date('2026-12-01T10:00:00Z');
const msg = (senderId: string, recipientId: string, isFromSanta: boolean) => ({
  id: `${senderId}-${recipientId}`,
  senderId,
  recipientId,
  messageText: 'hi',
  isFromSanta,
  createdAt: at,
});

test('Intel Messages - text is required, cleaned and length-capped', () => {
  assert.deepStrictEqual(validateIntelMessage('  <b>Hello</b> '), { ok: true, text: 'Hello' });
  assert.strictEqual(validateIntelMessage('   ').ok, false);
  assert.strictEqual(validateIntelMessage(42).ok, false);
  assert.strictEqual(validateIntelMessage('x'.repeat(INTEL_MESSAGE_MAX_CHARS)).ok, true);
  assert.strictEqual(validateIntelMessage('x'.repeat(INTEL_MESSAGE_MAX_CHARS + 1)).ok, false);
});

test('Intel Messages - each side sees the right conversation and no user IDs', () => {
  // santa -> target
  assert.deepStrictEqual(toIntelView(msg('santa', 'target', true), 'santa'), {
    id: 'santa-target', channel: 'target', fromMe: true, text: 'hi', createdAt: at.toISOString(),
  });
  assert.strictEqual(toIntelView(msg('santa', 'target', true), 'target')?.channel, 'santa');
  // target replies -> santa
  assert.strictEqual(toIntelView(msg('target', 'santa', false), 'target')?.channel, 'santa');
  assert.strictEqual(toIntelView(msg('target', 'santa', false), 'santa')?.channel, 'target');
  const view = toIntelView(msg('santa', 'target', true), 'target')!;
  assert.ok(!('senderId' in view) && !('recipientId' in view));
});

test('Intel Messages - outsiders see nothing', () => {
  assert.strictEqual(toIntelView(msg('santa', 'target', true), 'someone'), null);
});

/** Minimal in-memory stand-in for the two Prisma models the service touches. */
function fakeDb(opts: { members: Array<{ userId: string; targetUserId: string | null }>; status?: string; sentLastHour?: number }) {
  const created: unknown[] = [];
  let lastWhere: unknown;
  const db = {
    exchangeMember: {
      findUnique: async ({ where }: any) => {
        const m = opts.members.find((x) => x.userId === where.exchangeId_userId.userId);
        return m ? { targetUserId: m.targetUserId, exchange: { status: opts.status ?? 'MATCHED' } } : null;
      },
      findFirst: async ({ where }: any) => opts.members.find((x) => x.targetUserId === where.targetUserId) ?? null,
    },
    exchangeMessage: {
      count: async () => opts.sentLastHour ?? 0,
      create: async ({ data }: any) => {
        const row = { id: 'new', createdAt: at, ...data };
        created.push(row);
        return row;
      },
      findMany: async ({ where }: any) => {
        lastWhere = where;
        return [];
      },
    },
  };
  return { db: db as any, created, lastWhere: () => lastWhere };
}

const drawn = [
  { userId: 'a', targetUserId: 'b' },
  { userId: 'b', targetUserId: 'c' },
  { userId: 'c', targetUserId: 'a' },
];

test('Intel Messages - sending to the target and replying to the Santa pick the right recipient', async () => {
  const { db, created } = fakeDb({ members: drawn });
  const toTarget = await sendIntelMessage(db, { exchangeId: 'x', userId: 'a', channel: 'target', text: 'Size?' });
  assert.strictEqual(toTarget.status, 201);
  const toSanta = await sendIntelMessage(db, { exchangeId: 'x', userId: 'a', channel: 'santa', text: 'Medium' });
  assert.strictEqual(toSanta.status, 201);
  assert.deepStrictEqual(
    created.map((r: any) => [r.recipientId, r.isFromSanta]),
    [['b', true], ['c', false]]
  );
});

test('Intel Messages - sending is refused for outsiders, before the draw, after completion and past the hourly cap', async () => {
  const send = (db: any, userId = 'a') => sendIntelMessage(db, { exchangeId: 'x', userId, channel: 'target', text: 'hi' });
  assert.strictEqual((await send(fakeDb({ members: drawn }).db, 'z')).status, 403);
  assert.strictEqual((await send(fakeDb({ members: [{ userId: 'a', targetUserId: null }] }).db)).status, 409);
  assert.strictEqual((await send(fakeDb({ members: drawn, status: 'COMPLETED' }).db)).status, 409);
  assert.strictEqual((await send(fakeDb({ members: drawn, sentLastHour: INTEL_MESSAGES_PER_HOUR }).db)).status, 429);
  const badChannel = await sendIntelMessage(fakeDb({ members: drawn }).db, { exchangeId: 'x', userId: 'a', channel: 'everyone', text: 'hi' });
  assert.strictEqual(badChannel.status, 400);
});

test('Intel Messages - listing only queries the current pairs', async () => {
  const fake = fakeDb({ members: drawn });
  const res = await listIntelMessages(fake.db, 'x', 'a');
  assert.strictEqual(res.status, 200);
  const where = fake.lastWhere() as { OR: Array<{ senderId: string; recipientId: string }> };
  const people = new Set(where.OR.flatMap((c) => [c.senderId, c.recipientId]));
  assert.deepStrictEqual([...people].sort(), ['a', 'b', 'c']);
  assert.ok(where.OR.every((c) => c.senderId === 'a' || c.recipientId === 'a'));
});
