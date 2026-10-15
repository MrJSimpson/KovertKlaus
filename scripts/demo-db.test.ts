import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { validatePassword } from '../src/lib/security';
import { DEMO_AGENTS, DEMO_EMAIL_DOMAIN, generateDemoPassword, isLocalDatabaseUrl } from './demo-db';

test('Demo DB - only local or Docker Compose hosts are accepted', () => {
  assert.strictEqual(isLocalDatabaseUrl('postgresql://localhost:5433/kovertklaus'), true);
  assert.strictEqual(isLocalDatabaseUrl('postgresql://127.0.0.1/kovertklaus'), true);
  assert.strictEqual(isLocalDatabaseUrl('postgresql://kovertklaus-db:5432/kovertklaus'), true);
  assert.strictEqual(isLocalDatabaseUrl('postgresql://ep-cool-name-pooler.us-west-2.aws.neon.tech/neondb'), false);
  assert.strictEqual(isLocalDatabaseUrl('not a url'), false);
  assert.strictEqual(isLocalDatabaseUrl(undefined), false);
});

test('Demo DB - generated passwords pass the app password rules and differ each time', () => {
  const a = generateDemoPassword();
  const b = generateDemoPassword();
  assert.strictEqual(validatePassword(a).isValid, true);
  assert.ok(a.length >= 16);
  assert.notStrictEqual(a, b);
});

test('Demo DB - demo accounts use the reserved .invalid domain and the repo holds no password', () => {
  assert.strictEqual(DEMO_EMAIL_DOMAIN, 'demo.invalid');
  assert.strictEqual(new Set(DEMO_AGENTS.map((a) => a.key)).size, DEMO_AGENTS.length);
  const source = fs.readFileSync(path.join(process.cwd(), 'scripts', 'demo-db.ts'), 'utf-8');
  assert.doesNotMatch(source, /password:\s*['"`]/i);
  assert.match(source, /MODE \|\| ''\)\.toUpperCase\(\) === 'SAAS'/);
  assert.ok(!fs.existsSync(path.join(process.cwd(), 'prisma', 'kovertklaus_test_db.sql')), 'the stale schema dump is gone');
});
