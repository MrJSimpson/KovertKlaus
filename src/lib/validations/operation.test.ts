import test from 'node:test';
import assert from 'node:assert';
import { parseOperationConfig, resolveSettingsUpdate, validateOperationConfig, validateOperationSettings, CreateOperationInput } from './operation';

test('Operation Validator - Valid Configuration', () => {
  const input: CreateOperationInput = {
    title: 'Simpson Family Christmas 2026',
    giftingType: 'SINGLE',
    isLocalOnly: false,
    isWhiteElephant: false,
    budgetMax: 50,
    inviteCutoffDate: '2026-12-01',
    assignmentDate: '2026-12-05',
    shippingDate: '2026-12-18',
    executionDate: '2026-12-25',
  };

  const result = validateOperationConfig(input);
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.errors.length, 0);
});

test('Operation Validator - Rejects White Elephant on Remote Ops', () => {
  const input: CreateOperationInput = {
    title: 'White Elephant Online Attempt',
    giftingType: 'SINGLE',
    isLocalOnly: false, // Invalid for White Elephant
    isWhiteElephant: true,
    budgetMax: 25,
    inviteCutoffDate: '2026-12-01',
    assignmentDate: '2026-12-05',
    shippingDate: '2026-12-18',
    executionDate: '2026-12-25',
  };

  const result = validateOperationConfig(input);
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.includes('White Elephant gifting is restricted to local in-person events only.'));
});

test('Operation Validator - Enforces Date Sequence', () => {
  const input: CreateOperationInput = {
    title: 'Invalid Date Sequence Op',
    giftingType: 'SINGLE',
    isLocalOnly: false,
    isWhiteElephant: false,
    budgetMax: 30,
    inviteCutoffDate: '2026-12-10', // Invalid: Cutoff after Assignment
    assignmentDate: '2026-12-05',
    shippingDate: '2026-12-18',
    executionDate: '2026-12-25',
  };

  const result = validateOperationConfig(input);
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.includes('Go/No-Go Date (Invite Cutoff) cannot be set after Target Assignment Date.'));
});

test('Operation Validator - Rejects capacity outside 4..the platform limit', () => {
  const base: CreateOperationInput = {
    title: 'Capacity Check',
    giftingType: 'SINGLE',
    isLocalOnly: false,
    isWhiteElephant: false,
    budgetMax: 50,
    inviteCutoffDate: '2026-12-01',
    assignmentDate: '2026-12-05',
    shippingDate: '2026-12-18',
    executionDate: '2026-12-25',
  };
  assert.strictEqual(validateOperationConfig({ ...base, maxParticipants: 3 }).isValid, false);
  assert.strictEqual(validateOperationConfig({ ...base, maxParticipants: 50 }).isValid, true); // platform default
  assert.strictEqual(validateOperationConfig({ ...base, maxParticipants: 51 }).isValid, false);
  assert.strictEqual(validateOperationConfig({ ...base, maxParticipants: 12 }).isValid, true);
  // An admin's lower platform limit applies.
  assert.strictEqual(validateOperationConfig({ ...base, maxParticipants: 12 }, 10).isValid, false);
});

test('Operation Settings Validator - accepts a valid edit and rejects bad ones', () => {
  const valid = {
    title: 'Family Mission',
    budgetMin: 10,
    budgetMax: 50,
    maxParticipants: 10,
    isLocalOnly: false,
    eventLocation: null,
    isWhiteElephant: false,
    currentMemberCount: 6,
  };
  assert.strictEqual(validateOperationSettings(valid).isValid, true);
  assert.strictEqual(validateOperationSettings({ ...valid, title: '  ' }).isValid, false);
  assert.strictEqual(validateOperationSettings({ ...valid, budgetMin: 60 }).isValid, false);
  assert.strictEqual(validateOperationSettings({ ...valid, budgetMax: NaN }).isValid, false);
  assert.strictEqual(validateOperationSettings({ ...valid, maxParticipants: 5 }).isValid, false); // below enrolled 6
  assert.strictEqual(validateOperationSettings({ ...valid, isLocalOnly: true, eventLocation: '' }).isValid, false);
  assert.strictEqual(validateOperationSettings({ ...valid, isWhiteElephant: true }).isValid, false);
});

test('resolveSettingsUpdate - merges the patch, keeps the rest, and applies every settings rule', () => {
  const stored = {
    title: 'Family Mission', description: null, budgetMin: null, budgetMax: { toString: () => '50' }, maxParticipants: 10,
    isLocalOnly: false, eventLocation: null, enforcePenalties: true, allowWishlistOverBudget: true, isWhiteElephant: false,
  };
  const ok = resolveSettingsUpdate(stored, { title: '  <b>Office</b> swap ', budgetMax: '40' }, 6, 50);
  assert.ok(ok.ok);
  assert.strictEqual(ok.data.budgetMax, 40);
  assert.strictEqual(ok.data.maxParticipants, 10);
  assert.ok(!ok.data.title.includes('<'));
  const fail = (patch: Record<string, unknown>, members = 6) => {
    const r = resolveSettingsUpdate(stored, patch, members, 50);
    assert.ok(!r.ok, JSON.stringify(patch));
    return r.errors;
  };
  assert.match(fail({ title: '   ' })[0], /title is required/);
  assert.match(fail({ maxParticipants: 5 })[0], /lower than the 6 agents/);
  assert.match(fail({ maxParticipants: 51 })[0], /between 4 and 50/);
  assert.match(fail({ isLocalOnly: true })[0], /event location/);
  assert.match(fail({ budgetMin: 60 })[0], /cannot exceed/);
  assert.match(fail({ isWhiteElephant: true })[0], /fixed upon creation/);
  assert.ok(resolveSettingsUpdate(stored, { isWhiteElephant: false }, 6, 50).ok);
});

test('parseOperationConfig - accepts the create form payload and drops unknown fields', () => {
  const payload = {
    title: 'Simpson Family Christmas 2026', description: 'Family swap', budgetMin: 0, budgetMax: 50, currency: 'USD',
    giftingType: 'SINGLE', isLocalOnly: false, isWhiteElephant: false, enforcePenalties: true,
    allowWishlistOverBudget: true, maxParticipants: 5, inviteCutoffDate: '2026-12-01', assignmentDate: '2026-12-05',
    shippingDate: '2026-12-18', executionDate: '2026-12-25', organizerId: 'someone-else',
  };
  const parsed = parseOperationConfig(payload);
  assert.ok(parsed);
  assert.strictEqual(parsed.title, payload.title);
  assert.strictEqual(parsed.budgetMax, 50);
  assert.strictEqual('organizerId' in parsed, false);
});

test('parseOperationConfig - optional fields may be absent or null; flags default to false', () => {
  const parsed = parseOperationConfig({
    title: 'Mission', giftingType: 'SINGLE', budgetMax: 25, description: null,
    inviteCutoffDate: '2026-12-01', assignmentDate: '2026-12-05', shippingDate: '2026-12-18', executionDate: '2026-12-25',
  });
  assert.ok(parsed);
  assert.strictEqual(parsed.isLocalOnly, false);
  assert.strictEqual(parsed.isWhiteElephant, false);
  assert.strictEqual('description' in parsed, false);
});

test('parseOperationConfig - rejects non-objects and wrongly typed fields', () => {
  const valid = {
    title: 'Mission', giftingType: 'SINGLE', budgetMax: 25,
    inviteCutoffDate: '2026-12-01', assignmentDate: '2026-12-05', shippingDate: '2026-12-18', executionDate: '2026-12-25',
  };
  for (const value of [null, undefined, 'config', 7, [valid]]) assert.strictEqual(parseOperationConfig(value), null);
  assert.strictEqual(parseOperationConfig({ ...valid, title: 123 }), null);
  assert.strictEqual(parseOperationConfig({ ...valid, budgetMax: '50' }), null);
  assert.strictEqual(parseOperationConfig({ ...valid, budgetMax: Number.NaN }), null);
  assert.strictEqual(parseOperationConfig({ ...valid, giftingType: 'BULK' }), null);
  assert.strictEqual(parseOperationConfig({ ...valid, isLocalOnly: 'yes' }), null);
  assert.strictEqual(parseOperationConfig({ ...valid, executionDate: undefined }), null);
});
