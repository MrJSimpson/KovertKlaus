#!/usr/bin/env node
/**
 * @file ensure-db-password.mjs
 * @description Makes sure the local Docker database has a password in `.env`, without one in the repo.
 *
 * Tier 1 (what): Run by the start scripts (and `npm run db:password`). If `.env` already has
 * `POSTGRES_PASSWORD`, it does nothing. Otherwise:
 *   - a fresh install (no `kovertklaus_postgres_data` volume) gets a random password, written to
 *     `.env` with a matching local `DATABASE_URL` / `DIRECT_URL` if those are missing;
 *   - an existing install reuses the password from its local `DATABASE_URL` in `.env`;
 *   - an existing install with no such URL is told to add its current password once, and the script
 *     exits non-zero so Docker does not start with the wrong password.
 * Tier 2 (why): The repo shipped a fixed local database password in docker-compose.yml, .env.example and
 * the docs (a public repository; the project rule is zero credentials in git). Postgres only sets the
 * password when its data volume is first created, so existing installs must keep theirs.
 * Tier 3 (how): Node only, no dependencies, works on Windows, macOS and Linux. The password is never
 * printed. docker-compose.yml reads `POSTGRES_PASSWORD` from `.env` and refuses to start without it.
 */

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env');
// KK_DB_VOLUME overrides the name (tests, or a compose project in a renamed folder).
const VOLUME = process.env.KK_DB_VOLUME || 'kovertklaus_postgres_data';

const lines = existsSync(envFile) ? readFileSync(envFile, 'utf8').split(/\r?\n/) : [];
const get = (key) => {
  const line = lines.find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
};

if (get('POSTGRES_PASSWORD')) {
  console.log('[db-password] POSTGRES_PASSWORD is set in .env.');
  process.exit(0);
}

function volumeExists() {
  try {
    execFileSync('docker', ['volume', 'inspect', VOLUME], { stdio: 'ignore' });
    return true;
  } catch {
    return false; // no volume, or Docker not installed/running
  }
}

/** The password inside a local postgres URL (kovert user, localhost or the compose host). */
function passwordFromUrl(url) {
  try {
    const u = new URL(url);
    const local = ['localhost', '127.0.0.1', 'kovertklaus-db'].includes(u.hostname);
    return local && u.username === 'kovert' && u.password ? decodeURIComponent(u.password) : '';
  } catch {
    return '';
  }
}

const append = [];
if (volumeExists()) {
  const reused = passwordFromUrl(get('DATABASE_URL')) || passwordFromUrl(get('DIRECT_URL'));
  if (!reused) {
    console.error(
      [
        '[db-password] An existing KovertKlaus database volume was found, but .env has no POSTGRES_PASSWORD.',
        '  Add one line to .env with the password this database was created with:',
        '    POSTGRES_PASSWORD=<your current database password>',
        '  Installs set up before 1.1.0 used the default from that version\'s docker-compose.yml.',
      ].join('\n')
    );
    process.exit(1);
  }
  append.push('', '# Local Docker database password (kept from your existing DATABASE_URL).', `POSTGRES_PASSWORD=${reused}`);
  console.log('[db-password] Existing database: reused the password from your local DATABASE_URL.');
} else {
  const password = randomBytes(18).toString('hex');
  append.push('', '# Local Docker database password, generated for this install. Keep it out of git.', `POSTGRES_PASSWORD=${password}`);
  const url = `postgresql://kovert:${password}@localhost:5433/kovertklaus?schema=public`;
  if (!get('DATABASE_URL')) append.push(`DATABASE_URL="${url}"`);
  if (!get('DIRECT_URL')) append.push(`DIRECT_URL="${url}"`);
  console.log('[db-password] Fresh install: generated a database password in .env.');
}

writeFileSync(envFile, [...lines.filter((l, i) => !(i === lines.length - 1 && l === '')), ...append, ''].join('\n'));
