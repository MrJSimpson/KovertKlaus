import test from 'node:test';
import assert from 'node:assert';
import { validateNistPassword } from './adminAuth';

test('Admin Auth - retired installation defaults are permanently rejected (any case)', () => {
  for (const retired of ['G!v!nGSp1r1t', 'g!v!ngsp1r1t', '1SecretDel!very']) {
    const result = validateNistPassword(retired);
    assert.strictEqual(result.isValid, false, `${retired} must be rejected`);
  }
});

test('Admin Auth - NIST passphrase policy: length, identifier, and a valid passphrase', () => {
  assert.strictEqual(validateNistPassword('short pass').isValid, false);
  assert.strictEqual(validateNistPassword('x'.repeat(129)).isValid, false);
  assert.strictEqual(validateNistPassword('santa likes long walks', 'santa').isValid, false);
  assert.strictEqual(validateNistPassword('correct horse battery staple', 'santa').isValid, true);
});
