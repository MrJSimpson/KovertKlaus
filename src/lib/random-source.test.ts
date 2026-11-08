/**
 * @file random-source.test.ts
 * @description Guards the rule that all randomness comes from the CSPRNG.
 *
 * Tier 1 (what): Tests `randomHex` and fails if any source file calls the engine's default PRNG.
 * Tier 2 (why): A silent non-cryptographic fallback once sat behind KDM invitation keys, and
 * SECURITY.md promises the codebase does not use it. This test keeps that promise checkable.
 * Tier 3 (how): Scans `src/` and `scripts/` for a call pattern built at runtime, so this file
 * does not match itself.
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { randomHex } from './security';

const SOURCE_DIRS = ['src', 'scripts'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const DEFAULT_PRNG_CALL = new RegExp(['Math', 'random'].join('\\.') + '\\s*\\(');

test('randomHex - returns CSPRNG hex of the requested length', () => {
  for (const byteLength of [1, 3, 4, 6, 16]) {
    const value = randomHex(byteLength);
    assert.match(value, new RegExp(`^[0-9a-f]{${byteLength * 2}}$`));
  }
});

test('randomHex - successive values differ', () => {
  const values = new Set(Array.from({ length: 200 }, () => randomHex(8)));
  assert.strictEqual(values.size, 200);
});

test('randomHex - rejects a non-positive or fractional length', () => {
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => randomHex(bad), RangeError);
  }
});

test('Random source - no source file calls the default non-cryptographic PRNG', () => {
  const root = process.cwd();
  const offenders: string[] = [];

  for (const dir of SOURCE_DIRS) {
    const entries = fs.readdirSync(path.join(root, dir), { recursive: true, encoding: 'utf8' });
    for (const entry of entries) {
      if (!SOURCE_EXTENSIONS.has(path.extname(entry))) continue;
      const file = path.join(dir, entry);
      const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (DEFAULT_PRNG_CALL.test(line)) offenders.push(`${file}:${index + 1}`);
      });
    }
  }

  assert.deepStrictEqual(offenders, [], `Use randomHex / getSecureRandomInt from src/lib/security.ts instead: ${offenders.join(', ')}`);
});
