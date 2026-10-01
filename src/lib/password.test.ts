import test from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import {
  hashPassword,
  comparePassword,
  verifyDummyPassword,
  isLegacyBcryptHash,
  DUMMY_PASSWORD_HASH,
} from './password';

test('Password Security & Scrypt Engine Test Suite', async (t) => {
  await t.test('hashPassword produces well-formed $scrypt$ Modular Crypt Format string', async () => {
    const rawPass = 'V@lidP@ssw0rd!2026';
    const hash = await hashPassword(rawPass);

    assert.strictEqual(typeof hash, 'string');
    assert.ok(hash.startsWith('$scrypt$1024$8$1$'), `Expected prefix $scrypt$1024$8$1$, got: ${hash}`);

    const parts = hash.split('$');
    assert.strictEqual(parts.length, 7, 'Expected 7 parts in MCF string');
    assert.strictEqual(parts[2], '1024'); // N
    assert.strictEqual(parts[3], '8');    // r
    assert.strictEqual(parts[4], '1');    // p
    assert.strictEqual(parts[5].length, 32, 'Salt hex must be 16 bytes = 32 hex chars');
    assert.strictEqual(parts[6].length, 64, 'Hash hex must be 32 bytes = 64 hex chars');
  });

  await t.test('comparePassword successfully verifies valid password against scrypt hash', async () => {
    const rawPass = 'KovertKlaus#SafeEdge2026';
    const hash = await hashPassword(rawPass);

    const isMatch = await comparePassword(rawPass, hash);
    assert.strictEqual(isMatch, true, 'Valid password should verify successfully');
  });

  await t.test('comparePassword rejects incorrect password against scrypt hash', async () => {
    const rawPass = 'CorrectMasterPassword!';
    const hash = await hashPassword(rawPass);

    const isMatch = await comparePassword('IncorrectPassword123!', hash);
    assert.strictEqual(isMatch, false, 'Invalid password must be rejected');
  });

  await t.test('comparePassword handles edge cases gracefully without throwing', async () => {
    assert.strictEqual(await comparePassword('', ''), false);
    assert.strictEqual(await comparePassword('pass', null as any), false);
    assert.strictEqual(await comparePassword('pass', undefined as any), false);
    assert.strictEqual(await comparePassword(null as any, '$scrypt$bad'), false);
    assert.strictEqual(await comparePassword('pass', '$scrypt$not$enough$parts'), false);
    assert.strictEqual(await comparePassword('pass', '$scrypt$abc$def$ghi$invalid$hex'), false);
  });

  await t.test('comparePassword maintains backward-compatibility with legacy bcrypt hashes', async () => {
    const rawPass = 'LegacyBcryptOperativePass!';
    // Work factor 6 for rapid test execution
    const legacyBcryptHash = await bcrypt.hash(rawPass, 6);

    assert.ok(isLegacyBcryptHash(legacyBcryptHash), 'Should identify legacy bcrypt hash');

    const matchSuccess = await comparePassword(rawPass, legacyBcryptHash);
    assert.strictEqual(matchSuccess, true, 'Legacy bcrypt hash must match valid password');

    const matchFailure = await comparePassword('WrongPassword!', legacyBcryptHash);
    assert.strictEqual(matchFailure, false, 'Legacy bcrypt hash must reject invalid password');
  });

  await t.test('verifyDummyPassword evaluates in constant-time and returns false', async () => {
    const isMatch = await verifyDummyPassword('RandomAttempt123!');
    assert.strictEqual(isMatch, false, 'Dummy password verification must evaluate to false');
  });

  await t.test('isLegacyBcryptHash correctly differentiates hash types', async () => {
    assert.strictEqual(isLegacyBcryptHash('$2a$12$eImiTXuWVfxh02WpuU.2Te6/k6G4v0S0i56u.0B.y/0x3d.0x.0x'), true);
    assert.strictEqual(isLegacyBcryptHash('$2b$10$somethingvalid'), true);
    assert.strictEqual(isLegacyBcryptHash('$2y$12$anotherbcrypt'), true);
    assert.strictEqual(isLegacyBcryptHash(DUMMY_PASSWORD_HASH), false);
    assert.strictEqual(isLegacyBcryptHash('plaintext'), false);
    assert.strictEqual(isLegacyBcryptHash(''), false);
  });
});
