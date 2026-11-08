#!/usr/bin/env node
/**
 * @file docker-db-bootstrap.mjs
 * @description Brings the database schema up to date before the Docker app server starts.
 *
 * Tier 1 (what): Runs in the app container before `node server.js` (see Dockerfile `CMD`):
 *   1. `prisma db push` applies the schema in `prisma/schema.prisma` (creates it on a fresh volume,
 *      adds new tables and columns after an upgrade);
 *   2. on the first run only (no `SystemConfig` singleton yet), runs the seed: default themes and
 *      settings, no users.
 * Tier 2 (why): The Docker quickstart (`npm run db:password`, `docker compose up -d`) started the app
 * against an empty database; only the developer start script ran `prisma db push`, from the host.
 * Tier 3 (how): Prisma refuses changes that would lose data unless told otherwise, and this script
 * never tells it otherwise: the container then exits with instructions instead of dropping data.
 * The seed is bundled at image build time (`prisma/seed.bundle.cjs`) and is never re-run on an
 * initialised database, because it also removes legacy mock accounts.
 * Set `KOVERTKLAUS_DB_BOOTSTRAP=off` to manage the schema yourself.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = (message) => console.log(`[db-bootstrap] ${message}`);
const fail = (message) => {
  console.error(`[db-bootstrap] ${message}`);
  process.exit(1);
};

if (process.env.KOVERTKLAUS_DB_BOOTSTRAP === 'off') {
  log('KOVERTKLAUS_DB_BOOTSTRAP=off: schema sync and first-run seed skipped.');
  process.exit(0);
}

const url = process.env.DATABASE_ADMIN_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  fail('No DATABASE_ADMIN_URL, DIRECT_URL or DATABASE_URL is set, so the schema cannot be synced.');
}

// 1. Schema
log('Syncing the database schema (prisma db push)...');
try {
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'db', 'push'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DIRECT_URL: process.env.DIRECT_URL || url },
  });
} catch {
  fail(
    [
      'Schema sync failed; the server will not start until the schema matches this version.',
      '  If Prisma warned about data loss, back up first (export-db), then apply the change yourself:',
      '    docker compose run --rm kovertklaus-app node node_modules/prisma/build/index.js db push --accept-data-loss',
      '  Connection errors: check that kovertklaus-db is healthy and POSTGRES_PASSWORD in .env is the one it was created with.',
    ].join('\n')
  );
}

// 2. First-run seed
const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: url });
let initialised = false;
try {
  await client.connect();
  const result = await client.query(`SELECT 1 FROM admin."SystemConfig" WHERE id = 'singleton'`);
  initialised = result.rowCount > 0;
} catch (error) {
  fail(`Could not check for existing settings: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await client.end().catch(() => {});
}

if (initialised) {
  log('Database already initialised; seed skipped.');
} else {
  log('First run: seeding default themes and settings (no users)...');
  try {
    execFileSync(process.execPath, [path.join(root, 'prisma', 'seed.bundle.cjs')], { cwd: root, stdio: 'inherit' });
  } catch {
    fail('Seeding failed; see the error above.');
  }
}
log('Database ready.');
