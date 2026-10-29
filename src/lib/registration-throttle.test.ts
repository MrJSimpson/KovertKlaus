/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import { UNKNOWN_IP } from './login-throttle';
import {
  checkRegistrationThrottle,
  recordRegistration,
  REGISTER_SCOPE,
  REGISTRATION_LIMITS,
  registrationThrottledParts,
  registrationThrottleKeys,
  registrationTripLogMessage,
  type RegistrationRule,
} from './registration-throttle';

const NOW = Date.parse('2026-10-29T18:00:00.000Z');
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** Fake Prisma client holding `LoginThrottle` rows in memory (supports the `gt` filter used). */
function fakeDb(rows: any[] = [], opts: { failCount?: boolean } = {}) {
  const matches = (r: any, where: any = {}) =>
    Object.entries(where).every(([k, v]: [string, any]) => (v && typeof v === 'object' && 'gt' in v ? r[k] > v.gt : r[k] === v));
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
    },
  };
  return { db: db as any, rows };
}

/** `n` sign-ups from this IP, `agoMs` before NOW, each with its own email. */
function signups(ip: string, n: number, agoMs: number, scope = REGISTER_SCOPE) {
  return Array.from({ length: n }, (_, i) => {
    const keys = registrationThrottleKeys(`agent${i}-${ip}@x.com`, ip, false);
    return { scope, accountHash: keys.accountHash, ipHash: keys.ipHash, createdAt: new Date(NOW - agoMs) };
  });
}

const IP = '203.0.113.5';

test('Registration throttle - keys are digests and differ from sign-in keys', () => {
  const keys = registrationThrottleKeys(' Ivy@X.com ', IP, false);
  assert.match(keys.ipHash, /^[0-9a-f]{32}$/);
  assert.deepStrictEqual(keys, registrationThrottleKeys('ivy@x.com', IP, false));
  assert.ok(!JSON.stringify(keys).includes('ivy') && !JSON.stringify(keys).includes(IP));
  assert.strictEqual(registrationThrottleKeys('ivy@x.com', UNKNOWN_IP, false).ipKnown, false);
});

test('Registration throttle - the 4th sign-up from one IP in an hour waits until the oldest ages out', async () => {
  const keys = registrationThrottleKeys('new@x.com', IP, false);
  assert.strictEqual((await checkRegistrationThrottle(fakeDb(signups(IP, 2, 10 * MIN)).db, keys, NOW)).blocked, false);
  const blocked = await checkRegistrationThrottle(fakeDb(signups(IP, REGISTRATION_LIMITS.IP_HOUR, 10 * MIN)).db, keys, NOW);
  assert.deepStrictEqual(blocked, { blocked: true, rule: 'IP_HOUR', retryAfterSec: (HOUR - 10 * MIN) / 1000 });
  // Another IP is unaffected.
  assert.strictEqual((await checkRegistrationThrottle(fakeDb(signups(IP, 3, 10 * MIN)).db, registrationThrottleKeys('new@x.com', '198.51.100.7', false), NOW)).blocked, false);
});

test('Registration throttle - the 11th sign-up from one IP in a day waits, even spread over hours', async () => {
  const rows = [...signups(IP, 5, 20 * HOUR), ...signups(IP, 5, 5 * HOUR)];
  const result = await checkRegistrationThrottle(fakeDb(rows).db, registrationThrottleKeys('new@x.com', IP, false), NOW);
  assert.deepStrictEqual(result, { blocked: true, rule: 'IP_DAY', retryAfterSec: 4 * HOUR / 1000 });
});

test('Registration throttle - the site-wide ceiling blocks walk-in sign-ups but not mission invites', async () => {
  // 200 sign-ups from 100 IPs, two each: no IP rule trips.
  const rows = Array.from({ length: REGISTRATION_LIMITS.SITE_DAY / 2 }, (_, i) => signups(`198.51.100.${i}`, 2, 3 * HOUR)).flat();
  const walkIn = await checkRegistrationThrottle(fakeDb(rows).db, registrationThrottleKeys('new@x.com', IP, false), NOW);
  assert.strictEqual(walkIn.blocked && walkIn.rule, 'SITE_DAY');
  const invited = await checkRegistrationThrottle(fakeDb(rows).db, registrationThrottleKeys('new@x.com', IP, true), NOW);
  assert.strictEqual(invited.blocked, false);
});

test('Registration throttle - a mission invite skips the hourly IP rule (one home network) but not the daily one', async () => {
  const family = await checkRegistrationThrottle(fakeDb(signups(IP, 3, MIN)).db, registrationThrottleKeys('new@x.com', IP, true), NOW);
  assert.strictEqual(family.blocked, false);
  const farmed = await checkRegistrationThrottle(fakeDb(signups(IP, REGISTRATION_LIMITS.IP_DAY, MIN)).db, registrationThrottleKeys('new@x.com', IP, true), NOW);
  assert.strictEqual(farmed.blocked && farmed.rule, 'IP_DAY');
});

test('Registration throttle - sign-in failures do not count; an unknown IP skips the IP rules', async () => {
  const loginRows = signups(IP, 30, MIN, 'USER');
  assert.strictEqual((await checkRegistrationThrottle(fakeDb(loginRows).db, registrationThrottleKeys('new@x.com', IP, false), NOW)).blocked, false);
  const selfHosted = signups(UNKNOWN_IP, 20, MIN);
  assert.strictEqual((await checkRegistrationThrottle(fakeDb(selfHosted).db, registrationThrottleKeys('new@x.com', UNKNOWN_IP, false), NOW)).blocked, false);
});

test('Registration throttle - a failed table read lets the sign-up through', async () => {
  const result = await checkRegistrationThrottle(fakeDb([], { failCount: true }).db, registrationThrottleKeys('new@x.com', IP, false), NOW);
  assert.strictEqual(result.blocked, false);
});

test('Registration throttle - recording logs once when a limit is reached', async () => {
  const f = fakeDb();
  const trips: RegistrationRule[] = [];
  for (let i = 0; i < 5; i++) {
    const keys = registrationThrottleKeys(`agent${i}@x.com`, IP, false);
    const decision = await checkRegistrationThrottle(f.db, keys, NOW + 1);
    if (decision.blocked) break;
    await recordRegistration(f.db, keys, decision.counts, (rule) => trips.push(rule));
  }
  assert.strictEqual(f.rows.length, REGISTRATION_LIMITS.IP_HOUR);
  assert.ok(f.rows.every((r) => r.scope === REGISTER_SCOPE));
  assert.deepStrictEqual(trips, ['IP_HOUR']);
});

test('Registration throttle - the 429 explains which limit; the log line holds a hash prefix only', () => {
  assert.deepStrictEqual(registrationThrottledParts('IP_HOUR', 120).headers, { 'Retry-After': '120' });
  assert.match(registrationThrottledParts('IP_DAY', 120).body.error, /from this network/);
  assert.match(registrationThrottledParts('SITE_DAY', 120).body.error, /mission invite link/);
  const keys = registrationThrottleKeys('ivy@x.com', IP, false);
  const line = registrationTripLogMessage(keys, 'SITE_DAY');
  assert.strictEqual(line.message, 'Registration limit reached: the whole site in a day (200 sign-ups).');
  assert.ok(!JSON.stringify(line).includes('ivy') && !JSON.stringify(line).includes(IP));
});
