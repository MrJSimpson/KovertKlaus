import test from 'node:test';
import assert from 'node:assert';
import {
  announceSetupToken,
  digestSetupToken,
  hasActiveSetupToken,
  issueSetupToken,
  revokeSetupToken,
  verifySetupToken,
} from './adminSetup';

test('Admin Setup - issued token verifies exactly and only itself', () => {
  const token = issueSetupToken();
  assert.ok(token.length >= 43, 'token carries 256 bits of entropy (base64url)');
  assert.strictEqual(verifySetupToken(token), true);
  assert.strictEqual(verifySetupToken(`  ${token}  `), true, 'surrounding whitespace from copy/paste is tolerated');
  assert.strictEqual(verifySetupToken(token.slice(0, -1)), false);
  assert.strictEqual(verifySetupToken(`${token}x`), false);
  assert.strictEqual(verifySetupToken(''), false);
  assert.strictEqual(verifySetupToken(undefined), false);
  assert.strictEqual(verifySetupToken('a'.repeat(300)), false, 'oversized input is rejected before hashing');
  revokeSetupToken();
});

test('Admin Setup - reissuing invalidates the previous token', () => {
  const first = issueSetupToken();
  const second = issueSetupToken();
  assert.notStrictEqual(first, second);
  assert.strictEqual(verifySetupToken(first), false);
  assert.strictEqual(verifySetupToken(second), true);
  revokeSetupToken();
});

test('Admin Setup - revoked token can never be used again', () => {
  const token = issueSetupToken();
  revokeSetupToken();
  assert.strictEqual(hasActiveSetupToken(), false);
  assert.strictEqual(verifySetupToken(token), false);
});

test('Admin Setup - announce is idempotent within a process and keeps the first token valid', () => {
  revokeSetupToken();
  const logged: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => { logged.push(args.join(' ')); };
  try {
    announceSetupToken();
    announceSetupToken();
  } finally {
    console.log = original;
  }
  assert.strictEqual(logged.length, 1, 'banner printed once');
  const printed = logged[0].match(/^\s{3}(\S+)$/m)?.[1];
  assert.ok(printed, 'banner contains the token on its own line');
  assert.strictEqual(verifySetupToken(printed), true);
  revokeSetupToken();
});

test('Admin Setup - only the digest is stored, never the plaintext token', () => {
  const token = issueSetupToken();
  const stored = JSON.stringify((globalThis as Record<string, unknown>).__kovertklausAdminSetupToken);
  assert.ok(!stored.includes(token), 'plaintext token is not retained');
  assert.strictEqual(digestSetupToken(token).length, 32);
  revokeSetupToken();
});
