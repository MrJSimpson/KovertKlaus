import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { APP_VERSION, APP_VERSION_LABEL } from './version';
import { ANNOUNCEMENTS, hasUnseenAnnouncement, LATEST_ANNOUNCEMENT_VERSION } from './announcements';

// docs/VERSIONING.md: package.json is the source of truth; everything else must match it.
const root = process.cwd();

test('Versioning - package.json, version.ts, CHANGELOG and announcements agree', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
  assert.strictEqual(APP_VERSION, pkg.version);
  assert.strictEqual(APP_VERSION_LABEL, `v${pkg.version}`);

  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf-8');
  const firstRelease = changelog.match(/^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\] - \d{4}-\d{2}-\d{2}$/m);
  assert.ok(firstRelease, 'CHANGELOG.md has a released version section');
  assert.strictEqual(firstRelease[1], pkg.version, 'newest CHANGELOG section is the current version');
  assert.match(changelog, /^## \[Unreleased\]$/m);

  assert.strictEqual(LATEST_ANNOUNCEMENT_VERSION, pkg.version, 'every release adds an announcement');
});

test('Versioning - versions follow the protocol format', () => {
  assert.match(APP_VERSION, /^(0\.\d+\.\d+-alpha|1\.0\.0-beta\.\d+|\d+\.\d+\.\d+)$/);
});

test('Announcements - newest first, unique versions, valid dates, the dot clears once seen', () => {
  const versions = ANNOUNCEMENTS.map((a) => a.version);
  assert.strictEqual(new Set(versions).size, versions.length);
  const dates = ANNOUNCEMENTS.map((a) => a.date);
  for (const d of dates) assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepStrictEqual([...dates].sort().reverse(), dates);
  for (const a of ANNOUNCEMENTS) assert.ok(a.highlights.length > 0);
  assert.strictEqual(hasUnseenAnnouncement(null), true);
  assert.strictEqual(hasUnseenAnnouncement(LATEST_ANNOUNCEMENT_VERSION), false);
});
