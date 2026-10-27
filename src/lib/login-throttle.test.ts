/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import {
  checkLoginThrottle,
  clearLoginFailures,
  clientIp,
  LOGIN_LIMITS,
  loginThrottleKeys,
  LONG_WINDOW_MS,
  purgeLoginThrottle,
  recordLoginFailure,
  SHORT_WINDOW_MS,
  THROTTLE_RETENTION_MS,
  throttledResponseParts,
  tripLogMessage,
  UNKNOWN_IP,
  type ThrottleRule,
} from './login-throttle';

const NOW = Date.parse('2026-10-27T18:00:00.000Z');
const MIN = 60 * 1000;

/** Fake Prisma client holding `LoginThrottle` rows in memory (supports the `gt`/`lt` filters used). */
function fakeDb(rows: any[] = [], opts: { failCount?: boolean } = {}) {
  const matches = (r: any, where: any = {}) =>
    Object.entries(where).every(([k, v]: [string, any]) => {
      if (v && typeof v === 'object' && 'gt' in v) return r[k] > v.gt;
      if (v && typeof v === 'object' && 'lt' in v) return r[k] < v.lt;
      return r[k] === v;
    });
  const db = {
    loginThrottle: {
      count: async ({ where }: any) => {
        if (opts.failCount) throw new Error('relation "LoginThrottle" does not exist');
        return rows.filter((r) => matches(r, where)).length;
      },
      findFirst: async ({ where }: any) => rows.filter((r) => matches(r, where)).sort((a, b) => a.createdAt - b.createdAt)[0] ?? null,
      create: async ({ data }: any) => {
        rows.push({ id: `t${rows.length}`, createdAt: new Date(NOW), ...data });
        return {};
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

/** `n` failures for these keys, `agoMs` before NOW. */
function failures(keys: { scope: string; accountHash: string; ipHash: string }, n: number, agoMs: number) {
  return Array.from({ length: n }, () => ({ scope: keys.scope, accountHash: keys.accountHash, ipHash: keys.ipHash, createdAt: new Date(NOW - agoMs) }));
}

test('Login throttle - keys are digests, stable, case-insensitive and scoped', () => {
  const a = loginThrottleKeys('USER', ' Ivy@X.com ', '203.0.113.5');
  const b = loginThrottleKeys('USER', 'ivy@x.com', '203.0.113.5');
  assert.deepStrictEqual(a, b);
  assert.match(a.accountHash, /^[0-9a-f]{32}$/);
  assert.ok(!a.accountHash.includes('ivy'));
  assert.notStrictEqual(loginThrottleKeys('ADMIN', 'ivy@x.com', '203.0.113.5').accountHash, a.accountHash);
  assert.strictEqual(a.ipKnown, true);
  assert.strictEqual(loginThrottleKeys('USER', 'ivy@x.com', UNKNOWN_IP).ipKnown, false);
});

test('Login throttle - client IP prefers Cloudflare, then the first forwarded address', () => {
  assert.strictEqual(clientIp(new Headers({ 'cf-connecting-ip': '198.51.100.1', 'x-forwarded-for': '10.0.0.1' })), '198.51.100.1');
  assert.strictEqual(clientIp(new Headers({ 'x-forwarded-for': ' 203.0.113.9 , 10.0.0.1' })), '203.0.113.9');
  assert.strictEqual(clientIp(new Headers({ 'x-real-ip': '192.0.2.4' })), '192.0.2.4');
  assert.strictEqual(clientIp(new Headers()), UNKNOWN_IP);
});

test('Login throttle - account + IP: the 6th agent attempt in 15 minutes waits; the North Pole allows 3', async () => {
  const user = loginThrottleKeys('USER', 'ivy@x.com', '203.0.113.5');
  assert.strictEqual((await checkLoginThrottle(fakeDb(failures(user, LOGIN_LIMITS.USER.ACCOUNT_IP - 1, MIN)).db, user, NOW)).blocked, false);
  const blocked = await checkLoginThrottle(fakeDb(failures(user, LOGIN_LIMITS.USER.ACCOUNT_IP, 5 * MIN)).db, user, NOW);
  assert.deepStrictEqual(blocked, { blocked: true, rule: 'ACCOUNT_IP', retryAfterSec: (SHORT_WINDOW_MS - 5 * MIN) / 1000 });
  // Failures older than the window no longer count.
  assert.strictEqual((await checkLoginThrottle(fakeDb(failures(user, 10, SHORT_WINDOW_MS + MIN)).db, user, NOW)).blocked, false);

  const admin = loginThrottleKeys('ADMIN', 'santa', '203.0.113.5');
  assert.strictEqual(LOGIN_LIMITS.ADMIN.ACCOUNT_IP, 3);
  assert.strictEqual((await checkLoginThrottle(fakeDb(failures(admin, 3, MIN)).db, admin, NOW)).blocked, true);
});

test('Login throttle - one IP guessing across many accounts is limited', async () => {
  const rows = Array.from({ length: LOGIN_LIMITS.USER.IP }, (_, i) => failures(loginThrottleKeys('USER', `agent${i}@x.com`, '203.0.113.5'), 1, MIN)).flat();
  const fresh = loginThrottleKeys('USER', 'new@x.com', '203.0.113.5');
  const result = await checkLoginThrottle(fakeDb(rows).db, fresh, NOW);
  assert.strictEqual(result.blocked && result.rule, 'IP');
  // Another IP is unaffected.
  assert.strictEqual((await checkLoginThrottle(fakeDb(rows).db, loginThrottleKeys('USER', 'new@x.com', '198.51.100.7'), NOW)).blocked, false);
});

test('Login throttle - one account guessed from many IPs is limited over an hour, without a hard lockout', async () => {
  const rows = Array.from({ length: LOGIN_LIMITS.USER.ACCOUNT }, (_, i) => failures(loginThrottleKeys('USER', 'ivy@x.com', `203.0.113.${i}`), 1, 30 * MIN)).flat();
  const result = await checkLoginThrottle(fakeDb(rows).db, loginThrottleKeys('USER', 'ivy@x.com', '198.51.100.7'), NOW);
  assert.deepStrictEqual(result, { blocked: true, rule: 'ACCOUNT', retryAfterSec: (LONG_WINDOW_MS - 30 * MIN) / 1000 });
  // 4 wrong guesses from a stranger's IP do not block the owner on theirs.
  const stranger = failures(loginThrottleKeys('USER', 'ivy@x.com', '203.0.113.66'), 4, MIN);
  assert.strictEqual((await checkLoginThrottle(fakeDb(stranger).db, loginThrottleKeys('USER', 'ivy@x.com', '198.51.100.7'), NOW)).blocked, false);
});

test('Login throttle - an unknown IP skips the IP rule so self-hosted agents do not share one counter', async () => {
  const rows = Array.from({ length: 30 }, (_, i) => failures(loginThrottleKeys('USER', `agent${i}@x.com`, UNKNOWN_IP), 1, MIN)).flat();
  assert.strictEqual((await checkLoginThrottle(fakeDb(rows).db, loginThrottleKeys('USER', 'new@x.com', UNKNOWN_IP), NOW)).blocked, false);
});

test('Login throttle - a failed table read lets the attempt through', async () => {
  const keys = loginThrottleKeys('USER', 'ivy@x.com', '203.0.113.5');
  const result = await checkLoginThrottle(fakeDb([], { failCount: true }).db, keys, NOW);
  assert.strictEqual(result.blocked, false);
});

test('Login throttle - recording logs once per tripped limit; success clears only that account + IP', async () => {
  const keys = loginThrottleKeys('USER', 'ivy@x.com', '203.0.113.5');
  const f = fakeDb();
  const trips: ThrottleRule[] = [];
  for (let i = 0; i < 7; i++) {
    const decision = await checkLoginThrottle(f.db, keys, NOW + 1);
    if (decision.blocked) break;
    await recordLoginFailure(f.db, keys, decision.counts, (rule) => trips.push(rule));
  }
  assert.strictEqual(f.rows.length, LOGIN_LIMITS.USER.ACCOUNT_IP);
  assert.deepStrictEqual(trips, ['ACCOUNT_IP']);

  const otherIp = loginThrottleKeys('USER', 'ivy@x.com', '198.51.100.7');
  f.rows.push(...failures(otherIp, 2, MIN));
  await clearLoginFailures(f.db, keys);
  assert.strictEqual(f.rows.length, 2);
  assert.ok(f.rows.every((r) => r.ipHash === otherIp.ipHash));
});

test('Login throttle - purge drops rows older than a day', async () => {
  const keys = loginThrottleKeys('USER', 'ivy@x.com', '203.0.113.5');
  const f = fakeDb([...failures(keys, 2, THROTTLE_RETENTION_MS + MIN), ...failures(keys, 1, MIN)]);
  assert.strictEqual(await purgeLoginThrottle(f.db, NOW), 2);
  assert.strictEqual(f.rows.length, 1);
});

test('Login throttle - the 429 says how long to wait; the log line holds hash prefixes only', () => {
  assert.deepStrictEqual(throttledResponseParts(61), {
    body: { error: 'Too many sign-in attempts. Please wait 2 minutes and try again.', retryAfterSec: 61 },
    headers: { 'Retry-After': '61' },
  });
  assert.match(throttledResponseParts(30).body.error, /wait 1 minute and/);
  const keys = loginThrottleKeys('ADMIN', 'santa', '203.0.113.5');
  const line = tripLogMessage(keys, 'ACCOUNT_IP');
  assert.match(line.message, /^North Pole sign-in limit reached: one account from one IP \(3 failures\)\.$/);
  assert.strictEqual(line.metadata.account, keys.accountHash.slice(0, 8));
  assert.ok(!JSON.stringify(line).includes('santa') && !JSON.stringify(line).includes('203.0.113.5'));
});
