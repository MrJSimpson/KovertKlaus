import test from 'node:test';
import assert from 'node:assert';
import type { PrismaClient } from '@prisma/client';
import {
  confirmPasswordReset,
  issueResetToken,
  readResetToken,
  requestPasswordReset,
  resetLinkExpiry,
  RESET_INVALID_LINK_MESSAGE,
  RESET_LINK_TTL_MS,
  RESET_QUEUED_MESSAGE,
  RESET_SENT_MESSAGE,
  type ResetRequestDeps,
} from './password-reset';
import { quotaDayStart } from './email/daily-limit';
import { comparePassword, hashPassword } from './password';

const NEW_PASSWORD = ['Snow', 'Fall', '#2026', 'x'].join('');

type Row = { scope: string; accountHash: string; ipHash: string; createdAt: Date };
type UserRow = { id: string; name: string; email: string; passwordHash: string; accountStatus: string; sessionsRevokedAt: Date | null };

/** In-memory stand-ins for the two Prisma clients, covering only what the module calls. */
function fakes(users: UserRow[], now: () => number) {
  const rows: Row[] = [];
  const matches = (r: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) =>
      k === 'createdAt' ? r.createdAt.getTime() > (v as { gt: Date }).gt.getTime() : (r as unknown as Record<string, unknown>)[k] === v
    );
  const adminDb = {
    loginThrottle: {
      count: async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => matches(r, where)).length,
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => matches(r, where)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null,
      create: async ({ data }: { data: Omit<Row, 'createdAt'> }) => {
        rows.push({ ...data, createdAt: new Date(now()) });
        return data;
      },
    },
  } as unknown as PrismaClient;
  const db = {
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        users.find((u) => (where.email ? u.email === where.email : u.id === where.id)) ?? null,
      updateMany: async ({ where, data }: { where: { id: string; passwordHash: string }; data: Partial<UserRow> }) => {
        const u = users.find((x) => x.id === where.id && x.passwordHash === where.passwordHash);
        if (!u) return { count: 0 };
        Object.assign(u, data);
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  return { db, adminDb, rows };
}

async function setup(opts: { quotaReached?: boolean; status?: string } = {}) {
  let clock = Date.UTC(2026, 10, 2, 18, 0, 0); // 2 Nov 2026, 10:00 Pacific
  const user: UserRow = {
    id: 'u1',
    name: 'Holly <b>',
    email: 'holly@example.com',
    passwordHash: await hashPassword(['Old', 'Pass', '#1234'].join('')),
    accountStatus: opts.status ?? 'ACTIVE',
    sessionsRevokedAt: null,
  };
  const { db, adminDb, rows } = fakes([user], () => clock);
  const sent: { to: string; resetUrl: string; expiresText: string }[] = [];
  const deps: ResetRequestDeps = {
    db,
    adminDb,
    baseUrl: 'https://kovertklaus.test/',
    isQuotaReached: async () => Boolean(opts.quotaReached),
    sendEmail: async (email) => {
      sent.push(email);
      return { success: true, provider: 'console' };
    },
  };
  return { deps, db, user, sent, rows, now: () => clock, advance: (ms: number) => { clock += ms; } };
}

const tokenOf = (url: string) => decodeURIComponent(new URL(url).searchParams.get('token') || '');

test('Password reset - a known email gets a 30-minute link at the configured site', async () => {
  const t = await setup();
  const res = await requestPasswordReset(t.deps, { email: ' Holly@Example.com ', ip: '1.2.3.4' }, t.now());
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.message, RESET_SENT_MESSAGE);
  assert.strictEqual(t.sent.length, 1);
  assert.ok(t.sent[0].resetUrl.startsWith('https://kovertklaus.test/reset-password?token='));
  assert.strictEqual(t.sent[0].expiresText, 'in 30 minutes');
  const claims = readResetToken(tokenOf(t.sent[0].resetUrl), t.now());
  assert.strictEqual(claims?.userId, 'u1');
  assert.strictEqual(claims?.expiresAtMs, t.now() + RESET_LINK_TTL_MS);
});

test('Password reset - an unknown email gets the same reply and no email', async () => {
  const t = await setup();
  const res = await requestPasswordReset(t.deps, { email: 'nobody@example.com', ip: '1.2.3.4' }, t.now());
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.message, RESET_SENT_MESSAGE);
  assert.strictEqual(t.sent.length, 0);
});

test('Password reset - a disabled account gets the same reply and no email', async () => {
  const t = await setup({ status: 'DISABLED' });
  const res = await requestPasswordReset(t.deps, { email: 'holly@example.com', ip: '1.2.3.4' }, t.now());
  assert.strictEqual(res.status, 200);
  assert.strictEqual(t.sent.length, 0);
});

test('Password reset - a malformed email is refused', async () => {
  const t = await setup();
  assert.strictEqual((await requestPasswordReset(t.deps, { email: 'not-an-email', ip: '1.2.3.4' }, t.now())).status, 400);
  assert.strictEqual((await requestPasswordReset(t.deps, { email: 42, ip: '1.2.3.4' }, t.now())).status, 400);
});

test('Password reset - one email per address every 5 minutes, unknown addresses included', async () => {
  for (const email of ['holly@example.com', 'nobody@example.com']) {
    const t = await setup();
    assert.strictEqual((await requestPasswordReset(t.deps, { email, ip: '1.2.3.4' }, t.now())).status, 200);
    t.advance(60 * 1000);
    const blocked = await requestPasswordReset(t.deps, { email, ip: '5.6.7.8' }, t.now());
    assert.strictEqual(blocked.status, 429);
    assert.match(String(blocked.body.error), /request another in 4 minutes/);
    assert.strictEqual(blocked.headers?.['Retry-After'], '240');
    t.advance(4 * 60 * 1000 + 1000);
    assert.strictEqual((await requestPasswordReset(t.deps, { email, ip: '1.2.3.4' }, t.now())).status, 200);
  }
});

test('Password reset - at most 3 emails per address an hour', async () => {
  const t = await setup();
  for (let i = 0; i < 3; i++) {
    assert.strictEqual((await requestPasswordReset(t.deps, { email: 'holly@example.com', ip: '1.2.3.4' }, t.now())).status, 200);
    t.advance(6 * 60 * 1000);
  }
  const blocked = await requestPasswordReset(t.deps, { email: 'holly@example.com', ip: '1.2.3.4' }, t.now());
  assert.strictEqual(blocked.status, 429);
  assert.match(String(blocked.body.error), /Too many reset requests/);
  assert.strictEqual(t.sent.length, 3);
});

test('Password reset - at most 10 requests an hour from one IP', async () => {
  const t = await setup();
  const trips: string[] = [];
  t.deps.onTrip = (message) => trips.push(message);
  for (let i = 0; i < 10; i++) {
    assert.strictEqual((await requestPasswordReset(t.deps, { email: `agent${i}@example.com`, ip: '9.9.9.9' }, t.now())).status, 200);
  }
  assert.strictEqual((await requestPasswordReset(t.deps, { email: 'agent99@example.com', ip: '9.9.9.9' }, t.now())).status, 429);
  assert.strictEqual(trips.length, 1);
  // An unknown IP (self-hosted, no proxy header) skips the IP rule.
  assert.strictEqual((await requestPasswordReset(t.deps, { email: 'agent98@example.com', ip: 'unknown' }, t.now())).status, 200);
});

test('Password reset - over the email quota: same queued reply for every address, link lasts until noon Pacific', async () => {
  const t = await setup({ quotaReached: true });
  const known = await requestPasswordReset(t.deps, { email: 'holly@example.com', ip: '1.2.3.4' }, t.now());
  const unknown = await requestPasswordReset(t.deps, { email: 'nobody@example.com', ip: '1.2.3.4' }, t.now());
  assert.deepStrictEqual(known.body, { success: true, queued: true, message: RESET_QUEUED_MESSAGE });
  assert.deepStrictEqual(unknown.body, known.body);
  assert.strictEqual(t.sent[0].expiresText, 'at noon Pacific time today');
  const claims = readResetToken(tokenOf(t.sent[0].resetUrl), t.now());
  const nextNoon = quotaDayStart(new Date(t.now() + 24 * 3600 * 1000)).getTime() + 12 * 3600 * 1000;
  assert.strictEqual(claims?.expiresAtMs, nextNoon);
  assert.strictEqual(nextNoon, Date.UTC(2026, 10, 3, 20, 0, 0)); // noon PST on 3 Nov
});

test('Password reset - queued link expiry is noon Pacific across daylight-saving changes', () => {
  // 31 Oct 2026, 23:30 PDT -> next quota day 1 Nov (DST ends that morning) -> noon PST.
  const late = Date.UTC(2026, 10, 1, 6, 30, 0);
  assert.strictEqual(resetLinkExpiry(true, late), Date.UTC(2026, 10, 1, 20, 0, 0));
});

test('Password reset - the link sets the new password once and signs the agent out everywhere', async () => {
  const t = await setup();
  await requestPasswordReset(t.deps, { email: 'holly@example.com', ip: '1.2.3.4' }, t.now());
  const token = tokenOf(t.sent[0].resetUrl);

  const ok = await confirmPasswordReset(t.db, { token, password: NEW_PASSWORD }, t.now());
  assert.strictEqual(ok.status, 200);
  assert.ok(await comparePassword(NEW_PASSWORD, t.user.passwordHash));
  assert.strictEqual(t.user.sessionsRevokedAt?.getTime(), t.now());

  const again = await confirmPasswordReset(t.db, { token, password: NEW_PASSWORD + '!' }, t.now());
  assert.strictEqual(again.status, 400);
  assert.strictEqual(again.body.error, RESET_INVALID_LINK_MESSAGE);
});

test('Password reset - an earlier link stops working once any link is used', async () => {
  const t = await setup();
  await requestPasswordReset(t.deps, { email: 'holly@example.com', ip: '1.2.3.4' }, t.now());
  t.advance(6 * 60 * 1000);
  await requestPasswordReset(t.deps, { email: 'holly@example.com', ip: '1.2.3.4' }, t.now());
  const [first, second] = t.sent.map((s) => tokenOf(s.resetUrl));
  assert.strictEqual((await confirmPasswordReset(t.db, { token: second, password: NEW_PASSWORD }, t.now())).status, 200);
  assert.strictEqual((await confirmPasswordReset(t.db, { token: first, password: NEW_PASSWORD }, t.now())).status, 400);
});

test('Password reset - expired, forged and malformed links are refused', async () => {
  const t = await setup();
  const expired = issueResetToken('u1', t.user.passwordHash, t.now() - 1);
  assert.strictEqual((await confirmPasswordReset(t.db, { token: expired, password: NEW_PASSWORD }, t.now())).status, 400);

  const valid = issueResetToken('u1', t.user.passwordHash, t.now() + 60_000);
  const forged = valid.replace('pwreset:u1:', 'pwreset:u2:');
  assert.strictEqual((await confirmPasswordReset(t.db, { token: forged, password: NEW_PASSWORD }, t.now())).status, 400);
  assert.strictEqual((await confirmPasswordReset(t.db, { token: 'garbage', password: NEW_PASSWORD }, t.now())).status, 400);
  assert.strictEqual((await confirmPasswordReset(t.db, { token: undefined, password: NEW_PASSWORD }, t.now())).status, 400);
});

test('Password reset - the new password must meet the complexity rules', async () => {
  const t = await setup();
  const token = issueResetToken('u1', t.user.passwordHash, t.now() + 60_000);
  const weak = await confirmPasswordReset(t.db, { token, password: 'short' }, t.now());
  assert.strictEqual(weak.status, 400);
  assert.match(String(weak.body.error), /at least 10 characters/);
});
