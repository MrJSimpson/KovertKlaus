import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_THEME_SEASON, THEME_SEASONS, toThemeSeason } from './season';

test('Season: theme seasons pass through, any case', () => {
  for (const s of THEME_SEASONS) {
    assert.equal(toThemeSeason(s), s);
    assert.equal(toThemeSeason(s.toUpperCase()), s);
  }
});

test('Season: database names map to theme seasons', () => {
  assert.equal(toThemeSeason('summer'), 'tropic');
  assert.equal(toThemeSeason('autumn'), 'spooky');
  assert.equal(toThemeSeason(' Autumn '), 'spooky');
  assert.equal(toThemeSeason('universal'), 'winter');
});

test('Season: missing or unknown values fall back to winter', () => {
  for (const v of [undefined, null, '', 'auto', 'monsoon', '"><script>']) {
    assert.equal(toThemeSeason(v), DEFAULT_THEME_SEASON);
  }
});
