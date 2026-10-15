/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import {
  validateIntelMessage,
  toMessageView,
  debriefWindow,
  sendIntelMessage,
  listIntelMessages,
  INTEL_MESSAGE_MAX_CHARS,
  INTEL_MESSAGES_PER_HOUR,
} from './intel-messages';

const at = new Date('2026-12-01T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const intel = (senderId: string, recipientId: string, isFromSanta: boolean) => ({
  id: `${senderId}-${recipientId}`, channel: 'INTEL', senderId, recipientId, messageText: 'hi', isFromSanta, createdAt: at,
});

test('Messages - text is required, cleaned and length-capped', () => {
  assert.deepStrictEqual(validateIntelMessage('  <b>Hello</b> '), { ok: true, text: 'Hello' });
  assert.strictEqual(validateIntelMessage('   ').ok, false);
  assert.strictEqual(validateIntelMessage(42).ok, false);
  assert.strictEqual(validateIntelMessage('x'.repeat(INTEL_MESSAGE_MAX_CHARS)).ok, true);
  assert.strictEqual(validateIntelMessage('x'.repeat(INTEL_MESSAGE_MAX_CHARS + 1)).ok, false);
});

test('Messages - Intel threads keep the Santa anonymous', () => {
  assert.strictEqual(toMessageView(intel('santa', 'target', true), 'santa', 'boss')?.thread, 'intel:target');
  assert.strictEqual(toMessageView(intel('santa', 'target', true), 'target', 'boss')?.thread, 'intel:santa');
  assert.strictEqual(toMessageView(intel('target', 'santa', false), 'target', 'boss')?.thread, 'intel:santa');
  assert.strictEqual(toMessageView(intel('target', 'santa', false), 'santa', 'boss')?.thread, 'intel:target');
  const view = toMessageView(intel('santa', 'target', true), 'target', 'boss', new Map([['santa', 'Agent: Gale']]))!;
  assert.deepStrictEqual(Object.keys(view).sort(), ['channel', 'createdAt', 'fromMe', 'id', 'text', 'thread']);
  assert.ok(!JSON.stringify(view).includes('Gale'));
  assert.strictEqual(toMessageView(intel('santa', 'target', true), 'someone', 'boss'), null);
});

test('Messages - Command threads are keyed by the other person and name the sender', () => {
  const cmd = { ...intel('boss', 'a', false), channel: 'COMMAND' };
  const names = new Map([['boss', 'Agent: Holly']]);
  assert.deepStrictEqual(toMessageView(cmd, 'a', 'boss', names)?.sender, { codename: 'Agent: Holly', isHeadElf: true });
  assert.strictEqual(toMessageView(cmd, 'a', 'boss', names)?.thread, 'command:boss');
  assert.strictEqual(toMessageView(cmd, 'boss', 'boss', names)?.thread, 'command:a');
  assert.strictEqual(toMessageView(cmd, 'b', 'boss', names), null);
});

test('Messages - Debrief opens at completion and closes 14 days later', () => {
  const exec = new Date('2026-12-20T00:00:00Z');
  const done = new Date('2026-12-22T00:00:00Z');
  assert.strictEqual(debriefWindow({ status: 'SHIPPED', completedAt: null, executionDate: exec }, done.getTime()).open, false);
  const mission = { status: 'COMPLETED', completedAt: done, executionDate: exec };
  assert.strictEqual(debriefWindow(mission, done.getTime() + 13 * DAY).open, true);
  assert.strictEqual(debriefWindow(mission, done.getTime() + 14 * DAY).open, false);
  // Completed before completedAt existed: the window runs from Exchange Day.
  assert.strictEqual(debriefWindow({ ...mission, completedAt: null }, exec.getTime() + 15 * DAY).open, false);
});

/** Minimal in-memory stand-in for the two Prisma models the service touches. */
function fakeDb(opts: {
  members: Array<{ userId: string; targetUserId: string | null }>;
  status?: string;
  completedAt?: Date | null;
  sentLastHour?: number;
}) {
  const created: any[] = [];
  let lastWhere: any;
  const exchange = {
    status: opts.status ?? 'MATCHED',
    completedAt: opts.completedAt ?? null,
    executionDate: new Date('2026-12-20T00:00:00Z'),
    organizerId: 'boss',
  };
  const db = {
    exchangeMember: {
      findUnique: async ({ where }: any) => {
        const m = opts.members.find((x) => x.userId === where.exchangeId_userId.userId);
        return m ? { userId: m.userId, targetUserId: m.targetUserId, exchange } : null;
      },
      findFirst: async ({ where }: any) => opts.members.find((x) => x.targetUserId === where.targetUserId) ?? null,
      findMany: async () => opts.members.map((m) => ({ userId: m.userId, codename: `Agent: ${m.userId}`, user: { codename: null, name: m.userId } })),
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

// boss is the Head Elf and also an agent in the draw.
const drawn = [
  { userId: 'boss', targetUserId: 'a' },
  { userId: 'a', targetUserId: 'b' },
  { userId: 'b', targetUserId: 'boss' },
];
const send = (db: any, userId: string, channel: string, to?: string) =>
  sendIntelMessage(db, { exchangeId: 'x', userId, channel, to, text: 'hi' }, Date.parse('2026-12-23T00:00:00Z'));

test('Messages - Intel goes to the target or the Santa', async () => {
  const { db, created } = fakeDb({ members: drawn });
  assert.strictEqual((await send(db, 'a', 'intel', 'target')).status, 201);
  assert.strictEqual((await send(db, 'a', 'intel', 'santa')).status, 201);
  assert.deepStrictEqual(created.map((r) => [r.channel, r.recipientId, r.isFromSanta]), [['INTEL', 'b', true], ['INTEL', 'boss', false]]);
  assert.strictEqual((await send(db, 'a', 'intel')).status, 400);
  assert.strictEqual((await send(fakeDb({ members: [{ userId: 'a', targetUserId: null }] }).db, 'a', 'intel', 'target')).status, 409);
});

test('Messages - Command: agents write to the Head Elf, the Head Elf picks an enrolled agent', async () => {
  const { db, created } = fakeDb({ members: drawn });
  assert.strictEqual((await send(db, 'a', 'command')).status, 201);
  assert.strictEqual((await send(db, 'boss', 'command', 'b')).status, 201);
  assert.deepStrictEqual(created.map((r) => [r.channel, r.recipientId]), [['COMMAND', 'boss'], ['COMMAND', 'b']]);
  assert.strictEqual((await send(db, 'boss', 'command', 'stranger')).status, 404);
  assert.strictEqual((await send(db, 'boss', 'command')).status, 400);
});

test('Messages - Command and Intel close at completion; Debrief only opens then', async () => {
  const live = fakeDb({ members: drawn }).db;
  assert.strictEqual((await send(live, 'a', 'debrief')).status, 409);
  const done = fakeDb({ members: drawn, status: 'COMPLETED', completedAt: new Date('2026-12-22T00:00:00Z') });
  assert.strictEqual((await send(done.db, 'a', 'command')).status, 409);
  assert.strictEqual((await send(done.db, 'a', 'intel', 'target')).status, 409);
  assert.strictEqual((await send(done.db, 'a', 'debrief')).status, 201);
  assert.deepStrictEqual([done.created[0].channel, done.created[0].recipientId], ['DEBRIEF', null]);
  const stale = fakeDb({ members: drawn, status: 'COMPLETED', completedAt: new Date('2026-12-01T00:00:00Z') });
  assert.strictEqual((await send(stale.db, 'a', 'debrief')).status, 409);
});

test('Messages - outsiders, bad channels and the hourly cap are refused', async () => {
  assert.strictEqual((await send(fakeDb({ members: drawn }).db, 'z', 'command')).status, 403);
  assert.strictEqual((await send(fakeDb({ members: drawn }).db, 'a', 'everyone')).status, 400);
  assert.strictEqual((await send(fakeDb({ members: drawn, sentLastHour: INTEL_MESSAGES_PER_HOUR }).db, 'a', 'command')).status, 429);
});

test('Messages - an agent lists only their own Command thread and current Intel pairs', async () => {
  const fake = fakeDb({ members: drawn });
  const res = await listIntelMessages(fake.db, 'x', 'a', Date.parse('2026-12-23T00:00:00Z'));
  assert.strictEqual(res.status, 200);
  const clauses = fake.lastWhere().OR as any[];
  assert.ok(clauses.every((c) => c.channel !== 'DEBRIEF'));
  assert.ok(clauses.every((c) => c.senderId === 'a' || c.recipientId === 'a'));
  assert.deepStrictEqual((res.body.commandRecipients as any[]).map((r) => r.userId), ['boss']);
});

test('Messages - the Head Elf can message every other agent', async () => {
  const res = await listIntelMessages(fakeDb({ members: drawn }).db, 'x', 'boss');
  assert.deepStrictEqual((res.body.commandRecipients as any[]).map((r) => r.userId), ['a', 'b']);
});
