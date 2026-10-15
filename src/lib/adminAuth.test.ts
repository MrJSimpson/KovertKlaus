import test from 'node:test';
import assert from 'node:assert';
import { createHash } from 'crypto';
import { isRetiredDefaultPassword, RETIRED_DEFAULT_PASSWORD_SHA256, validateNistPassword } from './adminAuth';

test('Admin Auth - retired installation defaults are banned by digest, in any case, with no plaintext in the repo', () => {
  // The real retired passwords are never written down; prove the mechanism with a stand-in.
  const standIn = 'not a real credential';
  const digest = createHash('sha256').update(standIn.toLowerCase()).digest('hex');
  assert.strictEqual(isRetiredDefaultPassword(standIn, [digest]), true);
  assert.strictEqual(isRetiredDefaultPassword(standIn.toUpperCase(), [digest]), true);
  assert.strictEqual(isRetiredDefaultPassword('a different passphrase', [digest]), false);

  assert.ok(RETIRED_DEFAULT_PASSWORD_SHA256.length >= 2);
  for (const d of RETIRED_DEFAULT_PASSWORD_SHA256) assert.match(d, /^[0-9a-f]{64}$/);
});

test('Admin Auth - NIST passphrase policy: length, identifier, and a valid passphrase', () => {
  assert.strictEqual(validateNistPassword('short pass').isValid, false);
  assert.strictEqual(validateNistPassword('x'.repeat(129)).isValid, false);
  assert.strictEqual(validateNistPassword('santa likes long walks', 'santa').isValid, false);
  assert.strictEqual(validateNistPassword('correct horse battery staple', 'santa').isValid, true);
});
