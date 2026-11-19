import test from 'node:test';
import assert from 'node:assert';
import { changedFields, formFromUser, passwordChangeProblem, profilePayload, standingBanner, statusLabel, trimForm } from './profile-form';

/** `GET /api/users/profile` on self-hosted: column names only. */
const SELF_HOSTED_USER = {
  name: 'Holly Example',
  streetAddress: '1 Candy Cane Lane',
  city: 'Spokane',
  state: 'WA',
  zipCode: '99201',
  country: 'US',
  shirtSize: 'M',
  topHalfSize: null,
  dislikes: 'Scented candles',
  allowOrganizerViewSizes: false,
  allowOrganizerViewMeasurements: true,
  allowOrganizerViewAllergies: false,
  allowOrganizerViewFavorites: true,
  emailNotifications: false,
};

test('Profile form - reads the visibility columns both servers send (the old dialog lost them on self-hosted)', () => {
  const form = formFromUser(SELF_HOSTED_USER);
  assert.deepStrictEqual(
    [form.showSizes, form.showMeasurements, form.showAllergies, form.showFavorites, form.emailNotifications],
    [false, true, false, true, false],
  );
});

test('Profile form - the hosted worker aliases are read when the columns are missing', () => {
  const form = formFromUser({ allowOperatorViewSizes: false, allowOperatorViewFavorites: true });
  assert.strictEqual(form.showSizes, false);
  assert.strictEqual(form.showFavorites, true);
});

test('Profile form - missing values fall back to the database defaults', () => {
  const form = formFromUser({});
  assert.deepStrictEqual(
    [form.showSizes, form.showMeasurements, form.showAllergies, form.showFavorites, form.emailNotifications, form.country, form.name],
    [true, false, true, false, true, 'US', ''],
  );
});

test('Profile form - the old shirt size fills an empty top size; an unknown country becomes US', () => {
  assert.strictEqual(formFromUser(SELF_HOSTED_USER).topHalfSize, 'M');
  assert.strictEqual(formFromUser({ topHalfSize: 'L', shirtSize: 'M' }).topHalfSize, 'L');
  assert.strictEqual(formFromUser({ country: 'ca' }).country, 'CA');
  assert.strictEqual(formFromUser({ country: 'Narnia' }).country, 'US');
});

test('Profile form - changes are counted per field, ignoring surrounding spaces', () => {
  const saved = formFromUser(SELF_HOSTED_USER);
  assert.deepStrictEqual(changedFields(saved, { ...saved }), []);
  assert.deepStrictEqual(changedFields(saved, { ...saved, city: ' Spokane  ' }), []);
  assert.deepStrictEqual(changedFields(saved, { ...saved, city: 'Tacoma', showSizes: true }), ['city', 'showSizes']);
});

test('Profile form - the save body trims text, mirrors the top size and sends the visibility under the API names', () => {
  const draft = { ...formFromUser(SELF_HOSTED_USER), city: ' Tacoma ', topHalfSize: 'L ' };
  const body = profilePayload(draft);
  assert.strictEqual(body.city, 'Tacoma');
  assert.strictEqual(body.topHalfSize, 'L');
  assert.strictEqual(body.shirtSize, 'L');
  assert.strictEqual(body.dislikes, 'Scented candles');
  assert.deepStrictEqual(
    [body.allowOperatorViewSizes, body.allowOperatorViewMeasurements, body.allowOperatorViewAllergies, body.allowOperatorViewFavorites],
    [false, true, false, true],
  );
  assert.ok(!('currentPassword' in body) && !('newPassword' in body), 'the password is a separate request');
  assert.ok(!('email' in body), 'the email address is read-only');
  assert.strictEqual(trimForm(draft).city, 'Tacoma');
});

test('Profile form - a password change needs the current password, 10+ characters and a matching confirmation', () => {
  const ok = 'a long enough phrase';
  assert.match(passwordChangeProblem('', ok, ok)!, /current password/);
  assert.match(passwordChangeProblem('old one', 'short', 'short')!, /at least 10/);
  assert.match(passwordChangeProblem('old one', ok, `${ok}!`)!, /do not match/);
  assert.match(passwordChangeProblem(ok, ok, ok)!, /different/);
  assert.strictEqual(passwordChangeProblem('old one', ok, ok), null);
  assert.strictEqual(passwordChangeProblem('old one', 'abcdefghij', 'abcdefghij'), null, 'no composition rules');
});

test('Profile form - standing follows the Coal Citation tiers', () => {
  assert.deepStrictEqual(
    ['ACTIVE', 'REMOTE_RESTRICTED', 'DISABLED'].map((s) => [standingBanner(s).tone, statusLabel(s)]),
    [['success', 'Active'], ['warning', 'Local only'], ['danger', 'Suspended']],
  );
});
