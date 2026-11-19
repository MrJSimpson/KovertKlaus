/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import { dismissNotifications, listMyNotifications, MAX_DISMISS_IDS, MAX_LISTED_NOTIFICATIONS, notificationHref } from './notifications';

/**
 * Evaluates the subset of a Prisma `where` the service uses, with SQL's three-valued logic: a
 * condition on a `NULL` column is unknown (`null`), and `NOT unknown` is still unknown, so the row
 * does not match. That is the trap `UNPINNED_WHERE` avoids for rows without a `dedupeKey`.
 */
function evaluate(row: any, where: any): boolean | null {
  let result: boolean | null = true;
  const and = (v: boolean | null) => {
    if (result === false || v === false) result = false;
    else if (result === null || v === null) result = null;
  };
  for (const [key, cond] of Object.entries<any>(where)) {
    if (key === 'AND') for (const w of cond) and(evaluate(row, w));
    else if (key === 'OR') {
      const vs = cond.map((w: any) => evaluate(row, w));
      and(vs.includes(true) ? true : vs.includes(null) ? null : false);
    } else if (key === 'NOT') {
      const v = evaluate(row, cond);
      and(v === null ? null : !v);
    } else if (cond === null) and(row[key] === null);
    else if (typeof cond === 'object' && 'in' in cond) and(cond.in.includes(row[key]));
    else if (typeof cond === 'object' && 'startsWith' in cond) and(row[key] === null ? null : String(row[key]).startsWith(cond.startsWith));
    else and(row[key] === cond);
  }
  return result;
}

const matches = (row: any, where: any) => evaluate(row, where) === true;

/** In-memory stand-in for the Prisma models the service touches. */
function fakeDb(opts: { address?: boolean; remoteMission?: boolean } = {}) {
  const notifications: any[] = [
    { id: 'n1', userId: 'me', title: '🎯 Secret Target Assigned: Office', message: 'm', exchangeId: 'ex1', dedupeKey: null, isAcknowledged: false, createdAt: new Date('2026-11-01T00:00:00Z') },
    { id: 'n2', userId: 'me', title: 'New', message: 'm', exchangeId: null, dedupeKey: null, isAcknowledged: false, createdAt: new Date('2026-11-03T00:00:00Z') },
    { id: 'n3', userId: 'me', title: 'Gone mission', message: 'm', exchangeId: 'deleted', dedupeKey: 'mission-cancelled:deleted', isAcknowledged: false, createdAt: new Date('2026-11-02T00:00:00Z') },
    { id: 'n4', userId: 'me', title: 'Removed', message: 'm', exchangeId: 'ex1', dedupeKey: null, isAcknowledged: true, createdAt: new Date('2026-11-04T00:00:00Z') },
    { id: 'n5', userId: 'other', title: 'Not mine', message: 'm', exchangeId: 'ex1', dedupeKey: null, isAcknowledged: false, createdAt: new Date('2026-11-05T00:00:00Z') },
    { id: 'p1', userId: 'me', title: 'Mission paused: fix the draw', message: 'm', exchangeId: 'ex1', dedupeKey: 'repair:ex1', isAcknowledged: false, createdAt: new Date('2026-11-02T12:00:00Z') },
  ];
  const db = {
    notification: {
      findMany: async ({ where, take }: any) =>
        notifications
          .filter((n) => matches(n, where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, take ?? Infinity),
      count: async ({ where }: any) => notifications.filter((n) => matches(n, where)).length,
      updateMany: async ({ where, data }: any) => {
        const hit = notifications.filter((n) => matches(n, where));
        hit.forEach((n) => Object.assign(n, data));
        return { count: hit.length };
      },
    },
    exchange: {
      findMany: async ({ where }: any) => [{ id: 'ex1', code: 'ABCD-1234', title: 'Office' }].filter((e) => where.id.in.includes(e.id)),
    },
    user: {
      findUnique: async () =>
        opts.address === false ? { streetAddress: null, city: 'X', state: 'Y', zipCode: '1' } : { streetAddress: '1 Main', city: 'X', state: 'Y', zipCode: '1' },
    },
    exchangeMember: {
      findFirst: async () => (opts.remoteMission === false ? null : { exchange: { id: 'ex1', title: 'Office' } }),
    },
  };
  return { db: db as any, notifications };
}

test('Notifications - a mission notification links to its mission page', () => {
  assert.strictEqual(notificationHref('ABCD-1234'), '/exchange/ABCD-1234');
  assert.strictEqual(notificationHref(null), null);
  assert.strictEqual(notificationHref(''), null);
});

test('Notifications - list returns my open unpinned notifications, newest first, with links and mission names', async () => {
  const { db } = fakeDb();
  const result = await listMyNotifications(db, 'me');
  const list = result.body.notifications as any[];
  assert.strictEqual(result.status, 200);
  assert.deepStrictEqual(list.map((n) => n.id), ['n2', 'n3', 'n1']);
  assert.deepStrictEqual(list.map((n) => n.href), [null, null, '/exchange/ABCD-1234']);
  assert.deepStrictEqual(list.map((n) => n.missionName), [null, null, 'Office']);
  assert.strictEqual(result.body.total, 3);
});

test('Notifications - a pre-2.0 title loses its emoji and mission suffix, and its kind comes from the title', async () => {
  const { db } = fakeDb();
  const n1 = ((await listMyNotifications(db, 'me')).body.notifications as any[]).find((n) => n.id === 'n1');
  assert.strictEqual(n1.title, 'Secret Target Assigned');
  assert.strictEqual(n1.kind, 'target');
});

test('Notifications - repair notices are pinned, not listed', async () => {
  const { db } = fakeDb();
  const body = (await listMyNotifications(db, 'me')).body;
  assert.deepStrictEqual((body.pinned as any[]).map((p) => [p.id, p.tone, p.actionLabel, p.href]), [['p1', 'danger', 'Fix the draw', '/exchange/ABCD-1234']]);
  assert.ok(!(body.notifications as any[]).some((n) => n.id === 'p1'));
});

test('Notifications - a missing shipping address is pinned while a remote Secret Santa mission runs', async () => {
  const missing = (await listMyNotifications(fakeDb({ address: false }).db, 'me')).body.pinned as any[];
  assert.deepStrictEqual(missing.map((p) => [p.id, p.action, p.missionName]), [['p1', null, 'Office'], ['shipping-address', 'shipping', 'Office']]);
  const noMission = (await listMyNotifications(fakeDb({ address: false, remoteMission: false }).db, 'me')).body.pinned as any[];
  assert.deepStrictEqual(noMission.map((p) => p.id), ['p1']);
  const complete = (await listMyNotifications(fakeDb().db, 'me')).body.pinned as any[];
  assert.deepStrictEqual(complete.map((p) => p.id), ['p1']);
});

test('Notifications - summary returns counts only, pinned counted apart', async () => {
  const body = (await listMyNotifications(fakeDb({ address: false }).db, 'me', { summary: true })).body;
  assert.deepStrictEqual(body, { success: true, total: 3, pinnedCount: 2 });
});

test('Notifications - list loads at most MAX_LISTED_NOTIFICATIONS and reports the total', async () => {
  const { db, notifications } = fakeDb();
  for (let i = 0; i < MAX_LISTED_NOTIFICATIONS + 50; i++) {
    notifications.push({ id: `bulk${i}`, userId: 'me', isAcknowledged: false, title: 't', message: 'm', exchangeId: null, dedupeKey: null, createdAt: new Date(2026, 0, 1, 0, i) });
  }
  const result = await listMyNotifications(db, 'me');
  assert.strictEqual((result.body.notifications as any[]).length, MAX_LISTED_NOTIFICATIONS);
  assert.strictEqual(result.body.total, MAX_LISTED_NOTIFICATIONS + 53);
});

test('Notifications - remove by id touches only my unpinned notifications', async () => {
  const { db, notifications } = fakeDb();
  const result = await dismissNotifications(db, { userId: 'me', ids: ['n1', 'n5', 'p1'] });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.removed, 1);
  assert.strictEqual(notifications.find((n) => n.id === 'n1')!.isAcknowledged, true);
  assert.strictEqual(notifications.find((n) => n.id === 'n5')!.isAcknowledged, false);
  assert.strictEqual(notifications.find((n) => n.id === 'p1')!.isAcknowledged, false);
});

test('Notifications - remove all clears every open notification of mine, keyed or not, except pinned ones', async () => {
  const { db, notifications } = fakeDb();
  const result = await dismissNotifications(db, { userId: 'me', all: true });
  assert.strictEqual(result.body.removed, 3);
  assert.deepStrictEqual(
    notifications.filter((n) => !n.isAcknowledged).map((n) => n.id),
    ['n5', 'p1'],
  );
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
