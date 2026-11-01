/**
 * @file export-store.ts
 * @description Where account-deletion exports are kept: the interface, the R2 store, and key rules.
 *
 * Tier 1 (what): `ExportStore` puts and gets sealed export blobs by key. `r2ExportStore` wraps the
 * Worker's R2 binding (`USER_EXPORTS`, bucket `kovertklaus`). The self-hosted disk store lives in
 * `export-store-disk.ts`, so the Worker bundle never imports Node's file system.
 * Tier 2 (why): Owner decision (2026-11-01): exports go to R2 under `user_backups/` (SaaS) or local
 * disk (self-hosted) and are deleted after 30 days.
 * Tier 3 (how): Keys are `user_backups/<uuid>.json.enc`; `isExportId` keeps anything else (such as a
 * path with `..`) out. On R2 the 30 days are an R2 lifecycle rule on the prefix; on disk, a sweep.
 */

/** Key prefix for exports (and the R2 lifecycle rule's prefix). */
export const EXPORT_PREFIX = 'user_backups/';

/** How long an export is kept, and how long its link works. */
export const EXPORT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Somewhere sealed exports can be kept. */
export interface ExportStore {
  put(key: string, data: Uint8Array): Promise<void>;
  /** The blob, or `null` when it does not exist (expired or never stored). */
  get(key: string): Promise<Uint8Array | null>;
}

/** The part of a Workers R2 binding this module uses. */
export interface R2BucketLike {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** True for a well-formed export ID (a UUID). */
export function isExportId(id: string | undefined | null): id is string {
  return typeof id === 'string' && UUID.test(id);
}

/** Storage key for an export ID. */
export function exportKeyFor(exportId: string): string {
  if (!isExportId(exportId)) throw new Error('Invalid export ID');
  return `${EXPORT_PREFIX}${exportId}.json.enc`;
}

/** The export ID in a storage key, or `null` for anything that is not an export key. */
export function exportIdFromKey(key: string): string | null {
  if (!key.startsWith(EXPORT_PREFIX) || !key.endsWith('.json.enc')) return null;
  const id = key.slice(EXPORT_PREFIX.length, -'.json.enc'.length);
  return isExportId(id) ? id : null;
}

/** Store backed by the Worker's R2 binding. */
export function r2ExportStore(bucket: R2BucketLike): ExportStore {
  return {
    async put(key, data) {
      if (!exportIdFromKey(key)) throw new Error('Invalid export key');
      await bucket.put(key, data, { httpMetadata: { contentType: 'application/octet-stream' } });
    },
    async get(key) {
      if (!exportIdFromKey(key)) return null;
      const obj = await bucket.get(key);
      return obj ? new Uint8Array(await obj.arrayBuffer()) : null;
    },
  };
}
