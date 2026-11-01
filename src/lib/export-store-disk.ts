/**
 * @file export-store-disk.ts
 * @description Self-hosted store for account-deletion exports: files on the server's disk.
 *
 * Tier 1 (what): `diskExportStore` keeps sealed exports in `EXPORT_DIR` (default `data/exports`).
 * `sweepDiskExports` deletes the ones older than 30 days; the self-hosted scheduler runs it hourly.
 * Tier 2 (why): Self-hosted installs have no R2 bucket; the owner chose the same flow on local disk
 * (2026-11-01). Docker keeps the folder in a named volume so exports survive a rebuild.
 * Tier 3 (how): Node only (imported by the Next.js routes and the scheduler, never by the Worker).
 * File names are the export ID only (`<uuid>.json.enc`), checked before every read and write, so a
 * key can never point outside the folder.
 */

import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { EXPORT_RETENTION_MS, exportIdFromKey, isExportId, type ExportStore } from '@/lib/export-store';

/** The folder exports are kept in. */
export function exportDir(): string {
  return process.env.EXPORT_DIR || path.join(process.cwd(), 'data', 'exports');
}

function fileFor(dir: string, key: string): string | null {
  const id = exportIdFromKey(key);
  return id ? path.join(dir, `${id}.json.enc`) : null;
}

/** Store backed by files in `dir`. */
export function diskExportStore(dir = exportDir()): ExportStore {
  return {
    async put(key, data) {
      const file = fileFor(dir, key);
      if (!file) throw new Error('Invalid export key');
      await mkdir(dir, { recursive: true });
      await writeFile(file, data, { mode: 0o600 });
    },
    async get(key) {
      const file = fileFor(dir, key);
      if (!file) return null;
      try {
        return new Uint8Array(await readFile(file));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },
  };
}

/** Deletes exports older than 30 days. Returns how many were removed. */
export async function sweepDiskExports(dir = exportDir(), nowMs = Date.now()): Promise<number> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return 0; // No folder yet: nothing to sweep.
  }
  let removed = 0;
  for (const name of names) {
    if (!name.endsWith('.json.enc') || !isExportId(name.slice(0, -'.json.enc'.length))) continue;
    const file = path.join(dir, name);
    const { mtimeMs } = await stat(file);
    if (nowMs - mtimeMs > EXPORT_RETENTION_MS) {
      await unlink(file);
      removed++;
    }
  }
  return removed;
}
