#!/usr/bin/env node
/**
 * @file ensure-db-password.mjs
 * @description Makes sure the local Docker install has its own secrets in `.env`, without any in the repo.
 *
 * Tier 1 (what): Run by the start scripts (and `npm run db:password`). It ensures two values in `.env`:
 *   - `SESSION_SECRET`: if it is missing (and no `NEXTAUTH_SECRET` stands in) or is a public placeholder
 *     (the code's development default or the `.env.example` value), a random one is written;
 *   - `POSTGRES_PASSWORD`: if it is missing,
 *       - a fresh install (no `kovertklaus_postgres_data` volume) gets a random password, written to
 *         `.env` with a matching local `DATABASE_URL` / `DIRECT_URL` if those are missing;
 *       - an existing install reuses the password from its local `DATABASE_URL` in `.env`;
 *       - an existing install with no such URL is told to add its current password once, and the script
 *         exits non-zero so Docker does not start with the wrong password.
 * Tier 2 (why): The repo shipped a fixed local database password (a public repository; the project rule
 * is zero credentials in git), and Docker installs signed sessions with the public development secret
 * because docker-compose.yml never passed `SESSION_SECRET` to the app. Postgres only sets the password
 * when its data volume is first created, so existing installs must keep theirs.
 * Tier 3 (how): Node only, no dependencies, works on Windows, macOS and Linux. No secret is ever printed.
 * docker-compose.yml reads both values from `.env` and refuses to start without them.
 */

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env');
// KK_DB_VOLUME overrides the name (tests, or a compose project in a renamed folder).
const VOLUME = process.env.KK_DB_VOLUME || 'kovertklaus_postgres_data';

/**
 * SHA-256 digests of session secrets anyone can read in the repo (development default, `.env.example`
 * placeholder). Keep in sync with `PUBLIC_SESSION_SECRET_DIGESTS` in src/lib/security.ts.
 */
const PUBLIC_SESSION_SECRET_DIGESTS = new Set([
  '90fc02370db9c2e53c530590ee1d97dff4aadcae61b718d996af513bf8d408d2',
  '95e9e74541fee747a0273a19d45364bb0803c0b35faa51ecc3fef24c43063b53',
]);
const isPublicSecret = (value) => PUBLIC_SESSION_SECRET_DIGESTS.has(createHash('sha256').update(value).digest('hex'));

const lines = existsSync(envFile) ? readFileSync(envFile, 'utf8').split(/\r?\n/) : [];
const indexOf = (key) => lines.findIndex((l) => l.trim().startsWith(`${key}=`));
const get = (key) => {
  const i = indexOf(key);
  return i >= 0 ? lines[i].slice(lines[i].indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
};

const append = [];
let changed = false;

/** Writes `.env` if anything changed (existing lines kept, additions appended). */
function save() {
  if (!changed) return;
  writeFileSync(envFile, [...lines.filter((l, i) => !(i === lines.length - 1 && l === '')), ...append, ''].join('\n'));
}

// 1. Session signing secret
const sessionSecret = get('SESSION_SECRET');
const nextAuthSecret = get('NEXTAUTH_SECRET');
const standIn = !sessionSecret && nextAuthSecret && !isPublicSecret(nextAuthSecret);
if (standIn) {
  console.log('[db-password] SESSION_SECRET is not set; NEXTAUTH_SECRET is used instead (left as is).');
} else if (!sessionSecret || isPublicSecret(sessionSecret)) {
  const line = `SESSION_SECRET="${randomBytes(32).toString('base64url')}"`;
  const i = indexOf('SESSION_SECRET');
  if (i >= 0) {
    lines[i] = line;
    console.log('[db-password] Replaced the public placeholder SESSION_SECRET in .env with a random one.');
  } else {
    append.push('', '# Session signing secret, generated for this install. Keep it out of git.', line);
    console.log('[db-password] Generated a SESSION_SECRET in .env.');
  }
  changed = true;
} else {
  console.log('[db-password] SESSION_SECRET is set in .env.');
}

// 2. Local database password
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

if (get('POSTGRES_PASSWORD')) {
  console.log('[db-password] POSTGRES_PASSWORD is set in .env.');
} else if (volumeExists()) {
  const reused = passwordFromUrl(get('DATABASE_URL')) || passwordFromUrl(get('DIRECT_URL'));
  if (!reused) {
    save();
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
  changed = true;
  console.log('[db-password] Existing database: reused the password from your local DATABASE_URL.');
} else {
  const password = randomBytes(18).toString('hex');
  append.push('', '# Local Docker database password, generated for this install. Keep it out of git.', `POSTGRES_PASSWORD=${password}`);
  const url = `postgresql://kovert:${password}@localhost:5433/kovertklaus?schema=public`;
  if (!get('DATABASE_URL')) append.push(`DATABASE_URL="${url}"`);
  if (!get('DIRECT_URL')) append.push(`DIRECT_URL="${url}"`);
  changed = true;
  console.log('[db-password] Fresh install: generated a database password in .env.');
}

save();
