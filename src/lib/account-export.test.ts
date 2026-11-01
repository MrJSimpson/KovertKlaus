/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import os from 'os';
import path from 'path';
import { mkdtemp, readdir, rm, utimes, writeFile } from 'fs/promises';
import type { PrismaClient } from '@prisma/client';
import {
  buildAccountExport,
  createAccountExport,
  decryptExport,
  downloadAccountExport,
  encryptExport,
  EXPORT_DOWNLOADS_PER_HOUR,
  EXPORT_GONE_MESSAGE,
  issueExportToken,
  readExportToken,
} from './account-export';
import { EXPORT_RETENTION_MS, exportIdFromKey, exportKeyFor, r2ExportStore, type ExportStore } from './export-store';
import { diskExportStore, sweepDiskExports } from './export-store-disk';
import { issueVerifyToken } from './email-verification';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 2, 18);

/** An agent "me" in one drawn mission whose target is "pal" (address and name must not leak). */
function fakeDb() {
  const users: Record<string, any> = {
    me: { id: 'me', email: 'me@example.com', name: 'Holly Real', passwordHash: 'SECRET-HASH', sessionsRevokedAt: null, isWorkshop: false, streetAddress: '1 Elf Way', penaltyPoints: 1, emailVerifiedAt: new Date(0) },
    pal: { id: 'pal', email: 'pal@example.com', name: 'Pal Private', streetAddress: '99 Hidden Lane' },
  };
  const db: any = {
    user: { findUnique: async ({ where }: any) => users[where.id] ?? null },
    exchangeMember: {
      findMany: async () => [
        {
          id: 'm1', exchangeId: 'x1', role: 'MEMBER', codename: 'Agent: Quiet Fox', joinedAt: new Date(0), targetUserId: 'pal',
          shippingStatus: 'SHIPPED', trackingNumber: '1Z999', shippedAt: new Date(0), deliveredConfirmed: false,
          exchange: { title: 'Office 2026', code: 'OFFC', status: 'SHIPPED', isWhiteElephant: false, isLocalOnly: false, budgetMin: 10, budgetMax: 50, currency: 'USD', inviteCutoffDate: null, assignmentDate: null, shippingDate: null, executionDate: null },
          wishlist: { name: 'My list', type: 'WISHLIST', wishlistItems: [{ quantity: 2, item: { name: 'Mittens', url: 'https://shop.test/m', price: 12.5, description: null, createdAt: new Date(0) } }] },
        },
      ],
      findFirst: async ({ where }: any) => (where.userId === 'pal' ? { codename: 'Agent: Bold Owl' } : null),
    },
    exchangeMessage: { findMany: async () => [{ channel: 'GENERAL', messageText: 'Hello team', isFromSanta: false, createdAt: new Date(0), exchange: { title: 'Office 2026', code: 'OFFC' } }] },
    exchangeReport: { findMany: async () => [] },
    feedback: { findMany: async () => [] },
    notification: { findMany: async () => [{ title: 'Hi', message: 'Welcome', createdAt: new Date(0) }] },
    item: { findMany: async () => [] },
  };
  return db as PrismaClient;
}

/** In-memory store, plus a fake throttle table. */
function memStore() {
  const blobs = new Map<string, Uint8Array>();
  const store: ExportStore = { put: async (k, d) => void blobs.set(k, d), get: async (k) => blobs.get(k) ?? null };
  return { store, blobs };
}
function fakeAdmin() {
  const rows: Array<{ ipHash: string; createdAt: Date }> = [];
  return {
    rows,
    adminDb: {
      loginThrottle: {
        count: async ({ where }: any) => rows.filter((r) => r.ipHash === where.ipHash && r.createdAt > where.createdAt.gt).length,
        create: async ({ data }: any) => rows.push({ ipHash: data.ipHash, createdAt: new Date(NOW) }),
      },
    } as unknown as PrismaClient,
  };
}

test('Export - holds the agent\'s own data and nothing private about others', async () => {
  const doc = (await buildAccountExport(fakeDb(), 'me', NOW))!;
  const text = JSON.stringify(doc);
  assert.strictEqual(doc.schemaVersion, 1);
  assert.match(text, /Holly Real/);
  assert.match(text, /1 Elf Way/, 'their own address is theirs');
  assert.match(text, /Agent: Quiet Fox/);
  assert.match(text, /Agent: Bold Owl/, 'target by codename');
  assert.match(text, /Mittens/);
  assert.match(text, /Hello team/);
  assert.match(text, /"coalCitations":1/);
  for (const secret of ['SECRET-HASH', 'Pal Private', '99 Hidden Lane', 'pal@example.com']) {
    assert.ok(!text.includes(secret), `must not include ${secret}`);
  }
  assert.strictEqual(await buildAccountExport(fakeDb(), 'nobody', NOW), null);
});

test('Export - sealing round-trips and refuses a tampered blob', async () => {
  const sealed = await encryptExport({ hello: 'world' });
  assert.ok(!new TextDecoder().decode(sealed).includes('world'), 'not readable at rest');
  assert.deepStrictEqual(JSON.parse((await decryptExport(sealed))!), { hello: 'world' });
  const tampered = sealed.slice();
  tampered[tampered.length - 1] ^= 1;
  assert.strictEqual(await decryptExport(tampered), null);
  assert.strictEqual(await decryptExport(new Uint8Array(5)), null);
});

test('Export - link tokens expire, reject tampering and other link kinds', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const token = issueExportToken(id, NOW + DAY);
  assert.strictEqual(readExportToken(token, NOW)?.exportId, id);
  assert.strictEqual(readExportToken(token, NOW + DAY), null);
  assert.strictEqual(readExportToken(token.slice(0, -2) + 'xx', NOW), null);
  assert.strictEqual(readExportToken(issueVerifyToken('me', 'me@example.com', NOW + DAY), NOW), null);
});

test('Export - create stores under user_backups/ and the link downloads the JSON', async () => {
  const { store, blobs } = memStore();
  const made = (await createAccountExport(fakeDb(), store, 'me', 'https://kovertklaus.test/', NOW))!;
  assert.strictEqual(made.expiresAtMs, NOW + EXPORT_RETENTION_MS);
  const [key] = [...blobs.keys()];
  assert.ok(key.startsWith('user_backups/') && key.endsWith('.json.enc'));
  assert.ok(made.url.startsWith('https://kovertklaus.test/api/users/data-export?token='));

  const token = decodeURIComponent(new URL(made.url).searchParams.get('token')!);
  const { adminDb } = fakeAdmin();
  const res = await downloadAccountExport({ adminDb, store }, { token, ip: '1.2.3.4' }, NOW + DAY);
  assert.strictEqual(res.status, 200);
  assert.match(String(res.headers?.['Content-Disposition']), /attachment; filename="kovertklaus-data-2026-11-03\.json"/);
  assert.strictEqual(res.headers?.['Cache-Control'], 'no-store');
  assert.match(res.body as string, /Holly Real/);
});

test('Export - expired links, deleted copies and floods are refused', async () => {
  const { store, blobs } = memStore();
  const made = (await createAccountExport(fakeDb(), store, 'me', 'https://k.test', NOW))!;
  const token = decodeURIComponent(new URL(made.url).searchParams.get('token')!);

  const a = fakeAdmin();
  const late = await downloadAccountExport({ adminDb: a.adminDb, store }, { token, ip: 'ip' }, NOW + EXPORT_RETENTION_MS);
  assert.deepStrictEqual([late.status, late.body], [410, { error: EXPORT_GONE_MESSAGE }]);
  assert.strictEqual((await downloadAccountExport({ adminDb: a.adminDb, store }, { token: null, ip: 'ip' }, NOW)).status, 410);

  blobs.clear(); // the lifecycle rule ran
  assert.strictEqual((await downloadAccountExport({ adminDb: fakeAdmin().adminDb, store }, { token, ip: 'ip' }, NOW)).status, 410);

  const f = fakeAdmin();
  for (let i = 0; i < EXPORT_DOWNLOADS_PER_HOUR; i++) await downloadAccountExport({ adminDb: f.adminDb, store }, { token: 'x', ip: 'flood' }, NOW);
  assert.strictEqual((await downloadAccountExport({ adminDb: f.adminDb, store }, { token, ip: 'flood' }, NOW)).status, 429);
  assert.ok(f.rows.every((r) => !r.ipHash.includes('flood')), 'IPs stored as digests');
});

test('Export store - keys are export IDs only (no path tricks)', async () => {
  const id = '11111111-2222-4333-8444-555555555555';
  assert.strictEqual(exportKeyFor(id), `user_backups/${id}.json.enc`);
  assert.strictEqual(exportIdFromKey(`user_backups/${id}.json.enc`), id);
  assert.throws(() => exportKeyFor('../../etc/passwd'));
  assert.strictEqual(exportIdFromKey('user_backups/../secrets.json.enc'), null);
  assert.strictEqual(exportIdFromKey('nightly/kovertklaus.dump.age'), null, 'never touches DB backups');

  const r2: any = { put: async () => undefined, get: async () => null };
  await assert.rejects(r2ExportStore(r2).put('nightly/x.json.enc', new Uint8Array(1)));
  assert.strictEqual(await r2ExportStore(r2).get('../x'), null);
});

test('Export store - disk store keeps files and the sweep removes only old exports', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kk-exports-'));
  try {
    const store = diskExportStore(dir);
    const fresh = exportKeyFor('aaaaaaaa-2222-4333-8444-555555555555');
    const old = exportKeyFor('bbbbbbbb-2222-4333-8444-555555555555');
    await store.put(fresh, new Uint8Array([1, 2, 3]));
    await store.put(old, new Uint8Array([4]));
    await writeFile(path.join(dir, 'notes.txt'), 'not an export');
    assert.deepStrictEqual([...(await store.get(fresh))!], [1, 2, 3]);
    assert.strictEqual(await store.get(exportKeyFor('cccccccc-2222-4333-8444-555555555555')), null);

    const longAgo = new Date(Date.now() - EXPORT_RETENTION_MS - DAY);
    await utimes(path.join(dir, 'bbbbbbbb-2222-4333-8444-555555555555.json.enc'), longAgo, longAgo);
    assert.strictEqual(await sweepDiskExports(dir), 1);
    assert.deepStrictEqual((await readdir(dir)).sort(), ['aaaaaaaa-2222-4333-8444-555555555555.json.enc', 'notes.txt']);
    assert.strictEqual(await sweepDiskExports(path.join(dir, 'missing')), 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Export store - R2 store round-trips through a binding with the R2 get/put shape', async () => {
  const objects = new Map<string, Uint8Array>();
  const meta: Record<string, unknown> = {};
  const bucket = {
    put: async (key: string, value: Uint8Array, options?: unknown) => {
      objects.set(key, value);
      meta[key] = options;
    },
    get: async (key: string) => {
      const v = objects.get(key);
      return v ? { arrayBuffer: async () => v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) as ArrayBuffer } : null;
    },
  };
  const store = r2ExportStore(bucket);
  const key = exportKeyFor('dddddddd-2222-4333-8444-555555555555');
  const sealed = await encryptExport({ a: 1 });
  await store.put(key, sealed);
  assert.deepStrictEqual(meta[key], { httpMetadata: { contentType: 'application/octet-stream' } });
  assert.deepStrictEqual(JSON.parse((await decryptExport((await store.get(key))!))!), { a: 1 });
  assert.strictEqual(await store.get(exportKeyFor('eeeeeeee-2222-4333-8444-555555555555')), null);
});
