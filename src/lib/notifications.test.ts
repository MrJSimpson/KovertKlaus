/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import { dismissNotifications, listMyNotifications, MAX_DISMISS_IDS, notificationHref, pageNotifications } from './notifications';

/** In-memory stand-in for the two Prisma models the service touches. */
function fakeDb() {
  const notifications = [
    { id: 'n1', userId: 'me', title: 'Old', message: 'm', exchangeId: 'ex1', isAcknowledged: false, createdAt: new Date('2026-11-01T00:00:00Z') },
    { id: 'n2', userId: 'me', title: 'New', message: 'm', exchangeId: null, isAcknowledged: false, createdAt: new Date('2026-11-03T00:00:00Z') },
    { id: 'n3', userId: 'me', title: 'Gone mission', message: 'm', exchangeId: 'deleted', isAcknowledged: false, createdAt: new Date('2026-11-02T00:00:00Z') },
    { id: 'n4', userId: 'me', title: 'Removed', message: 'm', exchangeId: 'ex1', isAcknowledged: true, createdAt: new Date('2026-11-04T00:00:00Z') },
    { id: 'n5', userId: 'other', title: 'Not mine', message: 'm', exchangeId: 'ex1', isAcknowledged: false, createdAt: new Date('2026-11-05T00:00:00Z') },
  ];
  const matches = (n: any, where: any) =>
    n.userId === where.userId && n.isAcknowledged === where.isAcknowledged && (!where.id || where.id.in.includes(n.id));
  const db = {
    notification: {
      findMany: async ({ where }: any) =>
        notifications.filter((n) => matches(n, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      updateMany: async ({ where, data }: any) => {
        const hit = notifications.filter((n) => matches(n, where));
        hit.forEach((n) => Object.assign(n, data));
        return { count: hit.length };
      },
    },
    exchange: {
      findMany: async ({ where }: any) => [{ id: 'ex1', code: 'ABCD-1234' }].filter((e) => where.id.in.includes(e.id)),
    },
  };
  return { db: db as any, notifications };
}

test('Notifications - a mission notification links to its mission page', () => {
  assert.strictEqual(notificationHref('ABCD-1234'), '/exchange/ABCD-1234');
  assert.strictEqual(notificationHref(null), null);
  assert.strictEqual(notificationHref(''), null);
});

test('Notifications - list returns only my open notifications, newest first, with links', async () => {
  const { db } = fakeDb();
  const result = await listMyNotifications(db, 'me');
  const list = result.body.notifications as any[];
  assert.strictEqual(result.status, 200);
  assert.deepStrictEqual(list.map((n) => n.id), ['n2', 'n3', 'n1']);
  assert.deepStrictEqual(list.map((n) => n.href), [null, null, '/exchange/ABCD-1234']);
});

test('Notifications - remove by id touches only my notifications', async () => {
  const { db, notifications } = fakeDb();
  const result = await dismissNotifications(db, { userId: 'me', ids: ['n1', 'n5'] });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.removed, 1);
  assert.strictEqual(notifications.find((n) => n.id === 'n1')!.isAcknowledged, true);
  assert.strictEqual(notifications.find((n) => n.id === 'n5')!.isAcknowledged, false);
});

test('Notifications - remove all clears every open notification of mine', async () => {
  const { db, notifications } = fakeDb();
  const result = await dismissNotifications(db, { userId: 'me', all: true });
  assert.strictEqual(result.body.removed, 3);
  assert.strictEqual(notifications.find((n) => n.id === 'n5')!.isAcknowledged, false);
});

test('Notifications - remove rejects missing, malformed and oversized id lists', async () => {
  const { db } = fakeDb();
  assert.strictEqual((await dismissNotifications(db, { userId: 'me' })).status, 400);
  assert.strictEqual((await dismissNotifications(db, { userId: 'me', ids: [] })).status, 400);
  assert.strictEqual((await dismissNotifications(db, { userId: 'me', ids: [1] })).status, 400);
  assert.strictEqual((await dismissNotifications(db, { userId: 'me', all: 'yes' })).status, 400);
  const tooMany = Array.from({ length: MAX_DISMISS_IDS + 1 }, (_, i) => `n${i}`);
  assert.strictEqual((await dismissNotifications(db, { userId: 'me', ids: tooMany })).status, 400);
});

test('Notifications - pages hold ten and an out-of-range page clamps', () => {
  const items = Array.from({ length: 23 }, (_, i) => i);
  assert.deepStrictEqual(pageNotifications(items, 0).items, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepStrictEqual(pageNotifications(items, 2), { items: [20, 21, 22], page: 2, pageCount: 3 });
  assert.strictEqual(pageNotifications(items, 9).page, 2);
  assert.strictEqual(pageNotifications(items, -1).page, 0);
  assert.deepStrictEqual(pageNotifications([], 0), { items: [], page: 0, pageCount: 1 });
});
