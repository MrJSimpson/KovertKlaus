/**
 * @file system-config-cache.ts
 * @description Short-lived per-isolate copies of admin-schema settings for the edge worker.
 *
 * Tier 1 (what): `createTtlCache` keeps one value for a fixed time. The worker uses it for the
 * `SystemConfig` row (email settings) and for the public `/api/config` payload, and clears both
 * after a North Pole save.
 * Tier 2 (why): `SystemConfig` and the active theme are read through the admin client, so every
 * page's `/api/config` call and every user action that sends mail opened a second (admin)
 * database connection next to the app one. With the caches, user-facing requests run on the app
 * connection alone almost all the time.
 * Tier 3 (how): Only settled values are cached, never a pending promise (a promise started by one
 * worker request must not be awaited by another). A failed load is not cached, so the next request
 * retries. A save in one isolate clears that isolate at once; other isolates pick the change up
 * within the TTL.
 */

import type { PrismaClient, SystemConfig } from '@prisma/client';
import type { PublicSystemConfigResponse } from './config/publicConfig';

/** How long one isolate keeps its copy of admin settings. */
export const SYSTEM_CONFIG_TTL_MS = 60_000;

/** One cached value with a fixed lifetime. */
export interface TtlCache<T> {
  /** The cached value while fresh, else the result of `load` (which is then cached). */
  get(load: () => Promise<T>, nowMs?: number): Promise<T>;
  /** Forgets the cached value. */
  clear(): void;
}

/** A cache holding one value for `ttlMs`. Concurrent misses each load; the last one wins. */
export function createTtlCache<T>(ttlMs: number): TtlCache<T> {
  let entry: { value: T; storedAt: number } | null = null;
  return {
    async get(load, nowMs = Date.now()) {
      if (entry && nowMs - entry.storedAt < ttlMs) return entry.value;
      const value = await load();
      entry = { value, storedAt: nowMs };
      return value;
    },
    clear() {
      entry = null;
    },
  };
}

/** This isolate's copy of the `SystemConfig` singleton (`null` when none exists). */
export const systemConfigCache = createTtlCache<SystemConfig | null>(SYSTEM_CONFIG_TTL_MS);

/** This isolate's copy of the public `/api/config` payload. */
export const publicConfigCache = createTtlCache<PublicSystemConfigResponse>(SYSTEM_CONFIG_TTL_MS);

/** Forgets every cached admin setting in this isolate (call after writing `SystemConfig`). */
export function clearSystemConfigCaches(): void {
  systemConfigCache.clear();
  publicConfigCache.clear();
}

/**
 * A stand-in exposing only `systemConfig.findUnique`, answered from `systemConfigCache`. Lets code
 * that expects a Prisma client (e.g. `getResolvedEmailConfig`) read the cached row.
 */
export function cachedSystemConfigReader(adminDb: PrismaClient): { systemConfig: { findUnique: () => Promise<SystemConfig | null> } } {
  return {
    systemConfig: {
      findUnique: () => systemConfigCache.get(() => adminDb.systemConfig.findUnique({ where: { id: 'singleton' } })),
    },
  };
}
