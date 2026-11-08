/**
 * @file session-secret.test.ts
 * @description Tests that production refuses a missing or public session secret.
 *
 * Tier 1 (what): `getSessionSecret` throws in production for a missing, development-default or
 * `.env.example` secret, and returns real secrets unchanged.
 * Tier 2 (why): The function used to fall back silently to a secret published in this repository,
 * which let anyone forge session cookies on Docker installs.
 * Tier 3 (how): Each case sets `NODE_ENV` / `SESSION_SECRET` / `NEXTAUTH_SECRET` and restores them.
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getSessionSecret } from './security';

/** The public values come from their real sources, so no copy of them lives in this test. */
function publicSecrets(): string[] {
  let developmentDefault = '';
  withEnv({ NODE_ENV: 'development' }, () => {
    developmentDefault = getSessionSecret();
  });
  const example = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');
  const placeholder = example.match(/^SESSION_SECRET="?([^"\n]+)"?$/m)?.[1] ?? '';
  assert.ok(developmentDefault && placeholder, 'both public values found');
  return [developmentDefault, placeholder];
}

/** 64-hex digests listed in a source file's PUBLIC_SESSION_SECRET_DIGESTS declaration. */
function digestsIn(file: string): string[] {
  const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  const block = text.slice(text.indexOf('PUBLIC_SESSION_SECRET_DIGESTS'), text.indexOf(']);', text.indexOf('PUBLIC_SESSION_SECRET_DIGESTS')));
  return (block.match(/[0-9a-f]{64}/g) ?? []).sort();
}

const KEYS = ['NODE_ENV', 'SESSION_SECRET', 'NEXTAUTH_SECRET'] as const;

/** Runs `fn` with the given variables (undefined = unset), then restores the originals. */
function withEnv(values: Partial<Record<(typeof KEYS)[number], string | undefined>>, fn: () => void): void {
  const env = process.env as Record<string, string | undefined>;
  const saved = Object.fromEntries(KEYS.map((k) => [k, env[k]]));
  try {
    for (const key of KEYS) {
      if (values[key] === undefined) delete env[key];
      else env[key] = values[key];
    }
    fn();
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete env[key];
      else env[key] = saved[key];
    }
  }
}

const REAL_SECRET = 'test-only-session-secret-not-used-anywhere-0123';

test('Session secret - production refuses a missing secret', () => {
  withEnv({ NODE_ENV: 'production' }, () => {
    assert.throws(() => getSessionSecret(), /SESSION_SECRET is not set/);
  });
});

test('Session secret - production refuses the public development default and the .env.example placeholder', () => {
  for (const secret of publicSecrets()) {
    withEnv({ NODE_ENV: 'production', SESSION_SECRET: secret }, () => {
      assert.throws(() => getSessionSecret(), /public placeholder/);
    });
    withEnv({ NODE_ENV: 'production', NEXTAUTH_SECRET: secret }, () => {
      assert.throws(() => getSessionSecret(), /public placeholder/);
    });
  }
});

test('Session secret - production returns a real secret, from SESSION_SECRET or NEXTAUTH_SECRET', () => {
  withEnv({ NODE_ENV: 'production', SESSION_SECRET: REAL_SECRET }, () => {
    assert.strictEqual(getSessionSecret(), REAL_SECRET);
  });
  withEnv({ NODE_ENV: 'production', NEXTAUTH_SECRET: REAL_SECRET }, () => {
    assert.strictEqual(getSessionSecret(), REAL_SECRET);
  });
});

test('Session secret - outside production a missing secret falls back to the development default', () => {
  const [developmentDefault] = publicSecrets();
  withEnv({ NODE_ENV: 'development' }, () => {
    assert.strictEqual(getSessionSecret(), developmentDefault);
  });
});

test('Session secret - the app and the setup script ban the same public secrets', () => {
  const inApp = digestsIn('src/lib/security.ts');
  assert.strictEqual(inApp.length, 2);
  assert.deepStrictEqual(digestsIn('scripts/ensure-db-password.mjs'), inApp);
});
