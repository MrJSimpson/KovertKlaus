import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRandomCodename,
  resolveUniqueCodename,
  TACTICAL_PREFIXES,
  TACTICAL_SUFFIXES,
} from './codename';

test('Tactical Callsign Generator & Collision Resolver Test Suite', async (t) => {
  await t.test('generateRandomCodename produces valid Prefix-Suffix formatted names', () => {
    for (let i = 0; i < 20; i++) {
      const name = generateRandomCodename();
      const parts = name.split('-');
      assert.ok(parts.length >= 2, `Expected hyphenated name, got: ${name}`);
      assert.ok(
        (TACTICAL_PREFIXES as readonly string[]).includes(parts[0]),
        `Expected valid prefix, got: ${parts[0]}`
      );
      assert.ok(
        (TACTICAL_SUFFIXES as readonly string[]).includes(parts[1]),
        `Expected valid suffix, got: ${parts[1]}`
      );
    }
  });

  await t.test('generateRandomCodename avoids existing roster names', () => {
    const existing = ['Frost-Viper', 'Shadow-Fox', 'Blizzard-Wolf'];
    for (let i = 0; i < 30; i++) {
      const generated = generateRandomCodename(existing);
      assert.ok(!existing.includes(generated), `Generated name ${generated} collided with existing roster!`);
    }
  });

  await t.test('resolveUniqueCodename accepts non-colliding preferred name', () => {
    const roster = ['PapaBear', 'GingerbreadSniper'];
    const result = resolveUniqueCodename('NightOwl', roster, false);

    assert.equal(result.codename, 'NightOwl');
    assert.equal(result.wasCollided, false);
    assert.equal(result.isRandomized, false);
    assert.equal(result.suggestions.length, 0);
  });

  await t.test('resolveUniqueCodename detects collision and generates smart suggestions', () => {
    const roster = ['NightOwl', 'GingerbreadSniper'];
    const result = resolveUniqueCodename('NightOwl', roster, false);

    assert.equal(result.wasCollided, true);
    assert.equal(result.isRandomized, false);
    assert.ok(result.suggestions.length >= 2);
    // Primary suggestion should be NightOwl-2
    assert.equal(result.suggestions[0], 'NightOwl-2');
  });

  await t.test('resolveUniqueCodename handles autoRandomize stealth mode', () => {
    const roster = ['NightOwl'];
    const result = resolveUniqueCodename('NightOwl', roster, true);

    assert.equal(result.isRandomized, true);
    assert.equal(result.wasCollided, false);
    assert.notEqual(result.codename, 'NightOwl');
    assert.ok(result.codename.includes('-'));
  });

  await t.test('resolveUniqueCodename handles empty/null requested names', () => {
    const result = resolveUniqueCodename('', [], false);
    assert.equal(result.isRandomized, true);
    assert.ok(result.codename.length > 3);
  });
});
