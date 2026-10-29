import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { APP_VERSION, APP_VERSION_LABEL } from './version';
import { announcementKey, ANNOUNCEMENTS, hasUnseenAnnouncement, LATEST_ANNOUNCEMENT_VERSION, latestAnnouncementKey, visibleAnnouncements } from './announcements';

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

test('Announcements - newest first, unique keys, valid dates, the dot clears once seen', () => {
  const keys = ANNOUNCEMENTS.map(announcementKey);
  assert.strictEqual(new Set(keys).size, keys.length);
  const dates = ANNOUNCEMENTS.map((a) => a.date);
  for (const d of dates) assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepStrictEqual([...dates].sort().reverse(), dates);
  for (const a of ANNOUNCEMENTS) assert.ok(a.highlights.length > 0);
  assert.strictEqual(hasUnseenAnnouncement(null), true);
  assert.strictEqual(hasUnseenAnnouncement(LATEST_ANNOUNCEMENT_VERSION), false);
});

test('Announcements - a staged entry shows only at its stage, and flipping the stage relights the dot', () => {
  assert.ok(visibleAnnouncements('ALPHA').every((a) => !a.stage), 'nothing staged leaks into alpha');
  assert.strictEqual(visibleAnnouncements('ALPHA')[0].version, LATEST_ANNOUNCEMENT_VERSION);
  const beta = visibleAnnouncements('BETA')[0];
  assert.strictEqual(beta.stage, 'BETA');
  assert.strictEqual(latestAnnouncementKey('BETA'), `${beta.version}+beta`);
  // An agent who opened the alpha notes sees the dot again once the stage is BETA.
  assert.strictEqual(hasUnseenAnnouncement(latestAnnouncementKey('ALPHA'), 'BETA'), true);
  assert.strictEqual(hasUnseenAnnouncement(latestAnnouncementKey('BETA'), 'BETA'), false);
});
