import test from 'node:test';
import assert from 'node:assert';
import type { PrismaClient } from '@prisma/client';
import { getDb, withDbRetry, invalidateCachedDb } from './db';
import { getAdminDb, withAdminDbRetry, invalidateCachedAdminDb } from './adminDb';

/**
 * Retry behaviour of the real `withDbRetry` / `withAdminDbRetry` wrappers (replaces the W39
 * pool "stress" suite, which asserted against its own copies of the config and retry loop).
 * Clients are built against an address that is never dialled: the callbacks below throw or
 * return without querying, so no database is needed.
 */

const NO_DB = 'postgresql://retry-test@localhost:1/none?sslmode=disable';

const wrappers = [
  { name: 'withDbRetry', retry: withDbRetry, reset: invalidateCachedDb },
  { name: 'withAdminDbRetry', retry: withAdminDbRetry, reset: invalidateCachedAdminDb },
];

for (const { name, retry, reset } of wrappers) {
  test(`${name} - a connection drop is retried on a fresh client`, async (t) => {
    t.mock.method(console, 'warn', () => {});
    t.after(reset);
    const clients: PrismaClient[] = [];
    const result = await retry(async (client) => {
      clients.push(client);
      if (clients.length === 1) throw new Error('Connection terminated unexpectedly');
      return 'recovered';
    }, 3, NO_DB);

    assert.strictEqual(result, 'recovered');
    assert.strictEqual(clients.length, 2);
    assert.notStrictEqual(clients[1], clients[0], 'the cached client must be dropped before retrying');
  });

  test(`${name} - other errors are thrown on the first attempt`, async (t) => {
    t.after(reset);
    let attempts = 0;
    await assert.rejects(
      retry(async () => {
        attempts++;
        throw new Error('Unique constraint failed on the fields: (`email`)');
      }, 3, NO_DB),
      /Unique constraint failed/
    );
    assert.strictEqual(attempts, 1);
  });

  test(`${name} - gives up after maxRetries and throws the last error`, async (t) => {
    t.mock.method(console, 'warn', () => {});
    t.after(reset);
    let attempts = 0;
    await assert.rejects(
      retry(async () => {
        attempts++;
        throw new Error(`read ECONNRESET (attempt ${attempts})`);
      }, 2, NO_DB),
      /ECONNRESET \(attempt 2\)/
    );
    assert.strictEqual(attempts, 2);
  });
}

test('getDb / getAdminDb proxies expose model delegates and $transaction', () => {
  const app = getDb(NO_DB) as unknown as Record<string, unknown>;
  for (const model of ['user', 'exchange', 'systemLog']) assert.strictEqual(typeof app[model], 'object', model);
  assert.strictEqual(typeof app.$transaction, 'function');

  const admin = getAdminDb(NO_DB) as unknown as Record<string, unknown>;
  for (const model of ['adminUser', 'systemConfig']) assert.strictEqual(typeof admin[model], 'object', model);
  assert.strictEqual(typeof admin.$transaction, 'function');
});
