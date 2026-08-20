import test from 'node:test';
import assert from 'node:assert';
import {
  resolveAccountStatus,
  isCarrierTrackingValid,
  evaluateMemberAudit,
} from './demerits';

test('Demerit Engine - resolveAccountStatus mappings', () => {
  assert.strictEqual(resolveAccountStatus(0), 'ACTIVE');
  assert.strictEqual(resolveAccountStatus(1), 'ACTIVE');
  assert.strictEqual(resolveAccountStatus(2), 'ACTIVE');
  assert.strictEqual(resolveAccountStatus(3), 'REMOTE_RESTRICTED');
  assert.strictEqual(resolveAccountStatus(4), 'DISABLED');
  assert.strictEqual(resolveAccountStatus(5), 'DISABLED');
});

test('Demerit Engine - isCarrierTrackingValid format validation', () => {
  assert.strictEqual(isCarrierTrackingValid(null), false);
  assert.strictEqual(isCarrierTrackingValid(undefined), false);
  assert.strictEqual(isCarrierTrackingValid(''), false);
  assert.strictEqual(isCarrierTrackingValid('   '), false);
  assert.strictEqual(isCarrierTrackingValid('12345'), false); // Too short

  // Valid Tracking Formats
  assert.strictEqual(isCarrierTrackingValid('9400111899562537624128'), true); // USPS
  assert.strictEqual(isCarrierTrackingValid('1Z9999999999999999'), true); // UPS
  assert.strictEqual(isCarrierTrackingValid('794827395829'), true); // FedEx
  assert.strictEqual(isCarrierTrackingValid('1234-5678-9012'), true); // Formatted with hyphens
});

test('Demerit Engine - Intentional Neglect triggers +1 Coal Citation', () => {
  const outcome = evaluateMemberAudit({
    userId: 'user-neglect-1',
    userName: 'Neglectful Agent',
    shippingStatus: 'PENDING',
    deliveredConfirmed: false,
    trackingNumber: null,
    currentPenaltyPoints: 0,
    currentAccountStatus: 'ACTIVE',
    isWhiteElephant: false,
  });

  assert.strictEqual(outcome.penalized, true);
  assert.strictEqual(outcome.carrierWaived, false);
  assert.strictEqual(outcome.demeritCleared, false);
  assert.strictEqual(outcome.newDemeritCount, 1);
  assert.strictEqual(outcome.newAccountStatus, 'ACTIVE');
});

test('Demerit Engine - 3rd Citation restricts account to REMOTE_RESTRICTED', () => {
  const outcome = evaluateMemberAudit({
    userId: 'user-neglect-2',
    userName: 'Repeat Offender',
    shippingStatus: 'PENDING',
    deliveredConfirmed: false,
    trackingNumber: '',
    currentPenaltyPoints: 2,
    currentAccountStatus: 'ACTIVE',
    isWhiteElephant: false,
  });

  assert.strictEqual(outcome.penalized, true);
  assert.strictEqual(outcome.newDemeritCount, 3);
  assert.strictEqual(outcome.newAccountStatus, 'REMOTE_RESTRICTED');
});

test('Demerit Engine - Carrier Protection Waiver grants automated penalty immunity', () => {
  const outcome = evaluateMemberAudit({
    userId: 'user-carrier-1',
    userName: 'Diligent Agent',
    shippingStatus: 'PENDING',
    deliveredConfirmed: false,
    trackingNumber: '9400111899562537624128',
    currentPenaltyPoints: 1,
    currentAccountStatus: 'ACTIVE',
    isWhiteElephant: false,
  });

  assert.strictEqual(outcome.penalized, false);
  assert.strictEqual(outcome.carrierWaived, true);
  assert.strictEqual(outcome.demeritCleared, false);
  assert.strictEqual(outcome.newDemeritCount, 1);
  assert.strictEqual(outcome.newAccountStatus, 'ACTIVE');
});

test('Demerit Engine - Automated Rehabilitation removes -1 Coal Citation on fulfillment', () => {
  const outcome = evaluateMemberAudit({
    userId: 'user-redeemed-1',
    userName: 'Redeemed Agent',
    shippingStatus: 'DELIVERED',
    deliveredConfirmed: true,
    trackingNumber: '1Z9999999999999999',
    currentPenaltyPoints: 2,
    currentAccountStatus: 'ACTIVE',
    isWhiteElephant: false,
  });

  assert.strictEqual(outcome.penalized, false);
  assert.strictEqual(outcome.carrierWaived, false);
  assert.strictEqual(outcome.demeritCleared, true);
  assert.strictEqual(outcome.newDemeritCount, 1);
  assert.strictEqual(outcome.newAccountStatus, 'ACTIVE');
});

test('Demerit Engine - Rehabilitation restores REMOTE_RESTRICTED to ACTIVE when points < 3', () => {
  const outcome = evaluateMemberAudit({
    userId: 'user-redeemed-2',
    userName: 'Rehabilitated Agent',
    shippingStatus: 'SHIPPED',
    deliveredConfirmed: false,
    trackingNumber: '794827395829',
    currentPenaltyPoints: 3,
    currentAccountStatus: 'REMOTE_RESTRICTED',
    isWhiteElephant: false,
  });

  assert.strictEqual(outcome.penalized, false);
  assert.strictEqual(outcome.demeritCleared, true);
  assert.strictEqual(outcome.newDemeritCount, 2);
  assert.strictEqual(outcome.newAccountStatus, 'ACTIVE');
});

test('Demerit Engine - White Elephant participation decrements Coal Citation', () => {
  const outcome = evaluateMemberAudit({
    userId: 'user-we-1',
    userName: 'White Elephant Agent',
    currentPenaltyPoints: 1,
    currentAccountStatus: 'ACTIVE',
    isWhiteElephant: true,
  });

  assert.strictEqual(outcome.penalized, false);
  assert.strictEqual(outcome.demeritCleared, true);
  assert.strictEqual(outcome.newDemeritCount, 0);
  assert.strictEqual(outcome.newAccountStatus, 'ACTIVE');
});
