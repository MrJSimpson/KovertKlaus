import test from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The `db` / `adminDb` proxies (src/lib/db.ts, src/lib/adminDb.ts) wrap every model call in an
 * async retry function, so `db.model.op()` starts running immediately and is not a Prisma promise.
 * The array form `$transaction([...])` therefore throws after its writes have already happened,
 * non-atomically. Only the callback form `$transaction(async (tx) => …)` is safe.
 */

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

test('DB transactions - every $transaction uses the callback form', () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\.\$transaction\(\s*([^\s])/g)) {
      const rest = text.slice(match.index! + match[0].length - 1);
      const callback = /^(async\b|\(|function\b|arg\b)/.test(rest);
      if (!callback) {
        const line = text.slice(0, match.index).split('\n').length;
        offenders.push(`${relative(SRC, file)}:${line}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `Use $transaction(async (tx) => …) instead of the array form:\n${offenders.join('\n')}`);
});
