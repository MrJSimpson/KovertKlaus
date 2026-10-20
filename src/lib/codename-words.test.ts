import test from 'node:test';
import assert from 'node:assert/strict';
import { CODENAME_ADJECTIVES, CODENAME_NOUNS } from './codename-words';

/**
 * Words that must never appear in a codename list: relationships and status, explicit terms and
 * innuendo, and colors that could read as describing people. Add to it whenever a word is rejected.
 */
const BLOCKED = new Set([
  // Relationships and status
  'mom', 'mother', 'dad', 'father', 'brother', 'sister', 'son', 'daughter', 'aunt', 'uncle', 'cousin', 'grandma',
  'grandpa', 'wife', 'husband', 'girlfriend', 'boyfriend', 'partner', 'spouse', 'baby', 'babe', 'bride', 'groom',
  'widow', 'boss', 'master', 'mistress', 'maid', 'nurse', 'nun', 'king', 'queen', 'prince', 'princess', 'lord', 'lady',
  // Explicit or innuendo
  'hot', 'sexy', 'naughty', 'wet', 'moist', 'juicy', 'thick', 'hard', 'stiff', 'horny', 'hairy', 'nutty', 'nuts',
  'fruity', 'cheeky', 'frisky', 'kinky', 'saucy', 'spicy', 'sticky', 'creamy', 'busty', 'booty', 'bouncy', 'rusty',
  'trombone', 'beaver', 'cock', 'rooster', 'peacock', 'woodpecker', 'booby', 'tit', 'titmouse', 'swallow', 'shag',
  'cougar', 'vixen', 'stud', 'stallion', 'bunny', 'kitty', 'pussycat', 'camel', 'snake', 'python', 'anaconda', 'eel',
  'wiener', 'sausage', 'banana', 'pole', 'tool', 'shaft', 'muff', 'ho', 'pimp', 'huge', 'lurking', 'creepy',
  'wicked', 'fairy', 'plumber', 'nutcracker', 'ass', 'donkey', 'snowflake', 'wee', 'cardinal', 'goose',
  // Colors that could read as describing people
  'black', 'white', 'red', 'yellow', 'brown',
]);

for (const [label, words] of [['adjectives', CODENAME_ADJECTIVES], ['nouns', CODENAME_NOUNS]] as const) {
  test(`Codename ${label}: one capitalized word each, no hyphens`, () => {
    for (const w of words) assert.match(w, /^[A-Z][a-z]+$/, `"${w}" must be a single capitalized word`);
  });

  test(`Codename ${label}: no duplicates`, () => {
    const seen = new Set<string>();
    for (const w of words) {
      assert.ok(!seen.has(w.toLowerCase()), `"${w}" appears twice`);
      seen.add(w.toLowerCase());
    }
  });

  test(`Codename ${label}: nothing from the blocklist`, () => {
    for (const w of words) assert.ok(!BLOCKED.has(w.toLowerCase()), `"${w}" is blocked`);
  });
}

test('Codename lists: no word is both an adjective and a noun', () => {
  const nouns = new Set(CODENAME_NOUNS.map((n) => n.toLowerCase()));
  for (const a of CODENAME_ADJECTIVES) assert.ok(!nouns.has(a.toLowerCase()), `"${a}" is in both lists`);
});
