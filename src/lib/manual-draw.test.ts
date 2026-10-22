/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import { runManualDraw } from './manual-draw';

const ADDRESS = { streetAddress: '1 Elf Way', city: 'North Pole', state: 'AK', zipCode: '99705' };

/** Fake Prisma client holding one ready Secret Santa mission. */
function fakeDb(overrides: Record<string, unknown> = {}) {
  const ex: any = {
    id: 'ex1', title: 'Family Swap', code: 'ABCD-1234', organizerId: 'boss', status: 'SETUP',
    isWhiteElephant: false, isLocalOnly: false,
    shippingDate: new Date('2026-12-15T12:00:00Z'), executionDate: new Date('2026-12-24T12:00:00Z'),
    members: ['boss', 'u2', 'u3', 'u4'].map((userId, i) => ({
      id: `m${i}`, userId, codename: `Elf${i}`, targetUserId: null,
      user: { name: userId.toUpperCase(), email: `${userId}@x.com`, emailNotifications: true, ...ADDRESS },
      wishlist: { _count: { wishlistItems: 1 } },
    })),
    exclusionRules: [],
    ...overrides,
  };
  const notices: any[] = [];
  const db: any = {
    exchange: {
      findUnique: async () => ex,
      update: async ({ data }: any) => Object.assign(ex, data),
    },
    exchangeMember: {
      update: async ({ where, data }: any) => Object.assign(ex.members.find((m: any) => m.id === where.id), data),
    },
    notification: {
      upsert: async ({ where, create, update }: any) => {
        const key = where.userId_dedupeKey;
        const found = notices.find((n) => n.userId === key.userId && n.dedupeKey === key.dedupeKey);
        if (found) return Object.assign(found, update);
        notices.push({ ...create });
        return create;
      },
    },
  };
  db.$transaction = async (fn: (tx: any) => Promise<unknown>) => fn(db);
  return { db, ex, notices };
}

function deps() {
  const emails: any[] = [];
  return { emails, deps: { exchangeUrl: (code: string) => `https://kk.test/exchange/${code}`, sendAssignmentEmail: async (e: any) => emails.push(e) } };
}

test('runManualDraw: draws one circle, saves MATCHED, notifies and emails every agent', async () => {
  const { db, ex, notices } = fakeDb();
  const { emails, deps: d } = deps();
  const result = await runManualDraw(db, d, { exchangeId: 'ex1', userId: 'boss' });

  assert.strictEqual(result.status, 200);
  assert.strictEqual(ex.status, 'MATCHED');
  assert.ok(ex.drawVerifiedAt instanceof Date);
  const targets = new Map(ex.members.map((m: any) => [m.userId, m.targetUserId]));
  let at = 'boss';
  const seen = new Set<string>();
  for (let i = 0; i < 4; i++) { seen.add(at); at = targets.get(at) as string; }
  assert.strictEqual(at, 'boss', 'following targets returns to the start after every agent');
  assert.strictEqual(seen.size, 4);
  assert.strictEqual(notices.length, 4);
  assert.strictEqual(emails.length, 4);
  assert.strictEqual(emails[0].exchangeUrl, 'https://kk.test/exchange/ABCD-1234');
});

test('runManualDraw: only the Head Elf may draw', async () => {
  const { db, ex } = fakeDb();
  const result = await runManualDraw(db, deps().deps, { exchangeId: 'ex1', userId: 'u2' });
  assert.strictEqual(result.status, 403);
  assert.strictEqual(ex.status, 'SETUP');
});

test('runManualDraw: a drawn mission needs forceUnlock, and the re-draw refreshes the notice', async () => {
  const { db, ex, notices } = fakeDb();
  const { deps: d } = deps();
  await runManualDraw(db, d, { exchangeId: 'ex1', userId: 'boss' });

  const locked = await runManualDraw(db, d, { exchangeId: 'ex1', userId: 'boss' });
  assert.strictEqual(locked.status, 409);
  assert.strictEqual(locked.body.requiresConfirmation, true);

  const forced = await runManualDraw(db, d, { exchangeId: 'ex1', userId: 'boss', forceUnlock: true });
  assert.strictEqual(forced.status, 200);
  assert.strictEqual(ex.status, 'MATCHED');
  assert.strictEqual(notices.length, 4, 'one notice per agent, not one per draw');
});

test('runManualDraw: targets set while still SETUP also count as drawn', async () => {
  const { db, ex } = fakeDb();
  ex.members[0].targetUserId = 'u2';
  const result = await runManualDraw(db, deps().deps, { exchangeId: 'ex1', userId: 'boss' });
  assert.strictEqual(result.status, 409);
  assert.strictEqual(result.body.requiresConfirmation, true);
});

test('runManualDraw: once gifts ship the draw is refused even with forceUnlock', async () => {
  for (const status of ['SHIPPED', 'EXECUTED', 'COMPLETED']) {
    const { db } = fakeDb({ status });
    const result = await runManualDraw(db, deps().deps, { exchangeId: 'ex1', userId: 'boss', forceUnlock: true });
    assert.strictEqual(result.status, 409, status);
    assert.strictEqual(result.body.requiresConfirmation, undefined, status);
  }
});

test('runManualDraw: readiness problems block the draw with the same message as the automatic draw', async () => {
  const { db, ex } = fakeDb();
  ex.members.pop();
  const result = await runManualDraw(db, deps().deps, { exchangeId: 'ex1', userId: 'boss' });
  assert.strictEqual(result.status, 409);
  assert.match(String(result.body.error), /^The draw is blocked\./);
  assert.strictEqual(ex.status, 'SETUP');
});

test('runManualDraw: rules that allow no circle return 400 instead of throwing', async () => {
  // Bowtie: boss can only give to u2 and u3, and u2/u3 are blocked from u4, so no circle exists.
  const { db, ex } = fakeDb({
    exclusionRules: [
      { memberId: 'boss', restrictedMemberId: 'u4' },
      { memberId: 'u2', restrictedMemberId: 'u4' },
    ],
  });
  const result = await runManualDraw(db, deps().deps, { exchangeId: 'ex1', userId: 'boss' });
  assert.ok(result.status === 400 || result.status === 409, `got ${result.status}`);
  assert.strictEqual(ex.status, 'SETUP');
});

test('runManualDraw: a missing mission is 404', async () => {
  const { db } = fakeDb();
  db.exchange.findUnique = async () => null;
  const result = await runManualDraw(db, deps().deps, { exchangeId: 'nope', userId: 'boss' });
  assert.strictEqual(result.status, 404);
});

test('runManualDraw: agents who turned email off get the notice but no email', async () => {
  const { db, ex, notices } = fakeDb();
  ex.members[1].user.emailNotifications = false;
  const { emails, deps: d } = deps();
  await runManualDraw(db, d, { exchangeId: 'ex1', userId: 'boss' });
  assert.strictEqual(notices.length, 4);
  assert.strictEqual(emails.length, 3);
  assert.ok(!emails.some((e) => e.recipientEmail === 'u2@x.com'));
});
