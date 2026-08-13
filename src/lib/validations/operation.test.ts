import test from 'node:test';
import assert from 'node:assert';
import { validateOperationConfig, CreateOperationInput } from './operation';

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
    shippingDate: '2026-12-15',
    executionDate: '2026-12-25',
    shippingDate: '2026-12-18',
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
