/**
 * @file docker-db-bootstrap.test.ts
 * @description Tests the Docker schema bootstrap's guard paths and its wiring into the image.
 *
 * Tier 1 (what): The opt-out and missing-URL paths, and that the Dockerfile runs the bootstrap
 * before the server and builds the seed bundle it needs.
 * Tier 2 (why): The Docker quickstart started the app on an empty database; this keeps the fix wired.
 * Tier 3 (how): Runs the script with a scrubbed environment (no database needed) and reads the Dockerfile.
 * The database paths are verified end to end against a fresh Postgres container (see the PR).
 */

import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPT = path.join(process.cwd(), 'scripts', 'docker-db-bootstrap.mjs');

function run(env: Record<string, string>): { code: number | null; out: string } {
  const base = { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' };
  const result = spawnSync(process.execPath, [SCRIPT], { env: { ...base, ...env }, encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

test('DB bootstrap - KOVERTKLAUS_DB_BOOTSTRAP=off skips everything and succeeds', () => {
  const { code, out } = run({ KOVERTKLAUS_DB_BOOTSTRAP: 'off' });
  assert.strictEqual(code, 0, out);
  assert.match(out, /skipped/);
});

test('DB bootstrap - no database URL stops startup with a reason', () => {
  const { code, out } = run({});
  assert.strictEqual(code, 1);
  assert.match(out, /No DATABASE_ADMIN_URL, DIRECT_URL or DATABASE_URL/);
});

test('DB bootstrap - the image runs it before the server and ships what it needs', () => {
  const dockerfile = fs.readFileSync(path.join(process.cwd(), 'Dockerfile'), 'utf8');
  assert.match(dockerfile, /CMD \["sh", "-c", "node scripts\/docker-db-bootstrap\.mjs && exec node server\.js"\]/);
  assert.match(dockerfile, /esbuild prisma\/seed\.ts .*--outfile=prisma\/seed\.bundle\.cjs/);
  assert.match(dockerfile, /COPY .*\/app\/prisma\.config\.ts/);
  assert.match(dockerfile, /COPY .*\/app\/scripts\/docker-db-bootstrap\.mjs/);
});
