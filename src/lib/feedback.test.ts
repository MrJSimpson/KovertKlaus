/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import { deleteFeedback, listFeedback, MAX_FEEDBACK_LENGTH, MAX_FEEDBACK_PER_DAY, pagePath, submitFeedback, updateFeedbackStatus } from './feedback';
import { APP_VERSION } from './version';

const NOW = Date.parse('2026-10-27T18:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

/** Fake Prisma client holding `Feedback` rows in memory. */
function fakeDb(rows: any[] = []) {
  const matches = (r: any, where: any = {}) =>
    Object.entries(where).every(([k, v]: [string, any]) => (v && typeof v === 'object' && 'gt' in v ? r[k] > v.gt : r[k] === v));
  const db = {
    feedback: {
      count: async ({ where }: any) => rows.filter((r) => matches(r, where)).length,
      create: async ({ data }: any) => {
        const row = { id: `f${rows.length + 1}`, status: 'NEW', createdAt: new Date(NOW), ...data };
        rows.push(row);
        return { id: row.id };
      },
      findMany: async ({ where }: any) =>
        rows
          .filter((r) => matches(r, where))
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((r) => ({ ...r, user: { name: 'Ivy', email: 'ivy@x.com' } })),
      updateMany: async ({ where, data }: any) => {
        const hit = rows.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
      deleteMany: async ({ where }: any) => {
        const before = rows.length;
        rows.splice(0, rows.length, ...rows.filter((r) => !matches(r, where)));
        return { count: before - rows.length };
      },
    },
  };
  return { db: db as any, rows };
}

test('Feedback - stores type, trimmed message, page path, server version and browser', async () => {
  const f = fakeDb();
  const result = await submitFeedback(
    f.db,
    { userId: 'u1', type: 'bug', message: '  Draw button does nothing  ', pageUrl: 'https://kovertklaus.com/exchange/AB-12?code=secret#x', userAgent: 'Mozilla/5.0' },
    NOW
  );
  assert.strictEqual(result.status, 201);
  assert.deepStrictEqual(
    { type: f.rows[0].type, message: f.rows[0].message, pagePath: f.rows[0].pagePath, appVersion: f.rows[0].appVersion, userAgent: f.rows[0].userAgent },
    { type: 'BUG', message: 'Draw button does nothing', pagePath: '/exchange/AB-12', appVersion: APP_VERSION, userAgent: 'Mozilla/5.0' }
  );
});

test('Feedback - rejects a bad type, an empty message and an over-long message', async () => {
  const f = fakeDb();
  assert.strictEqual((await submitFeedback(f.db, { userId: 'u1', type: 'PRAISE', message: 'hi' }, NOW)).status, 400);
  assert.strictEqual((await submitFeedback(f.db, { userId: 'u1', type: 'IDEA', message: '   ' }, NOW)).status, 400);
  assert.strictEqual((await submitFeedback(f.db, { userId: 'u1', type: 'IDEA', message: 42 }, NOW)).status, 400);
  assert.strictEqual((await submitFeedback(f.db, { userId: 'u1', type: 'IDEA', message: 'x'.repeat(MAX_FEEDBACK_LENGTH + 1) }, NOW)).status, 400);
  assert.strictEqual((await submitFeedback(f.db, { userId: 'u1', type: 'IDEA', message: 'x'.repeat(MAX_FEEDBACK_LENGTH) }, NOW)).status, 201);
  assert.strictEqual(f.rows.length, 1);
});

test('Feedback - each agent may send a limited number in any 24 hours', async () => {
  const old = Array.from({ length: MAX_FEEDBACK_PER_DAY }, (_, i) => ({ id: `o${i}`, userId: 'u1', createdAt: new Date(NOW - DAY - 1) }));
  const recent = Array.from({ length: MAX_FEEDBACK_PER_DAY }, (_, i) => ({ id: `r${i}`, userId: 'u1', createdAt: new Date(NOW - 1000) }));
  assert.strictEqual((await submitFeedback(fakeDb([...old]).db, { userId: 'u1', type: 'BUG', message: 'ok' }, NOW)).status, 201);
  assert.strictEqual((await submitFeedback(fakeDb([...recent]).db, { userId: 'u1', type: 'BUG', message: 'ok' }, NOW)).status, 429);
  assert.strictEqual((await submitFeedback(fakeDb([...recent]).db, { userId: 'u2', type: 'BUG', message: 'ok' }, NOW)).status, 201);
});

test('Feedback - page path drops query strings and junk', () => {
  assert.strictEqual(pagePath('/dashboard?x=1'), '/dashboard');
  assert.strictEqual(pagePath('https://kovertklaus.com/opkits#top'), '/opkits');
  assert.strictEqual(pagePath(''), null);
  assert.strictEqual(pagePath(7), null);
  assert.ok((pagePath('/' + 'a'.repeat(1000)) as string).length <= 300);
});

test('Feedback - North Pole list filters by status and type and counts new reports', async () => {
  const f = fakeDb([
    { id: 'a', userId: 'u1', type: 'BUG', status: 'NEW', message: 'one', createdAt: new Date(NOW - 2000) },
    { id: 'b', userId: 'u1', type: 'IDEA', status: 'NEW', message: 'two', createdAt: new Date(NOW - 1000) },
    { id: 'c', userId: 'u1', type: 'BUG', status: 'DONE', message: 'three', createdAt: new Date(NOW) },
  ]);
  const all = await listFeedback(f.db, {});
  assert.deepStrictEqual((all.body.feedback as any[]).map((r) => r.id), ['c', 'b', 'a']);
  assert.strictEqual(all.body.newCount, 2);
  assert.strictEqual((all.body.feedback as any[])[0].userEmail, 'ivy@x.com');
  const newBugs = await listFeedback(f.db, { status: 'new', type: 'bug' });
  assert.deepStrictEqual((newBugs.body.feedback as any[]).map((r) => r.id), ['a']);
  // Unknown filters list everything rather than nothing.
  assert.strictEqual((await listFeedback(f.db, { status: 'bogus', type: 'bogus' })).body.totalCount, 3);
});

test('Feedback - triage status changes and deletes check their input', async () => {
  const f = fakeDb([{ id: 'a', userId: 'u1', type: 'BUG', status: 'NEW', message: 'one', createdAt: new Date(NOW) }]);
  assert.strictEqual((await updateFeedbackStatus(f.db, { id: 'a', status: 'reviewed' })).status, 200);
  assert.strictEqual(f.rows[0].status, 'REVIEWED');
  assert.strictEqual((await updateFeedbackStatus(f.db, { id: 'a', status: 'ARCHIVED' })).status, 400);
  assert.strictEqual((await updateFeedbackStatus(f.db, { id: 'zzz', status: 'DONE' })).status, 404);
  assert.strictEqual((await updateFeedbackStatus(f.db, { id: 5, status: 'DONE' })).status, 400);
  assert.strictEqual((await deleteFeedback(f.db, null)).status, 400);
  assert.strictEqual((await deleteFeedback(f.db, 'zzz')).status, 404);
  assert.strictEqual((await deleteFeedback(f.db, 'a')).status, 200);
  assert.strictEqual(f.rows.length, 0);
});
