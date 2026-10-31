/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import { checkJoinThrottle, JOIN_LIMITS, JOIN_SCOPE, JOIN_WINDOWS_MS, joinThrottledResponseParts, joinThrottleKeys, joinTripLogMessage, recordWrongCode } from './join-throttle';
import { UNKNOWN_IP } from './login-throttle';

const NOW = Date.parse('2026-10-31T18:00:00.000Z');

/** Fake `loginThrottle` table holding rows in memory. */
function fakeDb(rows: any[] = []) {
  const matches = (r: any, where: any) =>
    Object.entries(where).every(([k, v]: [string, any]) => (v && typeof v === 'object' && 'gt' in v ? r[k] > v.gt : r[k] === v));
  return {
    rows,
    loginThrottle: {
      count: async ({ where }: any) => rows.filter((r) => matches(r, where)).length,
      findFirst: async ({ where }: any) => rows.filter((r) => matches(r, where)).sort((a, b) => a.createdAt - b.createdAt)[0] ?? null,
      create: async ({ data }: any) => {
        rows.push({ ...data, createdAt: new Date(NOW) });
        return data;
      },
    },
  } as any;
}

function wrongCodes(keys: ReturnType<typeof joinThrottleKeys>, n: number, agoMs = 60_000) {
  return Array.from({ length: n }, () => ({ scope: JOIN_SCOPE, accountHash: keys.accountHash, ipHash: keys.ipHash, createdAt: new Date(NOW - agoMs) }));
}

test('joinThrottleKeys: hashes identifiers and flags signed-out and unknown-IP lookups', () => {
  const k = joinThrottleKeys('user-1', '203.0.113.9');
  assert.ok(!k.accountHash.includes('user-1') && !k.ipHash.includes('203.0.113.9'));
  assert.strictEqual(k.hasAccount, true);
  assert.strictEqual(k.ipKnown, true);
  const anon = joinThrottleKeys(null, UNKNOWN_IP);
  assert.strictEqual(anon.hasAccount, false);
  assert.strictEqual(anon.ipKnown, false);
});

test('checkJoinThrottle: allows lookups under the limits', async () => {
  const keys = joinThrottleKeys('user-1', '203.0.113.9');
  const d = await checkJoinThrottle(fakeDb(wrongCodes(keys, JOIN_LIMITS.ACCOUNT - 1)), keys, NOW);
  assert.strictEqual(d.blocked, false);
});

test('checkJoinThrottle: blocks one agent after too many wrong codes, with a retry time', async () => {
  const keys = joinThrottleKeys('user-1', '203.0.113.9');
  const d = await checkJoinThrottle(fakeDb(wrongCodes(keys, JOIN_LIMITS.ACCOUNT, 10 * 60_000)), keys, NOW);
  assert.strictEqual(d.blocked, true);
  if (d.blocked) {
    assert.strictEqual(d.rule, 'ACCOUNT');
    assert.strictEqual(d.retryAfterSec, (JOIN_WINDOWS_MS.ACCOUNT - 10 * 60_000) / 1000);
  }
});

test('checkJoinThrottle: blocks one network across accounts and signed-out visitors', async () => {
  const keys = joinThrottleKeys(null, '203.0.113.9');
  const d = await checkJoinThrottle(fakeDb(wrongCodes(keys, JOIN_LIMITS.IP)), keys, NOW);
  assert.strictEqual(d.blocked, true);
  if (d.blocked) assert.strictEqual(d.rule, 'IP');
});

test('checkJoinThrottle: old wrong codes age out of the window', async () => {
  const keys = joinThrottleKeys('user-1', '203.0.113.9');
  const d = await checkJoinThrottle(fakeDb(wrongCodes(keys, JOIN_LIMITS.ACCOUNT, JOIN_WINDOWS_MS.ACCOUNT + 1000)), keys, NOW);
  assert.strictEqual(d.blocked, false);
});

test('checkJoinThrottle: fails open when storage errors', async () => {
  const keys = joinThrottleKeys('user-1', '203.0.113.9');
  const broken = { loginThrottle: { count: async () => { throw new Error('down'); } } } as any;
  const d = await checkJoinThrottle(broken, keys, NOW);
  assert.strictEqual(d.blocked, false);
});

test('recordWrongCode: stores a JOIN row and reports each limit once when reached', async () => {
  const keys = joinThrottleKeys('user-1', '203.0.113.9');
  const db = fakeDb();
  const trips: string[] = [];
  await recordWrongCode(db, keys, { ACCOUNT: JOIN_LIMITS.ACCOUNT - 1, IP: 0 }, (r) => trips.push(r));
  assert.strictEqual(db.rows.length, 1);
  assert.strictEqual(db.rows[0].scope, JOIN_SCOPE);
  assert.deepStrictEqual(trips, ['ACCOUNT']);
  await recordWrongCode(db, keys, { ACCOUNT: JOIN_LIMITS.ACCOUNT, IP: 1 }, (r) => trips.push(r));
  assert.deepStrictEqual(trips, ['ACCOUNT']);
});

test('joinThrottledResponseParts and joinTripLogMessage: plain wording, no raw identifiers', () => {
  const parts = joinThrottledResponseParts(90);
  assert.match(parts.body.error, /wait 2 minutes/);
  assert.strictEqual(parts.headers['Retry-After'], '90');
  const keys = joinThrottleKeys('user-1', '203.0.113.9');
  const log = joinTripLogMessage(keys, 'IP');
  assert.match(log.message, /one network/);
  assert.ok(!JSON.stringify(log).includes('user-1') && !JSON.stringify(log).includes('203.0.113.9'));
});
