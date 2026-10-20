/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import {
  cancelMission,
  canCancelMission,
  deleteMission,
  deletionSchedule,
  DELETE_WAIT_MS,
  isMissionClosed,
  purgeCancelledMissions,
  PURGE_AFTER_MS,
  type MissionCancelledEmail,
} from './mission-cancel';

const NOW = Date.parse('2026-11-05T12:00:00Z');
const HOUR = 60 * 60 * 1000;

/** In-memory stand-in for the Prisma models the service touches. */
function fakeDb(status = 'RECRUITING', overrides: Record<string, unknown> = {}) {
  const exchange: any = {
    id: 'ex1', title: 'Family Swap', code: 'ABCD-1234', status, organizerId: 'boss',
    isWhiteElephant: false, createdAt: new Date('2026-10-01T00:00:00Z'), executionDate: new Date('2026-12-20T00:00:00Z'),
    cancelledAt: null, cancelledBy: null, cancelledFromStatus: null, cancelCode: null, cancelReason: null,
    members: [
      { id: 'm1', userId: 'boss', user: { name: 'Holly', email: 'boss@x.com', emailNotifications: true } },
      { id: 'm2', userId: 'u2', user: { name: 'Ivy', email: 'ivy@x.com', emailNotifications: true } },
      { id: 'm3', userId: 'u3', user: { name: 'Noel', email: 'noel@x.com', emailNotifications: false } },
    ],
    ...overrides,
  };
  let exists = true;
  const notifications: any[] = [];
  const history: any[] = [];
  const deleted = { items: 0, notifications: 0 };
  const db = {
    exchange: {
      findUnique: async () => (exists ? exchange : null),
      findMany: async ({ where }: any) =>
        exists && exchange.status === where.status && exchange.cancelledAt <= where.cancelledAt.lte ? [exchange] : [],
      updateMany: async ({ where, data }: any) => {
        if (!exists || exchange.status !== where.status) return { count: 0 };
        Object.assign(exchange, data);
        return { count: 1 };
      },
      delete: async () => {
        exists = false;
        return exchange;
      },
    },
    missionHistory: { create: async ({ data }: any) => history.push(data) },
    item: { deleteMany: async () => ({ count: (deleted.items += 2) }) },
    notification: {
      deleteMany: async () => ({ count: (deleted.notifications += 1) }),
      upsert: async ({ where, create, update }: any) => {
        const found = notifications.find((n) => n.userId === where.userId_dedupeKey.userId && n.dedupeKey === where.userId_dedupeKey.dedupeKey);
        if (found) return Object.assign(found, update);
        notifications.push({ ...create });
        return create;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return { db: db as any, exchange, notifications, history, deleted, isDeleted: () => !exists };
}

function fakeDeps() {
  const sent: MissionCancelledEmail[] = [];
  return { sent, deps: { baseUrl: 'https://kk.test/', sendEmail: async (e: MissionCancelledEmail) => (sent.push(e), { success: true }) } };
}

test('Mission cancel - completed and cancelled missions cannot be cancelled again', () => {
  assert.strictEqual(canCancelMission('RECRUITING'), true);
  assert.strictEqual(canCancelMission('SHIPPED'), true);
  assert.strictEqual(canCancelMission('COMPLETED'), false);
  assert.strictEqual(canCancelMission('CANCELLED'), false);
  assert.strictEqual(isMissionClosed('CANCELLED'), true);
  assert.strictEqual(isMissionClosed('MATCHED'), false);
});

test('Mission cancel - before the draw: delete by hand after 48 h; always purged at 90 days', () => {
  const cancelledAt = new Date(NOW);
  const pre = deletionSchedule({ status: 'CANCELLED', cancelledAt, cancelledFromStatus: 'SETUP' });
  assert.strictEqual(pre.manualDeleteFrom!.getTime(), NOW + DELETE_WAIT_MS);
  assert.strictEqual(pre.purgeOn!.getTime(), NOW + PURGE_AFTER_MS);
  const post = deletionSchedule({ status: 'CANCELLED', cancelledAt, cancelledFromStatus: 'MATCHED' });
  assert.strictEqual(post.manualDeleteFrom, null);
  assert.strictEqual(post.purgeOn!.getTime(), NOW + PURGE_AFTER_MS);
  assert.deepStrictEqual(deletionSchedule({ status: 'RECRUITING', cancelledAt: null, cancelledFromStatus: null }), { manualDeleteFrom: null, purgeOn: null });
});

test('Mission cancel - the Head Elf cancels: status, reason and notices for every agent', async () => {
  const { db, exchange, notifications } = fakeDb('SETUP');
  const { deps, sent } = fakeDeps();
  const result = await cancelMission(db, deps, { exchangeId: 'ex1', actor: 'HEAD_ELF', actorUserId: 'boss', reason: ' Not enough time ' }, NOW);
  assert.strictEqual(result.status, 200);
  assert.strictEqual(exchange.status, 'CANCELLED');
  assert.strictEqual(exchange.cancelledBy, 'HEAD_ELF');
  assert.strictEqual(exchange.cancelCode, 'HEAD_ELF_CANCELLED');
  assert.strictEqual(exchange.cancelledFromStatus, 'SETUP');
  assert.strictEqual(exchange.cancelReason, 'Not enough time');
  assert.strictEqual(notifications.length, 3);
  assert.ok(notifications.every((n) => n.message.includes('please save it now') && n.message.includes('The Head Elf')));
  assert.ok(notifications.find((n) => n.userId === 'boss').message.includes('delete it permanently'));
  assert.ok(!notifications.find((n) => n.userId === 'u2').message.includes('delete it permanently'));
  // Email respects the agent's email preference; the link opens the mission.
  assert.deepStrictEqual(sent.map((e) => e.recipientEmail), ['boss@x.com', 'ivy@x.com']);
  assert.strictEqual(sent[0].actionUrl, 'https://kk.test/exchange/ABCD-1234');
});

test('Mission cancel - after the draw the Head Elf is told about the 90-day deletion', async () => {
  const { db, notifications } = fakeDb('MATCHED');
  const { deps } = fakeDeps();
  await cancelMission(db, deps, { exchangeId: 'ex1', actor: 'ADMIN' }, NOW);
  const boss = notifications.find((n) => n.userId === 'boss');
  assert.ok(boss.message.includes('A KovertKlaus admin cancelled'));
  assert.ok(boss.message.includes('deleted automatically on February 3, 2027'));
});

test('Mission cancel - refuses other agents, completed and already-cancelled missions', async () => {
  const { deps } = fakeDeps();
  assert.strictEqual((await cancelMission(fakeDb().db, deps, { exchangeId: 'ex1', actor: 'HEAD_ELF', actorUserId: 'u2' }, NOW)).status, 403);
  assert.strictEqual((await cancelMission(fakeDb('COMPLETED').db, deps, { exchangeId: 'ex1', actor: 'ADMIN' }, NOW)).status, 409);
  assert.strictEqual((await cancelMission(fakeDb('CANCELLED').db, deps, { exchangeId: 'ex1', actor: 'ADMIN' }, NOW)).status, 409);
  assert.strictEqual((await cancelMission(fakeDb().db, deps, { exchangeId: 'ex1', actor: 'ADMIN', reason: 'x'.repeat(501) }, NOW)).status, 400);
  assert.strictEqual((await cancelMission(fakeDb().db, deps, { exchangeId: 'ex1', actor: 'ADMIN', reason: 5 }, NOW)).status, 400);
});

test('Mission delete - needs confirmation, cancellation first, and the 48-hour wait', async () => {
  const cancelled = { cancelledAt: new Date(NOW), cancelledFromStatus: 'RECRUITING', cancelledBy: 'HEAD_ELF', cancelCode: 'HEAD_ELF_CANCELLED' };
  assert.strictEqual((await deleteMission(fakeDb('CANCELLED', cancelled).db, { exchangeId: 'ex1', actor: 'HEAD_ELF', actorUserId: 'boss' }, NOW)).status, 400);
  assert.strictEqual((await deleteMission(fakeDb('SETUP').db, { exchangeId: 'ex1', actor: 'HEAD_ELF', actorUserId: 'boss', confirm: true }, NOW)).status, 409);
  assert.strictEqual((await deleteMission(fakeDb('COMPLETED').db, { exchangeId: 'ex1', actor: 'ADMIN', confirm: true }, NOW)).status, 409);
  assert.strictEqual((await deleteMission(fakeDb('CANCELLED', cancelled).db, { exchangeId: 'ex1', actor: 'HEAD_ELF', actorUserId: 'u2', confirm: true }, NOW)).status, 403);
  assert.strictEqual((await deleteMission(fakeDb('CANCELLED', cancelled).db, { exchangeId: 'ex1', actor: 'HEAD_ELF', actorUserId: 'boss', confirm: true }, NOW + 47 * HOUR)).status, 409);
  const afterDraw = { ...cancelled, cancelledFromStatus: 'MATCHED' };
  const late = await deleteMission(fakeDb('CANCELLED', afterDraw).db, { exchangeId: 'ex1', actor: 'ADMIN', confirm: true }, NOW + 30 * 24 * HOUR);
  assert.strictEqual(late.status, 409);
  assert.match(String(late.body.error), /after the draw/);
});

test('Mission delete - erases the mission, keeps an anonymous history row, tells only the Head Elf', async () => {
  const cancelled = { cancelledAt: new Date(NOW), cancelledFromStatus: 'RECRUITING', cancelledBy: 'HEAD_ELF', cancelCode: 'HEAD_ELF_CANCELLED' };
  const f = fakeDb('CANCELLED', cancelled);
  const result = await deleteMission(f.db, { exchangeId: 'ex1', actor: 'HEAD_ELF', actorUserId: 'boss', confirm: true }, NOW + 48 * HOUR);
  assert.strictEqual(result.status, 200);
  assert.strictEqual(f.isDeleted(), true);
  assert.strictEqual(f.deleted.items, 2);
  assert.strictEqual(f.deleted.notifications, 1);
  assert.strictEqual(f.history.length, 1);
  assert.deepStrictEqual(
    { reason: f.history[0].reason, deletedBy: f.history[0].deletedBy, memberCount: f.history[0].memberCount },
    { reason: 'HEAD_ELF_CANCELLED', deletedBy: 'HEAD_ELF', memberCount: 3 }
  );
  assert.ok(!('title' in f.history[0]), 'history never stores the mission title');
  assert.deepStrictEqual(f.notifications.map((n) => [n.userId, n.exchangeId]), [['boss', null]]);
});

test('Mission purge - erases missions cancelled 90+ days ago only', async () => {
  const old = fakeDb('CANCELLED', { cancelledAt: new Date(NOW - PURGE_AFTER_MS), cancelledFromStatus: 'SHIPPED', cancelCode: 'ADMIN_CANCELLED' });
  assert.strictEqual(await purgeCancelledMissions(old.db, NOW), 1);
  assert.strictEqual(old.history[0].deletedBy, 'SYSTEM');
  const recent = fakeDb('CANCELLED', { cancelledAt: new Date(NOW - PURGE_AFTER_MS + HOUR), cancelledFromStatus: 'SHIPPED' });
  assert.strictEqual(await purgeCancelledMissions(recent.db, NOW), 0);
  assert.strictEqual(recent.isDeleted(), false);
});
