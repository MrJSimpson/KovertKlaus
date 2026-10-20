import test from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import {
  CODENAME_POOL,
  CODENAME_PREFIXES,
  CODENAME_SUFFIXES,
  acceptCodename,
  drawCodename,
  enrollWithCodename,
  rerollCodename,
} from './codename';

interface FakeMember {
  id: string;
  userId: string;
  codename: string | null;
  codenameAcceptedAt: Date | null;
}

/** Minimal in-memory stand-in for the `exchangeMember` calls `codename.ts` makes. */
function fakeDb(members: FakeMember[], status = 'RECRUITING') {
  const db = {
    exchangeMember: {
      findMany: async () => members.map((m) => ({ codename: m.codename })),
      findUnique: async ({ where }: { where: { exchangeId_userId: { userId: string } } }) => {
        const m = members.find((x) => x.userId === where.exchangeId_userId.userId);
        return m ? { ...m, exchange: { status } } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeMember> }) => {
        const m = members.find((x) => x.id === where.id)!;
        Object.assign(m, data);
        return { codename: m.codename };
      },
    },
  };
  return db as unknown as PrismaClient;
}

const p2002 = (field: string) => Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['exchangeId', field] } });

test('Mission codename pool & assignment', async (t) => {
  await t.test('pool is every prefix-suffix pair, all distinct', () => {
    assert.equal(CODENAME_POOL.length, CODENAME_PREFIXES.length * CODENAME_SUFFIXES.length);
    assert.equal(new Set(CODENAME_POOL.map((n) => n.toLowerCase())).size, CODENAME_POOL.length);
  });

  await t.test('drawCodename returns a pool name not already taken (case-insensitive)', () => {
    const taken = CODENAME_POOL.slice(0, CODENAME_POOL.length - 1).map((n) => n.toUpperCase());
    assert.equal(drawCodename(taken), CODENAME_POOL[CODENAME_POOL.length - 1]);
  });

  await t.test('drawCodename numbers a pool name once the pool is exhausted', () => {
    const first = () => 0;
    assert.equal(drawCodename(CODENAME_POOL, first), `${CODENAME_POOL[0]}-2`);
    assert.equal(drawCodename([...CODENAME_POOL, `${CODENAME_POOL[0]}-2`], first), `${CODENAME_POOL[0]}-3`);
  });

  await t.test('drawCodename ignores empty roster entries', () => {
    assert.ok(CODENAME_POOL.includes(drawCodename([null, undefined, ''])));
  });

  await t.test('enrollWithCodename draws again after a codename collision', async () => {
    const db = fakeDb([]);
    const seen: string[] = [];
    const result = await enrollWithCodename(db, 'ex1', async (codename) => {
      seen.push(codename);
      if (seen.length === 1) throw p2002('codename');
      return codename;
    });
    assert.equal(seen.length, 2);
    assert.notEqual(seen[0], seen[1]);
    assert.equal(result, seen[1]);
  });

  await t.test('enrollWithCodename rethrows other errors without retrying', async () => {
    const db = fakeDb([]);
    let calls = 0;
    await assert.rejects(
      enrollWithCodename(db, 'ex1', async () => { calls++; throw p2002('userId'); }),
      /Unique constraint/
    );
    assert.equal(calls, 1);
  });

  await t.test('rerollCodename gives a different codename while recruiting and unaccepted', async () => {
    const me: FakeMember = { id: 'm1', userId: 'u1', codename: CODENAME_POOL[0], codenameAcceptedAt: null };
    const res = await rerollCodename(fakeDb([me]), 'ex1', 'u1');
    assert.equal(res.status, 200);
    assert.notEqual(res.body.codename, CODENAME_POOL[0]);
    assert.equal(me.codename, res.body.codename);
  });

  await t.test('rerollCodename refuses once accepted, once recruiting closes, and for non-members', async () => {
    const accepted: FakeMember = { id: 'm1', userId: 'u1', codename: 'Frost-Fox', codenameAcceptedAt: new Date() };
    assert.equal((await rerollCodename(fakeDb([accepted]), 'ex1', 'u1')).status, 409);
    const open: FakeMember = { id: 'm1', userId: 'u1', codename: 'Frost-Fox', codenameAcceptedAt: null };
    assert.equal((await rerollCodename(fakeDb([open], 'MATCHED'), 'ex1', 'u1')).status, 409);
    assert.equal(open.codename, 'Frost-Fox');
    assert.equal((await rerollCodename(fakeDb([]), 'ex1', 'u1')).status, 404);
  });

  await t.test('acceptCodename locks the codename and is idempotent', async () => {
    const me: FakeMember = { id: 'm1', userId: 'u1', codename: 'Frost-Fox', codenameAcceptedAt: null };
    const db = fakeDb([me]);
    const first = await acceptCodename(db, 'ex1', 'u1');
    assert.deepEqual(first, { status: 200, body: { codename: 'Frost-Fox', accepted: true } });
    const lockedAt = me.codenameAcceptedAt;
    assert.ok(lockedAt);
    await acceptCodename(db, 'ex1', 'u1');
    assert.equal(me.codenameAcceptedAt, lockedAt);
    assert.equal((await rerollCodename(db, 'ex1', 'u1')).status, 409);
  });
});
