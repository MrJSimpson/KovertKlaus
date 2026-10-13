import test from 'node:test';
import assert from 'node:assert';
import { buildProfileUpdate, organizerVisibilityAliases, PROFILE_DOSSIER_SELECT } from './profile-update';

test('Profile Update - copies and sanitizes Operative Dossier fields', () => {
  const data = buildProfileUpdate({
    addressLine2: ' Apt 4 ',
    deliveryNotes: '<b>Leave at door</b>',
    topHalfSize: 'L',
    favoriteHobbies: 'Skiing',
  });
  assert.deepStrictEqual(data, {
    addressLine2: 'Apt 4',
    deliveryNotes: 'Leave at door',
    topHalfSize: 'L',
    favoriteHobbies: 'Skiing',
  });
});

test('Profile Update - maps allowOperatorView* toggles to allowOrganizerView* columns', () => {
  const data = buildProfileUpdate({ allowOperatorViewSizes: false, allowOperatorViewFavorites: true });
  assert.deepStrictEqual(data, { allowOrganizerViewSizes: false, allowOrganizerViewFavorites: true });
});

test('Profile Update - ignores fields outside the whitelist', () => {
  const data = buildProfileUpdate({
    userId: 'someone-else',
    passwordHash: 'x',
    penaltyPoints: 0,
    accountStatus: 'ACTIVE',
    isWorkshop: true,
    email: 'evil@example.com',
  });
  assert.deepStrictEqual(data, {});
});

test('Profile Update - empty strings clear a field, null is skipped', () => {
  assert.deepStrictEqual(buildProfileUpdate({ addressLine2: '', deliveryNotes: null }), { addressLine2: '' });
});

test('Profile Update - every selected column is a whitelisted dossier column', () => {
  assert.ok(!('passwordHash' in PROFILE_DOSSIER_SELECT));
  assert.strictEqual(PROFILE_DOSSIER_SELECT.allowOrganizerViewSizes, true);
  assert.strictEqual(PROFILE_DOSSIER_SELECT.addressLine2, true);
});

test('Profile Update - exposes visibility toggles under their client names', () => {
  assert.deepStrictEqual(
    organizerVisibilityAliases({
      allowOrganizerViewSizes: true,
      allowOrganizerViewMeasurements: false,
      allowOrganizerViewAllergies: true,
      allowOrganizerViewFavorites: false,
    }),
    {
      allowOperatorViewSizes: true,
      allowOperatorViewMeasurements: false,
      allowOperatorViewAllergies: true,
      allowOperatorViewFavorites: false,
    }
  );
});
