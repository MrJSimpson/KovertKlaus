import test from 'node:test';
import assert from 'node:assert';
import {
  detectCarrier,
  normalizeTrackingNumber,
  isCarrierTrackingValid,
  getCarrierTrackingUrl,
} from './carrier-tracking';

test('Carrier Tracking - normalizes tracking numbers by stripping spaces and hyphens', () => {
  assert.strictEqual(normalizeTrackingNumber(' 1Z 999 999 99 9999 9999 '), '1Z9999999999999999');
  assert.strictEqual(normalizeTrackingNumber('9400-1000-2000-3000-4000-00'), '9400100020003000400000');
  assert.strictEqual(normalizeTrackingNumber(''), '');
  assert.strictEqual(normalizeTrackingNumber(null), '');
});

test('Carrier Tracking - identifies UPS 1Z tracking numbers', () => {
  const result = detectCarrier('1Z999AA10123456784');
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.carrier, 'UPS');
  assert.strictEqual(result.badgeLabel, 'UPS');
  assert.ok(result.trackingUrl?.includes('ups.com/track'));
  assert.ok(result.trackingUrl?.includes('1Z999AA10123456784'));

  // Test with spaces & lowercase
  const spaced = detectCarrier('1z 999 aa1 01 2345 6784');
  assert.strictEqual(spaced.isValid, true);
  assert.strictEqual(spaced.carrier, 'UPS');
});

test('Carrier Tracking - identifies USPS standard and international tracking numbers', () => {
  // 22-digit standard USPS starting with 94
  const usps22 = detectCarrier('9400111899562537624649');
  assert.strictEqual(usps22.isValid, true);
  assert.strictEqual(usps22.carrier, 'USPS');
  assert.strictEqual(usps22.badgeLabel, 'USPS');
  assert.ok(usps22.trackingUrl?.includes('tools.usps.com'));

  // 20-digit standard USPS starting with 92
  const usps20 = detectCarrier('9205590153708426210515');
  assert.strictEqual(usps20.isValid, true);
  assert.strictEqual(usps20.carrier, 'USPS');

  // Priority Mail Express International format (e.g. EA123456789US)
  const uspsIntl = detectCarrier('EA123456789US');
  assert.strictEqual(uspsIntl.isValid, true);
  assert.strictEqual(uspsIntl.carrier, 'USPS');
});

test('Carrier Tracking - identifies FedEx tracking numbers', () => {
  // 12-digit FedEx Express
  const fedex12 = detectCarrier('986578788855');
  assert.strictEqual(fedex12.isValid, true);
  assert.strictEqual(fedex12.carrier, 'FEDEX');
  assert.strictEqual(fedex12.badgeLabel, 'FedEx');
  assert.ok(fedex12.trackingUrl?.includes('fedex.com/fedextrack'));

  // 15-digit FedEx Ground
  const fedex15 = detectCarrier('771234567890123');
  assert.strictEqual(fedex15.isValid, true);
  assert.strictEqual(fedex15.carrier, 'FEDEX');

  // Door tag format
  const fedexDoorTag = detectCarrier('DT123456789012');
  assert.strictEqual(fedexDoorTag.isValid, true);
  assert.strictEqual(fedexDoorTag.carrier, 'FEDEX');
});

test('Carrier Tracking - identifies DHL Express tracking numbers', () => {
  // 10-digit DHL Express
  const dhl10 = detectCarrier('1234567890');
  assert.strictEqual(dhl10.isValid, true);
  assert.strictEqual(dhl10.carrier, 'DHL');
  assert.strictEqual(dhl10.badgeLabel, 'DHL');
  assert.ok(dhl10.trackingUrl?.includes('dhl.com'));

  // 11-digit DHL
  const dhl11 = detectCarrier('12345678901');
  assert.strictEqual(dhl11.isValid, true);
  assert.strictEqual(dhl11.carrier, 'DHL');
});

test('Carrier Tracking - categorizes unknown alphanumeric sequences >= 8 chars as OTHER', () => {
  const generic = detectCarrier('SPEEDEE123456');
  assert.strictEqual(generic.isValid, true);
  assert.strictEqual(generic.carrier, 'OTHER');
  assert.strictEqual(generic.badgeLabel, 'Carrier Parcel');
  assert.ok(generic.trackingUrl?.includes('google.com/search'));
});

test('Carrier Tracking - rejects invalid, short, or non-alphanumeric tracking numbers', () => {
  const shortNum = detectCarrier('12345');
  assert.strictEqual(shortNum.isValid, false);
  assert.strictEqual(shortNum.carrier, 'UNKNOWN');
  assert.strictEqual(shortNum.trackingUrl, null);

  const empty = detectCarrier('   ');
  assert.strictEqual(empty.isValid, false);

  const specialChars = detectCarrier('$$$$$$$$$$');
  assert.strictEqual(specialChars.isValid, false);
});

test('Carrier Tracking - isCarrierTrackingValid returns boolean correctly', () => {
  assert.strictEqual(isCarrierTrackingValid('1Z999AA10123456784'), true);
  assert.strictEqual(isCarrierTrackingValid('9400111899562537624649'), true);
  assert.strictEqual(isCarrierTrackingValid('SHORT'), false);
  assert.strictEqual(isCarrierTrackingValid(null), false);
  assert.strictEqual(isCarrierTrackingValid(''), false);
});
