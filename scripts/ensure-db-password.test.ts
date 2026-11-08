import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Runs the script in a scratch project folder with no Docker volume of that name. */
function run(dir: string): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [path.join(dir, 'scripts', 'ensure-db-password.mjs')], {
      env: { ...process.env, KK_DB_VOLUME: `kk-test-missing-${process.pid}` },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}

function scratch(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'kk-dbpw-'));
  mkdirSync(path.join(dir, 'scripts'));
  copyFileSync(path.join(process.cwd(), 'scripts', 'ensure-db-password.mjs'), path.join(dir, 'scripts', 'ensure-db-password.mjs'));
  return dir;
}

test('DB password - a fresh install gets a random password and matching local URLs; a rerun changes nothing', () => {
  const dir = scratch();
  try {
    writeFileSync(path.join(dir, '.env'), 'NODE_ENV=development\n');
    const first = run(dir);
    assert.strictEqual(first.code, 0, first.out);
    const env = readFileSync(path.join(dir, '.env'), 'utf8');
    const pw = env.match(/^POSTGRES_PASSWORD=(.+)$/m)?.[1] ?? '';
    assert.match(pw, /^[0-9a-f]{36}$/);
    assert.ok(env.includes(`DATABASE_URL="postgresql://kovert:${pw}@localhost:5433/kovertklaus?schema=public"`));
    assert.ok(env.startsWith('NODE_ENV=development\n'), 'existing lines kept');
    assert.ok(!first.out.includes(pw), 'the password is never printed');

    const again = run(dir);
    assert.strictEqual(again.code, 0);
    assert.strictEqual(readFileSync(path.join(dir, '.env'), 'utf8'), env, 'unchanged on rerun');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('DB password - an existing DATABASE_URL is left alone on a fresh install', () => {
  const dir = scratch();
  try {
    writeFileSync(path.join(dir, '.env'), 'DATABASE_URL="postgresql://someone@db.example.com/other"\n');
    assert.strictEqual(run(dir).code, 0);
    const env = readFileSync(path.join(dir, '.env'), 'utf8');
    assert.strictEqual((env.match(/^DATABASE_URL=/gm) ?? []).length, 1);
    assert.match(env, /^POSTGRES_PASSWORD=[0-9a-f]{36}$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Session secret - a fresh .env gets a random SESSION_SECRET that is never printed', () => {
  const dir = scratch();
  try {
    writeFileSync(path.join(dir, '.env'), 'NODE_ENV=development\n');
    const first = run(dir);
    assert.strictEqual(first.code, 0, first.out);
    const env = readFileSync(path.join(dir, '.env'), 'utf8');
    const secret = env.match(/^SESSION_SECRET="(.+)"$/m)?.[1] ?? '';
    assert.match(secret, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(!first.out.includes(secret), 'the secret is never printed');
    assert.strictEqual(run(dir).code, 0);
    assert.strictEqual(readFileSync(path.join(dir, '.env'), 'utf8'), env, 'unchanged on rerun');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Session secret - the .env.example placeholder is replaced in place; a real secret is kept', () => {
  const dir = scratch();
  try {
    const exampleLine = readFileSync(path.join(process.cwd(), '.env.example'), 'utf8').match(/^SESSION_SECRET=.*$/m)?.[0] ?? '';
    assert.ok(exampleLine, '.env.example has a SESSION_SECRET line');
    writeFileSync(path.join(dir, '.env'), `A=1\n${exampleLine}\nB=2\n`);
    assert.strictEqual(run(dir).code, 0);
    const lines = readFileSync(path.join(dir, '.env'), 'utf8').split('\n');
    assert.strictEqual(lines[0], 'A=1');
    assert.match(lines[1], /^SESSION_SECRET="[A-Za-z0-9_-]{43}"$/);
    assert.strictEqual(lines[2], 'B=2');
    assert.strictEqual(lines.filter((l) => l.startsWith('SESSION_SECRET=')).length, 1);

    writeFileSync(path.join(dir, '.env'), 'SESSION_SECRET="an-operator-chosen-secret-value-0123456789"\nPOSTGRES_PASSWORD=x\n');
    assert.strictEqual(run(dir).code, 0);
    assert.strictEqual(readFileSync(path.join(dir, '.env'), 'utf8'), 'SESSION_SECRET="an-operator-chosen-secret-value-0123456789"\nPOSTGRES_PASSWORD=x\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Session secret - a real NEXTAUTH_SECRET stands in, so no new secret signs everyone out', () => {
  const dir = scratch();
  try {
    writeFileSync(path.join(dir, '.env'), 'NEXTAUTH_SECRET="an-operator-chosen-secret-value-0123456789"\nPOSTGRES_PASSWORD=x\n');
    assert.strictEqual(run(dir).code, 0);
    assert.ok(!readFileSync(path.join(dir, '.env'), 'utf8').includes('SESSION_SECRET='));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
