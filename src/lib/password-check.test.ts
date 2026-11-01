import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { BREACHED_PASSWORD_MESSAGE, checkNewPassword, HIBP_RANGE_URL, isBreachedPassword, validatePasswordRules } from './password-check';
import { normalizePassword, PASSWORD_CHECKLIST, passwordLength } from './password-policy';
import { comparePassword, hashPassword } from './password';

const GOOD = ['snowy', 'owl', 'tea', 'party'].join(' ');

/** A fake HIBP that knows `breached` and pads with zero-count lines. */
function fakeHibp(breached: string[]) {
  const asked: string[] = [];
  const impl = (async (url: string) => {
    asked.push(url);
    const prefix = url.slice(HIBP_RANGE_URL.length);
    const lines = breached
      .map((p) => crypto.createHash('sha1').update(normalizePassword(p)).digest('hex').toUpperCase())
      .filter((h) => h.startsWith(prefix))
      .map((h) => `${h.slice(5)}:42`);
    lines.push('0000000000000000000000000000000000A:0'); // padding
    return new Response(lines.join('\r\n'), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, asked };
}

test('Password rules - 10 characters minimum, no composition rules, passphrases welcome', () => {
  assert.strictEqual(validatePasswordRules('Short1!').isValid, false);
  assert.match(String(validatePasswordRules('nine-char').error), /at least 10 characters/);
  for (const ok of [GOOD, 'alllowercaseletters', 'ALLUPPERCASELETTERS', 'Klaus2026!Security', 'été à la plage']) {
    assert.strictEqual(validatePasswordRules(ok).isValid, true, ok);
  }
  assert.strictEqual(validatePasswordRules('x'.repeat(7) + 'abc' + 'y'.repeat(119)).isValid, false, 'over 128');
});

test('Password rules - length counts characters, not bytes, after normalization', () => {
  assert.strictEqual(passwordLength('🎄🎄🎄🎄🎄🎁🎁🎁🎁'), 9);
  assert.strictEqual(validatePasswordRules('🎄🎄🎄🎄🎄🎁🎁🎁🎁').isValid, false, '9 emoji is 9 characters');
  const decomposed = 'café au lait'; // é typed as e + combining accent
  assert.strictEqual(passwordLength(decomposed), 12);
});

test('Password rules - common, trivial and contextual passwords are refused', () => {
  for (const bad of ['password123', 'Password123!', 'QWERTYUIOP', '1234567890', 'secretsanta', 'aaaaaaaaaaaa', 'abababababab', 'abcdefghijk', '9876543210']) {
    assert.strictEqual(validatePasswordRules(bad).isValid, false, bad);
  }
  assert.match(String(validatePasswordRules('my kovertklaus pw!').error), /KovertKlaus/);
  assert.strictEqual(validatePasswordRules('hollyberry-2026', { email: 'hollyberry@example.com' }).isValid, false, 'email name');
  assert.strictEqual(validatePasswordRules('ivy-snowfall-99', { name: 'Ivy Snowfall' }).isValid, false, 'own name');
  assert.strictEqual(validatePasswordRules('ivy-snowfall-99', { name: 'Ivy', email: 'x@y.z' }).isValid, true, 'short name parts ignored');
});

test('Breach check - sends only a 5-character prefix with padding, matches locally', async () => {
  const { impl, asked } = fakeHibp(['correct horse battery']);
  assert.strictEqual(await isBreachedPassword('correct horse battery', impl), true);
  assert.strictEqual(await isBreachedPassword(GOOD, impl), false);
  for (const url of asked) {
    assert.match(url, /^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/);
    assert.ok(!url.includes('horse'));
  }
});

test('Breach check - fails open on errors, bad replies and timeouts', async () => {
  const quiet = console.warn;
  console.warn = () => {};
  try {
    const down = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    assert.strictEqual(await isBreachedPassword(GOOD, down), false);
    const error500 = (async () => new Response('oops', { status: 500 })) as unknown as typeof fetch;
    assert.strictEqual(await isBreachedPassword(GOOD, error500), false);
    const slow = ((_: string, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch;
    assert.strictEqual(await isBreachedPassword(GOOD, slow, 20), false);
  } finally {
    console.warn = quiet;
  }
});

test('checkNewPassword - rules first, then the breach check', async () => {
  const { impl, asked } = fakeHibp(['correct horse battery']);
  assert.strictEqual((await checkNewPassword('short', {}, { fetchImpl: impl })).isValid, false);
  assert.strictEqual(asked.length, 0, 'no network call for a rule failure');
  assert.deepStrictEqual(await checkNewPassword('correct horse battery', {}, { fetchImpl: impl }), { isValid: false, error: BREACHED_PASSWORD_MESSAGE });
  assert.deepStrictEqual(await checkNewPassword(GOOD, {}, { fetchImpl: impl }), { isValid: true });
});

test('Hashing - the same password typed with a decomposed accent still matches; older hashes still work', async () => {
  const composed = 'café au lait 2026';
  const decomposed = 'café au lait 2026';
  const hash = await hashPassword(decomposed);
  assert.strictEqual(await comparePassword(composed, hash), true);
  assert.strictEqual(await comparePassword(decomposed, hash), true);
  // A hash made before normalization (raw decomposed bytes) still verifies.
  const salt = crypto.randomBytes(16);
  const raw = crypto.scryptSync(decomposed, salt, 64, { N: 16384, r: 8, p: 1 });
  const legacy = `$scrypt$16384$8$1$${salt.toString('hex')}$${raw.toString('hex')}`;
  assert.strictEqual(await comparePassword(decomposed, legacy), true);
  assert.strictEqual(await comparePassword('wrong password!', hash), false);
});

test('Checklist - what the forms show matches the rules', () => {
  const [length, leaked] = PASSWORD_CHECKLIST;
  assert.strictEqual(length.test?.('123456789'), false);
  assert.strictEqual(length.test?.(GOOD), true);
  assert.strictEqual(leaked.test, null, 'checked by the server on save');
});
