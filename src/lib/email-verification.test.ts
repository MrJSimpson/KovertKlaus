import test from 'node:test';
import assert from 'node:assert';
import type { PrismaClient } from '@prisma/client';
import {
  confirmEmailVerification,
  EMAIL_UNVERIFIED_CODE,
  isUnverified,
  isVerificationRequired,
  issueVerifyToken,
  readVerifyToken,
  requestVerificationResend,
  sendVerificationEmail,
  UNVERIFIED_ALLOWED_PATHS,
  VERIFY_INVALID_LINK_MESSAGE,
  VERIFY_LINK_TTL_MS,
  VERIFY_QUEUED_LINK_TTL_MS,
  VERIFY_QUEUED_MESSAGE,
  VERIFY_SENT_MESSAGE,
  type VerifyEmailDeps,
} from './email-verification';
import { issueResetToken } from './password-reset';

const MINUTE = 60 * 1000;

type Row = { scope: string; accountHash: string; ipHash: string; createdAt: Date };
type UserRow = { id: string; name: string; email: string; emailVerifiedAt: Date | null; isWorkshop: boolean; accountStatus: string };

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
      findUnique: async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null,
      updateMany: async ({ where, data }: { where: { id: string; emailVerifiedAt: null }; data: Partial<UserRow> }) => {
        const u = users.find((x) => x.id === where.id && x.emailVerifiedAt === where.emailVerifiedAt);
        if (!u) return { count: 0 };
        Object.assign(u, data);
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  return { db, adminDb, rows };
}

function setup(opts: { quotaReached?: boolean; verified?: boolean; workshop?: boolean; status?: string } = {}) {
  let clock = Date.UTC(2026, 10, 2, 18, 0, 0);
  const user: UserRow = {
    id: 'u1',
    name: 'Holly',
    email: 'holly@example.com',
    emailVerifiedAt: opts.verified ? new Date(clock - MINUTE) : null,
    isWorkshop: Boolean(opts.workshop),
    accountStatus: opts.status ?? 'ACTIVE',
  };
  const { db, adminDb, rows } = fakes([user], () => clock);
  const sent: { to: string; verifyUrl: string; expiresText: string }[] = [];
  const deps: VerifyEmailDeps = {
    db,
    adminDb,
    baseUrl: 'https://kovertklaus.test/',
    isQuotaReached: async () => Boolean(opts.quotaReached),
    sendEmail: async (email) => {
      sent.push(email);
      return { success: true, provider: 'console' };
    },
  };
  return { deps, db, user, rows, sent, now: () => clock, advance: (ms: number) => (clock += ms) };
}

/** The token inside an emailed link. */
function tokenOf(url: string): string {
  return decodeURIComponent(new URL(url).searchParams.get('token') || '');
}

test('Verification - required only when a real email provider is set up', () => {
  assert.strictEqual(isVerificationRequired('brevo'), true);
  assert.strictEqual(isVerificationRequired('smtp'), true);
  assert.strictEqual(isVerificationRequired('console'), false);
  assert.strictEqual(isVerificationRequired(''), false);
  assert.strictEqual(isVerificationRequired(undefined), false);
});

test('Verification - only a null emailVerifiedAt is unverified, and workshop accounts never are', () => {
  assert.strictEqual(isUnverified({ emailVerifiedAt: null }), true);
  assert.strictEqual(isUnverified({ emailVerifiedAt: new Date() }), false);
  assert.strictEqual(isUnverified({ emailVerifiedAt: '2026-11-01T00:00:00Z' }), false);
  assert.strictEqual(isUnverified({ emailVerifiedAt: null, isWorkshop: true }), false);
});

test('Verification - unverified agents may only reach /me and the verify routes', () => {
  assert.ok(UNVERIFIED_ALLOWED_PATHS.has('/api/users/me'));
  assert.ok(UNVERIFIED_ALLOWED_PATHS.has('/api/users/verify-email'));
  assert.ok(UNVERIFIED_ALLOWED_PATHS.has('/api/users/verify-email/confirm'));
  for (const p of ['/api/wishlist', '/api/operations', '/api/invitations/accept', '/api/messages', '/api/users/profile']) {
    assert.ok(!UNVERIFIED_ALLOWED_PATHS.has(p), p);
  }
  assert.strictEqual(EMAIL_UNVERIFIED_CODE, 'EMAIL_UNVERIFIED');
});

test('Verification - tokens round-trip, expire, and reject tampering and other link kinds', () => {
  const now = Date.UTC(2026, 10, 2);
  const token = issueVerifyToken('u1', 'Holly@Example.com', now + VERIFY_LINK_TTL_MS);
  assert.strictEqual(readVerifyToken(token, now)?.userId, 'u1');
  assert.strictEqual(readVerifyToken(token, now + VERIFY_LINK_TTL_MS), null, 'expired at the deadline');
  assert.strictEqual(readVerifyToken(token.slice(0, -2) + 'xx', now), null, 'tampered signature');
  assert.strictEqual(readVerifyToken('garbage', now), null);
  // A password reset link must never verify an email (different key and kind).
  assert.strictEqual(readVerifyToken(issueResetToken('u1', 'hash', now + MINUTE), now), null);
});

test('Verification - sign-up email carries a working link; a held email gets 48 hours', async () => {
  const t = setup();
  const r = await sendVerificationEmail(t.deps, t.user, t.now());
  assert.strictEqual(r.queued, false);
  assert.strictEqual(t.sent.length, 1);
  assert.ok(t.sent[0].verifyUrl.startsWith('https://kovertklaus.test/verify-email?token='), 'no double slash');
  assert.strictEqual(t.sent[0].expiresText, 'in 24 hours');
  assert.ok(readVerifyToken(tokenOf(t.sent[0].verifyUrl), t.now() + VERIFY_LINK_TTL_MS - 1));

  const q = setup({ quotaReached: true });
  assert.strictEqual((await sendVerificationEmail(q.deps, q.user, q.now())).queued, true);
  assert.strictEqual(q.sent[0].expiresText, 'in 48 hours');
  assert.ok(readVerifyToken(tokenOf(q.sent[0].verifyUrl), q.now() + VERIFY_QUEUED_LINK_TTL_MS - 1));
});

test('Verification - a failing send never throws (the agent can resend)', async () => {
  const t = setup();
  t.deps.sendEmail = async () => {
    throw new Error('provider down');
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.deepStrictEqual(await sendVerificationEmail(t.deps, t.user, t.now()), { queued: false });
  } finally {
    console.error = originalError;
  }
});

test('Verification - resend: cooldown, hourly cap, then allowed again', async () => {
  const t = setup();
  const first = await requestVerificationResend(t.deps, 'u1', t.now());
  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.body.message, VERIFY_SENT_MESSAGE);

  const tooSoon = await requestVerificationResend(t.deps, 'u1', t.now());
  assert.strictEqual(tooSoon.status, 429);
  assert.match(String(tooSoon.body.error), /just sent/);
  assert.ok(Number(tooSoon.headers?.['Retry-After']) > 0);

  for (let i = 0; i < 4; i++) {
    t.advance(3 * MINUTE);
    assert.strictEqual((await requestVerificationResend(t.deps, 'u1', t.now())).status, 200, `resend ${i + 2}`);
  }
  t.advance(3 * MINUTE);
  const capped = await requestVerificationResend(t.deps, 'u1', t.now());
  assert.strictEqual(capped.status, 429);
  assert.match(String(capped.body.error), /Too many/);
  assert.strictEqual(t.sent.length, 5);
  assert.ok(t.rows.every((r) => r.scope === 'VERIFY' && !r.accountHash.includes('u1')), 'keys are digests');

  t.advance(61 * MINUTE);
  assert.strictEqual((await requestVerificationResend(t.deps, 'u1', t.now())).status, 200);
});

test('Verification - resend tells a verified agent there is nothing to do, and refuses disabled accounts', async () => {
  const v = setup({ verified: true });
  const done = await requestVerificationResend(v.deps, 'u1', v.now());
  assert.strictEqual(done.body.alreadyVerified, true);
  assert.strictEqual(v.sent.length, 0);

  const w = setup({ workshop: true });
  assert.strictEqual((await requestVerificationResend(w.deps, 'u1', w.now())).body.alreadyVerified, true);

  const d = setup({ status: 'DISABLED' });
  assert.strictEqual((await requestVerificationResend(d.deps, 'u1', d.now())).status, 401);
  assert.strictEqual((await requestVerificationResend(d.deps, 'nobody', d.now())).status, 401);
});

test('Verification - resend while the quota is used up says the email arrives tomorrow', async () => {
  const t = setup({ quotaReached: true });
  const r = await requestVerificationResend(t.deps, 'u1', t.now());
  assert.strictEqual(r.body.queued, true);
  assert.strictEqual(r.body.message, VERIFY_QUEUED_MESSAGE);
});

test('Verification - confirm marks the email verified once and sends the welcome email once', async () => {
  const t = setup();
  await sendVerificationEmail(t.deps, t.user, t.now());
  const token = tokenOf(t.sent[0].verifyUrl);
  const welcomed: string[] = [];
  const deps = { db: t.db, sendWelcome: async (u: { email: string }) => welcomed.push(u.email) };

  t.advance(10 * MINUTE);
  const ok = await confirmEmailVerification(deps, { token }, t.now());
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(t.user.emailVerifiedAt?.getTime(), t.now());
  assert.deepStrictEqual(welcomed, ['holly@example.com']);

  const again = await confirmEmailVerification(deps, { token }, t.now());
  assert.strictEqual(again.status, 200);
  assert.strictEqual(again.body.alreadyVerified, true);
  assert.strictEqual(welcomed.length, 1, 'no second welcome');
});

test('Verification - confirm rejects expired, forged and wrong-address links', async () => {
  const t = setup();
  const deps = { db: t.db };
  const expired = issueVerifyToken('u1', t.user.email, t.now() - 1);
  assert.deepStrictEqual((await confirmEmailVerification(deps, { token: expired }, t.now())).body, { error: VERIFY_INVALID_LINK_MESSAGE });
  assert.strictEqual((await confirmEmailVerification(deps, { token: 'nope' }, t.now())).status, 400);
  assert.strictEqual((await confirmEmailVerification(deps, { token: 42 }, t.now())).status, 400);

  // A link for another address (e.g. the account's email changed) does not verify this one.
  const other = issueVerifyToken('u1', 'someone-else@example.com', t.now() + VERIFY_LINK_TTL_MS);
  assert.strictEqual((await confirmEmailVerification(deps, { token: other }, t.now())).status, 400);
  assert.strictEqual(t.user.emailVerifiedAt, null);

  // The address fingerprint ignores case and surrounding spaces.
  const cased = issueVerifyToken('u1', '  HOLLY@example.com ', t.now() + VERIFY_LINK_TTL_MS);
  assert.strictEqual((await confirmEmailVerification(deps, { token: cased }, t.now())).status, 200);
});

test('Verification - confirm refuses a disabled account', async () => {
  const t = setup({ status: 'DISABLED' });
  const token = issueVerifyToken('u1', t.user.email, t.now() + VERIFY_LINK_TTL_MS);
  assert.strictEqual((await confirmEmailVerification({ db: t.db }, { token }, t.now())).status, 400);
  assert.strictEqual(t.user.emailVerifiedAt, null);
});
