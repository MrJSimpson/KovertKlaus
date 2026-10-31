import test from 'node:test';
import assert from 'node:assert';
import { FEATURE_FACTS, FEATURE_GROUPS, LICENSE_SUMMARY } from './features';
import { PLATFORM_LIMIT_BOUNDS } from './platform-limits';
import { PRODUCT_FETCH_TIMEOUT_MS } from './product-fetch';
import { resolveAccountStatus } from './demerits';
import { PURGE_AFTER_MS } from './mission-cancel';
import { RESET_LINK_TTL_MS } from './password-reset';
import { JOIN_LIMITS } from './join-throttle';
import { getCarrierTrackingUrl } from './carrier-tracking';

const DAY_MS = 24 * 60 * 60 * 1000;

test('Features page facts match the code that enforces them', () => {
  assert.strictEqual(FEATURE_FACTS.maxAgents, PLATFORM_LIMIT_BOUNDS.maxMissionAgents.default);
  assert.strictEqual(FEATURE_FACTS.maxWishlistItems, PLATFORM_LIMIT_BOUNDS.maxWishlistItems.default);
  assert.strictEqual(FEATURE_FACTS.productFetchSeconds * 1000, PRODUCT_FETCH_TIMEOUT_MS);
  assert.strictEqual(FEATURE_FACTS.cancelledPurgeDays * DAY_MS, PURGE_AFTER_MS);
  assert.strictEqual(FEATURE_FACTS.resetLinkMinutes * 60_000, RESET_LINK_TTL_MS);
  assert.strictEqual(FEATURE_FACTS.wrongCodesPerHour, JOIN_LIMITS.ACCOUNT);
});

test('Features page Coal Citation tiers match resolveAccountStatus', () => {
  assert.strictEqual(resolveAccountStatus(FEATURE_FACTS.citationsRestricted - 1), 'ACTIVE');
  assert.strictEqual(resolveAccountStatus(FEATURE_FACTS.citationsRestricted), 'REMOTE_RESTRICTED');
  assert.strictEqual(resolveAccountStatus(FEATURE_FACTS.citationsSuspended), 'DISABLED');
});

test('Features page carriers are the ones with tracking support', () => {
  const codes: Record<string, 'USPS' | 'FEDEX' | 'UPS' | 'DHL'> = { USPS: 'USPS', FedEx: 'FEDEX', UPS: 'UPS', DHL: 'DHL' };
  for (const name of FEATURE_FACTS.carriers) {
    assert.ok(codes[name], name);
    assert.ok(getCarrierTrackingUrl(codes[name], '9400111899223344556677'), name);
  }
});

test('Features page: every group has an id, heading, lead and points; ids are unique', () => {
  const ids = FEATURE_GROUPS.map((g) => g.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const g of FEATURE_GROUPS) {
    assert.match(g.id, /^[a-z][a-z-]*$/);
    assert.ok(g.heading && g.lead && g.points.length > 0, g.id);
  }
});

test('Features page: carrier sentence lists all four carriers in plain English', () => {
  const shipping = FEATURE_GROUPS.find((g) => g.id === 'shipping');
  assert.ok(shipping);
  assert.ok(shipping.points[0].includes('USPS, FedEx, UPS or DHL'), shipping.points[0]);
});

test('License summary: no conversion date (LICENSE.md has none) and the real triggers', () => {
  assert.ok(!/20[0-9]{2}/.test(LICENSE_SUMMARY.text), 'no year in the license summary');
  assert.match(LICENSE_SUMMARY.text, /non-commercial/);
  assert.match(LICENSE_SUMMARY.text, /GPLv3/);
  assert.match(LICENSE_SUMMARY.licenseUrl, /LICENSE\.md$/);
});
