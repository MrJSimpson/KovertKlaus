/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import { cachedSystemConfigReader, clearSystemConfigCaches, createTtlCache, SYSTEM_CONFIG_TTL_MS, systemConfigCache } from './system-config-cache';

test('TTL cache - serves the stored value until it expires, then loads again', async () => {
  const cache = createTtlCache<number>(1000);
  let loads = 0;
  const load = async () => ++loads;
  assert.strictEqual(await cache.get(load, 0), 1);
  assert.strictEqual(await cache.get(load, 999), 1);
  assert.strictEqual(await cache.get(load, 1000), 2);
  assert.strictEqual(loads, 2);
});

test('TTL cache - a failed load is not cached', async () => {
  const cache = createTtlCache<string>(1000);
  await assert.rejects(cache.get(async () => { throw new Error('cold start'); }, 0));
  assert.strictEqual(await cache.get(async () => 'ok', 1), 'ok');
});

test('TTL cache - clear forces the next get to load', async () => {
  const cache = createTtlCache<number>(1000);
  let loads = 0;
  await cache.get(async () => ++loads, 0);
  cache.clear();
  await cache.get(async () => ++loads, 1);
  assert.strictEqual(loads, 2);
});

test('SystemConfig reader - repeated reads hit the admin client once per TTL', async () => {
  clearSystemConfigCaches();
  let reads = 0;
  const adminDb: any = { systemConfig: { findUnique: async () => (++reads, { id: 'singleton', emailProvider: 'brevo' }) } };
  const reader = cachedSystemConfigReader(adminDb);
  for (let i = 0; i < 5; i++) assert.strictEqual((await reader.systemConfig.findUnique())?.emailProvider, 'brevo');
  assert.strictEqual(reads, 1);
  clearSystemConfigCaches();
  await reader.systemConfig.findUnique();
  assert.strictEqual(reads, 2, 'a North Pole save (clear) is seen at once');
  assert.ok(SYSTEM_CONFIG_TTL_MS <= 60_000, 'settings changes reach other isolates within a minute');
  systemConfigCache.clear();
});
