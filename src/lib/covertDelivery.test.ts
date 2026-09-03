import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateKdmToken,
  isValidKdmTokenFormat,
  normalizeNameForComparison,
  verifyGiverIdentityGuess,
  evaluateCovertOutcome,
  BADGE_KOVERT_KLAUS,
  BADGE_VIGILANT_ELF,
} from './covertDelivery.ts';

test('KDM Token Generation & Validation', () => {
  const token = generateKdmToken();
  assert(token.startsWith('KDM-'), 'Token starts with KDM- prefix');
  assert.equal(token.length, 18, 'Token length is exactly 18 characters (KDM-XXXX-XXXX-XXXX)');
  assert(isValidKdmTokenFormat(token), 'Generated token passes validation regex');

  assert.equal(isValidKdmTokenFormat('KDM-7F4A-9B2C-E3D1'), true);
  assert.equal(isValidKdmTokenFormat('kdm-aaaa-bbbb-cccc'), true, 'Case-insensitive validation');
  assert.equal(isValidKdmTokenFormat('KDM-1234-5678'), false, 'Rejects short token');
  assert.equal(isValidKdmTokenFormat('HEX-7F4A-9B2C-E3D1'), false, 'Rejects non-KDM prefix');
  assert.equal(isValidKdmTokenFormat(null), false);
  assert.equal(isValidKdmTokenFormat(''), false);
});

test('Token Uniqueness / Collision Resistance Test', () => {
  const generated = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const t = generateKdmToken();
    assert(!generated.has(t), `Collision detected on token: ${t}`);
    generated.add(t);
  }
  assert.equal(generated.size, 1000, 'Generated 1000 distinct high-entropy KDM tokens');
});

test('Name Normalization for 1-Guess Challenge', () => {
  assert.equal(normalizeNameForComparison('Zach Simpson'), 'zach simpson');
  assert.equal(normalizeNameForComparison('  Zachary   Simpson  '), 'zachary simpson');
  assert.equal(normalizeNameForComparison('Agent: Zach Simpson'), 'zach simpson');
  assert.equal(normalizeNameForComparison('Agent-Zach Simpson'), 'zach simpson');
  assert.equal(normalizeNameForComparison('Dr. Joshua Simpson, Jr.'), 'joshua simpson jr');
  assert.equal(normalizeNameForComparison(''), '');
  assert.equal(normalizeNameForComparison(null), '');
});

test('1-Guess Identity Verification Logic', () => {
  // Direct matches
  assert.equal(verifyGiverIdentityGuess('Zach Simpson', 'Zach Simpson'), true);
  assert.equal(verifyGiverIdentityGuess('zach simpson', 'Zach Simpson'), true);
  assert.equal(verifyGiverIdentityGuess('Agent: Zach Simpson', 'Zach Simpson'), true);
  assert.equal(verifyGiverIdentityGuess('Simpson, Zach', 'Zach Simpson'), true, 'Handles Last, First order');

  // Multi-word names
  assert.equal(verifyGiverIdentityGuess('Mary Jane Watson', 'Mary Jane Watson'), true);
  assert.equal(verifyGiverIdentityGuess('Watson Mary Jane', 'Mary Jane Watson'), true);

  // Mismatches
  assert.equal(verifyGiverIdentityGuess('Cheryl Simpson', 'Zach Simpson'), false);
  assert.equal(verifyGiverIdentityGuess('Terry Simpson', 'Joshua Simpson'), false);
  assert.equal(verifyGiverIdentityGuess('Trash Can', 'Zach Simpson'), false);
  assert.equal(verifyGiverIdentityGuess('', 'Zach Simpson'), false);
  assert.equal(verifyGiverIdentityGuess(null, 'Zach Simpson'), false);
});

test('Stealth Outcome and Badge Resolution', () => {
  // Case 1: Target accurately named Santa -> BUSTED + Vigilant Elf badge
  const outcomeBusted = evaluateCovertOutcome({
    targetGuessAttempted: true,
    targetGuessCorrect: true,
  });
  assert.equal(outcomeBusted.status, 'BUSTED');
  assert.equal(outcomeBusted.badgeAwarded, BADGE_VIGILANT_ELF);

  // Case 2: Target guessed wrong -> UNDETECTED + Kovert Klaus badge (giver preserved)
  const outcomeWrongGuess = evaluateCovertOutcome({
    targetGuessAttempted: true,
    targetGuessCorrect: false,
  });
  assert.equal(outcomeWrongGuess.status, 'UNDETECTED');
  assert.equal(outcomeWrongGuess.badgeAwarded, BADGE_KOVERT_KLAUS);

  // Case 3: Target confirmed ghost drop without guessing -> UNDETECTED + Kovert Klaus badge
  const outcomeGhost = evaluateCovertOutcome({
    targetGuessAttempted: false,
    isGhostConfirmed: true,
  });
  assert.equal(outcomeGhost.status, 'UNDETECTED');
  assert.equal(outcomeGhost.badgeAwarded, BADGE_KOVERT_KLAUS);

  // Case 4: Pending / In progress
  const outcomePending = evaluateCovertOutcome({
    targetGuessAttempted: false,
  });
  assert.equal(outcomePending.status, 'PENDING');
  assert.equal(outcomePending.badgeAwarded, null);
});
