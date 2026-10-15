import test from 'node:test';
import assert from 'node:assert';
import { signToken } from './security';
import { issueSessionToken, readSessionToken, verifySessionToken, shouldRenewSession, sessionIssuedAt, isSessionRevoked, SESSION_TTL_SECONDS } from './session-token';

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);
const HOUR_MS = 60 * 60 * 1000;

test('Session Token - a fresh user token verifies as that user', () => {
  const token = issueSessionToken('user', 'cuser123', NOW);
  assert.strictEqual(verifySessionToken(token, 'user', NOW), 'cuser123');
});

test('Session Token - user and admin tokens are not interchangeable', () => {
  assert.strictEqual(verifySessionToken(issueSessionToken('user', 'cuser123', NOW), 'admin', NOW), null);
  assert.strictEqual(verifySessionToken(issueSessionToken('admin', 'cadmin1', NOW), 'user', NOW), null);
});

test('Session Token - tokens expire after their lifetime', () => {
  const user = issueSessionToken('user', 'cuser123', NOW);
  assert.strictEqual(verifySessionToken(user, 'user', NOW + 24 * HOUR_MS - 1000), 'cuser123');
  assert.strictEqual(verifySessionToken(user, 'user', NOW + 24 * HOUR_MS), null);
  const admin = issueSessionToken('admin', 'cadmin1', NOW);
  assert.strictEqual(verifySessionToken(admin, 'admin', NOW + SESSION_TTL_SECONDS.admin * 1000), null);
});

test('Session Token - legacy bare-ID tokens and tampered expiries are rejected', () => {
  assert.strictEqual(verifySessionToken(signToken('cuser123'), 'user', NOW), null);
  const token = issueSessionToken('user', 'cuser123', NOW);
  const [prefix, id, , sig] = token.split('.');
  assert.strictEqual(verifySessionToken(`${prefix}.${id}.99999999999.${sig}`, 'user', NOW), null);
  assert.strictEqual(verifySessionToken(null, 'user', NOW), null);
});

test('Session Token - IDs containing separators are never signed', () => {
  assert.strictEqual(issueSessionToken('user', 'a.b', NOW), '');
});

test('Session Token - user sessions renew past half-life, admin sessions never do', () => {
  const user = readSessionToken(issueSessionToken('user', 'cuser123', NOW), 'user', NOW)!;
  assert.strictEqual(shouldRenewSession(user, 'user', NOW + 11 * HOUR_MS), false);
  assert.strictEqual(shouldRenewSession(user, 'user', NOW + 13 * HOUR_MS), true);
  const admin = readSessionToken(issueSessionToken('admin', 'cadmin1', NOW), 'admin', NOW)!;
  assert.strictEqual(shouldRenewSession(admin, 'admin', NOW + 7 * HOUR_MS), false);
});

test('Session Token - a password change revokes earlier tokens; the token re-issued in that request survives', () => {
  const t0 = Date.parse('2026-10-15T12:00:00Z');
  const before = readSessionToken(issueSessionToken('user', 'user-1', t0), 'user', t0)!;
  assert.strictEqual(sessionIssuedAt(before, 'user'), t0 / 1000);
  assert.strictEqual(isSessionRevoked(before, null), false);

  const changedAt = new Date(t0 + 5 * 60 * 1000 + 400); // password changed 5 minutes later
  assert.strictEqual(isSessionRevoked(before, changedAt), true);

  const reissued = readSessionToken(issueSessionToken('user', 'user-1', changedAt.getTime()), 'user', changedAt.getTime())!;
  assert.strictEqual(isSessionRevoked(reissued, changedAt), false);

  // Renewal re-issues with a later issue time, so a renewed token after the change stays valid too.
  const later = changedAt.getTime() + 13 * 60 * 60 * 1000;
  const renewed = readSessionToken(issueSessionToken('user', 'user-1', later), 'user', later)!;
  assert.strictEqual(isSessionRevoked(renewed, changedAt), false);
});
