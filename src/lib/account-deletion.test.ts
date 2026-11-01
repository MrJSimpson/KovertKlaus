/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import type { PrismaClient } from '@prisma/client';
import { deleteAccount, deletionPreview, DELETE_PASSWORD_ATTEMPTS, EXPORT_FAILED_MESSAGE } from './account-deletion';
import type { ExportStore } from './export-store';
import { hashPassword } from './password';

const PASSWORD = ['Snow', 'Globe', '#2026'].join('');
const HOUR = 60 * 60 * 1000;

type Mission = { id: string; code: string; title: string; status: string; organizerId: string; isWhiteElephant?: boolean };
type Member = { id: string; exchangeId: string; userId: string; targetUserId: string | null };

/** A small in-memory world with just what account-deletion reads and writes. */
async function world(missions: Mission[], members: Member[], opts: { verified?: boolean; storeFails?: boolean } = {}) {
  const users: any[] = [
    { id: 'me', email: 'me@example.com', name: 'Holly', passwordHash: await hashPassword(PASSWORD), emailVerifiedAt: opts.verified === false ? null : new Date(0), isWorkshop: false },
    { id: 'boss', email: 'boss@example.com', name: 'Boss', passwordHash: 'x', emailVerifiedAt: new Date(0), isWorkshop: false },
    { id: 'pal', email: 'pal@example.com', name: 'Pal', passwordHash: 'x', emailVerifiedAt: new Date(0), isWorkshop: false },
  ];
  const throttle: Array<{ scope: string; accountHash: string; createdAt: Date }> = [];
  const notices: Array<{ userId: string; dedupeKey: string; title: string }> = [];
  const history: any[] = [];
  const outbox = [
    { id: 'o1', status: 'HELD', message: JSON.stringify({ to: { email: 'me@example.com' } }) },
    { id: 'o2', status: 'HELD', message: JSON.stringify({ to: { email: 'pal@example.com' } }) },
  ];
  let clock = Date.UTC(2026, 10, 2, 18);
  const byId = (id: string) => missions.find((m) => m.id === id)!;
  const pick = (m: Mission) => ({ id: m.id, code: m.code, title: m.title, status: m.status, organizerId: m.organizerId });

  const db: any = {
    user: {
      findUnique: async ({ where }: any) => users.find((u) => u.id === where.id) ?? null,
      delete: async ({ where }: any) => {
        const owns = missions.some((m) => m.organizerId === where.id);
        const targeted = members.some((m) => m.targetUserId === where.id);
        if (owns || targeted) throw new Error('foreign key violation');
        users.splice(users.findIndex((u) => u.id === where.id), 1);
        // Cascade: memberships go with the user.
        for (let i = members.length - 1; i >= 0; i--) if (members[i].userId === where.id) members.splice(i, 1);
      },
    },
    exchange: {
      findMany: async ({ where }: any) =>
        missions
          .filter((m) => m.organizerId === where.organizerId && (!where.status || where.status.in.includes(m.status)))
          .map((m) => ({
            ...pick(m),
            isWhiteElephant: false, createdAt: new Date(0), executionDate: new Date(0),
            cancelledAt: null, cancelledBy: null, cancelledFromStatus: null, cancelCode: null,
            members: members.filter((x) => x.exchangeId === m.id).map((x) => ({ id: x.id, userId: x.userId })),
          })),
      delete: async ({ where }: any) => {
        missions.splice(missions.findIndex((m) => m.id === where.id), 1);
        for (let i = members.length - 1; i >= 0; i--) if (members[i].exchangeId === where.id) members.splice(i, 1);
      },
    },
    exchangeMember: {
      findMany: async ({ where }: any) =>
        members
          .filter((x) => x.userId === where.userId)
          .filter((x) => {
            const ex = byId(x.exchangeId);
            if (where.exchange?.status && !where.exchange.status.in.includes(ex.status)) return false;
            if (where.exchange?.organizerId?.not && ex.organizerId === where.exchange.organizerId.not) return false;
            return true;
          })
          .map((x) => ({ ...x, exchange: pick(byId(x.exchangeId)) })),
      findFirst: async () => null,
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const x of members) if (x.targetUserId === where.targetUserId) { x.targetUserId = data.targetUserId; count++; }
        return { count };
      },
    },
    missionHistory: { create: async ({ data }: any) => history.push(data) },
    exchangeMessage: { findMany: async () => [] },
    exchangeReport: { findMany: async () => [] },
    feedback: { findMany: async () => [] },
    item: { deleteMany: async () => ({ count: 0 }), findMany: async () => [] },
    notification: {
      deleteMany: async () => ({ count: 0 }),
      findMany: async () => [],
      upsert: async ({ create }: any) => notices.push(create),
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(db),
  };
  const adminDb: any = {
    loginThrottle: {
      count: async ({ where }: any) =>
        throttle.filter((r) => r.scope === where.scope && r.accountHash === where.accountHash && r.createdAt > where.createdAt.gt).length,
      create: async ({ data }: any) => throttle.push({ ...data, createdAt: new Date(clock) }),
    },
    emailOutbox: {
      deleteMany: async ({ where }: any) => {
        for (let i = outbox.length - 1; i >= 0; i--) {
          if (outbox[i].status === where.status && outbox[i].message.includes(where.message.contains)) outbox.splice(i, 1);
        }
      },
    },
  };
  const logs: string[] = [];
  const stored = new Map<string, Uint8Array>();
  const exportStore: ExportStore = {
    put: async (k, d) => {
      if (opts.storeFails) throw new Error('bucket unavailable');
      stored.set(k, d);
    },
    get: async (k) => stored.get(k) ?? null,
  };
  const emails: Array<{ to: string; downloadUrl: string; expiresText: string }> = [];
  const deps = {
    db: db as PrismaClient,
    adminDb: adminDb as PrismaClient,
    onDeleted: (m: string) => logs.push(m),
    exportStore,
    baseUrl: 'https://kovertklaus.test',
    sendExportEmail: async (e: { to: string; name: string; downloadUrl: string; expiresText: string }) => emails.push(e),
  };
  return { deps, db: db as PrismaClient, users, missions, members, history, notices, outbox, throttle, logs, stored, emails, now: () => clock, advance: (ms: number) => (clock += ms) };
}

test('Account deletion - preview sorts missions into run, locked, leaving and closed', async () => {
  const w = await world(
    [
      { id: 'm1', code: 'RUN1', title: 'My open mission', status: 'RECRUITING', organizerId: 'me' },
      { id: 'm2', code: 'DONE', title: 'My finished mission', status: 'COMPLETED', organizerId: 'me' },
      { id: 'm3', code: 'DRWN', title: 'Drawn mission', status: 'MATCHED', organizerId: 'boss' },
      { id: 'm4', code: 'OPEN', title: 'Not drawn yet', status: 'RECRUITING', organizerId: 'boss' },
      { id: 'm5', code: 'OVER', title: 'Over and done', status: 'COMPLETED', organizerId: 'boss' },
    ],
    [
      { id: 'a', exchangeId: 'm1', userId: 'me', targetUserId: null },
      { id: 'b', exchangeId: 'm3', userId: 'me', targetUserId: null },
      { id: 'c', exchangeId: 'm4', userId: 'me', targetUserId: null },
      { id: 'd', exchangeId: 'm5', userId: 'me', targetUserId: null },
    ]
  );
  const p = await deletionPreview(w.db, 'me');
  assert.deepStrictEqual(p.runningMissions.map((m) => m.code), ['RUN1']);
  assert.deepStrictEqual(p.lockedMissions.map((m) => m.code), ['DRWN']);
  assert.deepStrictEqual(p.leavingMissions.map((m) => m.code), ['OPEN']);
  assert.strictEqual(p.closedMissionsRun, 1);
  assert.strictEqual(p.canDelete, false);
});

test('Account deletion - every drawn-but-unfinished status blocks; cancelled and completed do not', async () => {
  for (const status of ['MATCHED', 'SHIPPED', 'EXECUTED']) {
    const w = await world([{ id: 'm', code: 'X', title: 'X', status, organizerId: 'boss' }], [{ id: 'a', exchangeId: 'm', userId: 'me', targetUserId: null }]);
    assert.strictEqual((await deletionPreview(w.db, 'me')).canDelete, false, status);
  }
  for (const status of ['COMPLETED', 'CANCELLED', 'SETUP', 'RECRUITING']) {
    const w = await world([{ id: 'm', code: 'X', title: 'X', status, organizerId: 'boss' }], [{ id: 'a', exchangeId: 'm', userId: 'me', targetUserId: null }]);
    assert.strictEqual((await deletionPreview(w.db, 'me')).canDelete, true, status);
  }
});

test('Account deletion - needs DELETE typed and the right password', async () => {
  const w = await world([], []);
  assert.strictEqual((await deleteAccount(w.deps, 'me', { password: PASSWORD, confirm: 'delete' }, w.now())).status, 400);
  assert.strictEqual((await deleteAccount(w.deps, 'me', { password: '', confirm: 'DELETE' }, w.now())).status, 400);
  const wrong = await deleteAccount(w.deps, 'me', { password: 'not it', confirm: 'DELETE' }, w.now());
  assert.strictEqual(wrong.status, 400);
  assert.match(String(wrong.body.error), /password/);
  assert.ok(w.users.some((u) => u.id === 'me'), 'still there');
  assert.strictEqual((await deleteAccount(w.deps, 'ghost', { password: PASSWORD, confirm: 'DELETE' }, w.now())).status, 401);
});

test('Account deletion - wrong passwords lock the form for an hour', async () => {
  const w = await world([], []);
  for (let i = 0; i < DELETE_PASSWORD_ATTEMPTS; i++) await deleteAccount(w.deps, 'me', { password: 'nope', confirm: 'DELETE' }, w.now());
  const locked = await deleteAccount(w.deps, 'me', { password: PASSWORD, confirm: 'DELETE' }, w.now());
  assert.strictEqual(locked.status, 429);
  assert.ok(w.throttle.every((r) => r.scope === 'DELETE' && !r.accountHash.includes('me')), 'keys are digests');
  w.advance(HOUR + 1);
  assert.strictEqual((await deleteAccount(w.deps, 'me', { password: PASSWORD, confirm: 'DELETE' }, w.now())).status, 200);
});

test('Account deletion - refused with the blocking missions while any are open or drawn', async () => {
  const w = await world(
    [
      { id: 'm1', code: 'RUN1', title: 'Mine', status: 'SETUP', organizerId: 'me' },
      { id: 'm3', code: 'DRWN', title: 'Drawn', status: 'SHIPPED', organizerId: 'boss' },
    ],
    [
      { id: 'a', exchangeId: 'm1', userId: 'me', targetUserId: null },
      { id: 'b', exchangeId: 'm3', userId: 'me', targetUserId: null },
    ]
  );
  const r = await deleteAccount(w.deps, 'me', { password: PASSWORD, confirm: 'DELETE' }, w.now());
  assert.strictEqual(r.status, 409);
  assert.deepStrictEqual((r.body.runningMissions as Array<{ code: string }>).map((m) => m.code), ['RUN1']);
  assert.deepStrictEqual((r.body.lockedMissions as Array<{ code: string }>).map((m) => m.code), ['DRWN']);
  assert.ok(w.users.some((u) => u.id === 'me'));
});

test('Account deletion - deletes the account, its closed missions, and clears links to it', async () => {
  const w = await world(
    [
      { id: 'mine', code: 'MINE', title: 'Family 2025', status: 'COMPLETED', organizerId: 'me' },
      { id: 'gone', code: 'GONE', title: 'Called off', status: 'CANCELLED', organizerId: 'me' },
      { id: 'past', code: 'PAST', title: 'Office 2025', status: 'COMPLETED', organizerId: 'boss' },
      { id: 'soon', code: 'SOON', title: 'Office 2026', status: 'RECRUITING', organizerId: 'boss' },
    ],
    [
      { id: 'a', exchangeId: 'mine', userId: 'me', targetUserId: 'pal' },
      { id: 'b', exchangeId: 'mine', userId: 'pal', targetUserId: 'me' },
      { id: 'c', exchangeId: 'gone', userId: 'me', targetUserId: null },
      { id: 'd', exchangeId: 'past', userId: 'me', targetUserId: 'boss' },
      { id: 'e', exchangeId: 'past', userId: 'boss', targetUserId: 'me' },
      { id: 'f', exchangeId: 'soon', userId: 'me', targetUserId: null },
      { id: 'g', exchangeId: 'soon', userId: 'boss', targetUserId: null },
    ]
  );
  const r = await deleteAccount(w.deps, 'me', { password: PASSWORD, confirm: 'DELETE' }, w.now());
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.ok(!w.users.some((u) => u.id === 'me'), 'user deleted');
  assert.deepStrictEqual(w.missions.map((m) => m.id).sort(), ['past', 'soon'], 'missions they ran are gone');
  assert.deepStrictEqual(w.history.map((h) => h.reason).sort(), ['HEAD_ELF_ACCOUNT_DELETED', 'UNKNOWN']);
  assert.strictEqual(w.members.find((m) => m.id === 'e')?.targetUserId, null, 'boss no longer points at them');
  assert.ok(!w.members.some((m) => m.userId === 'me'), 'memberships cascaded');
  assert.deepStrictEqual(w.outbox.map((o) => o.id), ['o2'], 'their held email dropped, others kept');

  const keys = w.notices.map((n) => `${n.userId}:${n.dedupeKey.split(':')[0]}`).sort();
  assert.deepStrictEqual(keys, ['boss:agent-account-deleted', 'pal:mission-deleted-account']);
  assert.ok(!w.notices.some((n) => n.userId === 'me'));
  assert.deepStrictEqual(w.logs, ['An agent deleted their account.']);
  assert.doesNotMatch(JSON.stringify(w.notices), /me@example\.com/, 'notices carry no email');
});

test('Account deletion - saves a copy first and emails the link after the delete', async () => {
  const w = await world([], []);
  const r = await deleteAccount(w.deps, 'me', { password: PASSWORD, confirm: 'DELETE' }, w.now());
  assert.strictEqual(r.status, 200);
  assert.strictEqual(w.stored.size, 1);
  assert.ok([...w.stored.keys()][0].startsWith('user_backups/'));
  assert.strictEqual(w.emails.length, 1);
  assert.strictEqual(w.emails[0].to, 'me@example.com');
  assert.ok(w.emails[0].downloadUrl.startsWith('https://kovertklaus.test/api/users/data-export?token='));
  assert.match(w.emails[0].expiresText, /^December \d+, 2026$/);
  assert.strictEqual(r.body.downloadUrl, w.emails[0].downloadUrl, 'the deleted page gets the same link');
});

test('Account deletion - if the copy cannot be saved, nothing is deleted', async () => {
  const w = await world([], [], { storeFails: true });
  const quiet = console.error;
  console.error = () => {};
  try {
    const r = await deleteAccount(w.deps, 'me', { password: PASSWORD, confirm: 'DELETE' }, w.now());
    assert.deepStrictEqual([r.status, r.body.error], [503, EXPORT_FAILED_MESSAGE]);
    const noStore = await deleteAccount({ ...w.deps, exportStore: undefined }, 'me', { password: PASSWORD, confirm: 'DELETE' }, w.now());
    assert.strictEqual(noStore.status, 503);
  } finally {
    console.error = quiet;
  }
  assert.ok(w.users.some((u) => u.id === 'me'), 'account kept');
  assert.strictEqual(w.emails.length, 0);
});

test('Account deletion - unverified accounts get no copy and no email', async () => {
  const w = await world([], [], { verified: false });
  assert.strictEqual((await deletionPreview(w.db, 'me')).willExport, false);
  const r = await deleteAccount({ ...w.deps, exportStore: undefined }, 'me', { password: PASSWORD, confirm: 'DELETE' }, w.now());
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.downloadUrl, undefined);
  assert.strictEqual(w.emails.length, 0);
  assert.ok(!w.users.some((u) => u.id === 'me'));
});

test('Account deletion - preview says a copy will be kept for verified accounts', async () => {
  const w = await world([], []);
  assert.strictEqual((await deletionPreview(w.db, 'me')).willExport, true);
});
