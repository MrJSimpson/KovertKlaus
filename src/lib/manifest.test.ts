import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRecommendedHardLimit,
  validateItemBudget,
  evaluateDrawEligibility,
  calculateClaimedBasketTotal,
  validateAndSanitizeManifestItem,
  ManifestItemInput,
} from './validations/manifest';

test('Dual Manifest & Anti-Overwishing Budget Engine Test Suite', async (t) => {
  await t.test('calculateRecommendedHardLimit computes exact +20% threshold', () => {
    assert.equal(calculateRecommendedHardLimit(50), 60);
    assert.equal(calculateRecommendedHardLimit(25), 30);
    assert.equal(calculateRecommendedHardLimit(100), 120);
    assert.equal(calculateRecommendedHardLimit(0), 0);
  });

  await t.test('validateItemBudget enforces +20% hard cap and provides soft warnings', () => {
    // In Budget
    const inBudget = validateItemBudget(35, 50, 60);
    assert.equal(inBudget.status, 'IN_BUDGET');
    assert.equal(inBudget.isAllowed, true);

    // Over Soft Target but within Hard Cap
    const overSoft = validateItemBudget(54, 50, 60);
    assert.equal(overSoft.status, 'OVER_SOFT_LIMIT');
    assert.equal(overSoft.isAllowed, true);

    // Over Hard Cap (Blocked Overwishing)
    const overHard = validateItemBudget(75, 50, 60);
    assert.equal(overHard.status, 'OVERWISHING_HARD_BREACH');
    assert.equal(overHard.isAllowed, false);

    // Under Min Target
    const underMin = validateItemBudget(10, 50, 60, 20);
    assert.equal(underMin.status, 'UNDER_MIN');
    assert.equal(underMin.isAllowed, true);
  });

  await t.test('evaluateDrawEligibility checks Secret Santa empty vs valid lists', () => {
    // 0 items -> Ineligible
    const empty = evaluateDrawEligibility([], 50, 60);
    assert.equal(empty.isEligible, false);
    assert.ok(empty.bannerMessage.includes('empty'));

    // All items breach hard cap -> Ineligible
    const allBreach: ManifestItemInput[] = [
      { title: 'Expensive Drone', price: 150 },
      { title: 'Luxury Watch', price: 200 },
    ];
    const breachRes = evaluateDrawEligibility(allBreach, 50, 60);
    assert.equal(breachRes.isEligible, false);
    assert.ok(breachRes.bannerMessage.includes('OVERWISHING'));

    // At least 1 valid item -> Eligible
    const mixed: ManifestItemInput[] = [
      { title: 'Expensive Drone', price: 150 },
      { title: 'Coffee Beans', price: 25 },
    ];
    const mixedRes = evaluateDrawEligibility(mixed, 50, 60);
    assert.equal(mixedRes.isEligible, true);
    assert.equal(mixedRes.validItemsCount, 1);
    assert.equal(mixedRes.breachingItemsCount, 1);
    assert.ok(mixedRes.bannerMessage.includes('MISSION READY'));
  });

  await t.test('evaluateDrawEligibility enforces White Elephant N=1 constraint strictly', () => {
    // 0 items in pool -> Ineligible
    const emptyWE = evaluateDrawEligibility([], 50, undefined, true);
    assert.equal(emptyWE.isEligible, false);

    // Exactly 1 item in pool -> Eligible
    const singleWE: ManifestItemInput[] = [{ title: 'Board Game', price: 35 }];
    const validWE = evaluateDrawEligibility(singleWE, 50, undefined, true);
    assert.equal(validWE.isEligible, true);
    assert.equal(validWE.validItemsCount, 1);

    // Multiple items in pool -> Ineligible / Overflow
    const multiWE: ManifestItemInput[] = [
      { title: 'Board Game', price: 35 },
      { title: 'Socks', price: 15 },
    ];
    const overflowWE = evaluateDrawEligibility(multiWE, 50, undefined, true);
    assert.equal(overflowWE.isEligible, false);
    assert.ok(overflowWE.bannerMessage.includes('strictly limited to 1'));
  });

  await t.test('calculateClaimedBasketTotal tallies multiple purchased items against soft budget', () => {
    const items: ManifestItemInput[] = [
      { title: 'Book', price: 20, isClaimed: true },
      { title: 'Coffee Kit', price: 25, isClaimed: true },
      { title: 'Unclaimed Hat', price: 15, isClaimed: false },
    ];

    const result = calculateClaimedBasketTotal(items, 50);
    assert.equal(result.claimedTotal, 45);
    assert.equal(result.remainingBudget, 5);
    assert.equal(result.claimedCount, 2);
    assert.equal(result.isSoftBudgetMet, false);

    // Add another item to meet/exceed soft budget
    items[2].isClaimed = true;
    const metResult = calculateClaimedBasketTotal(items, 50);
    assert.equal(metResult.claimedTotal, 60);
    assert.equal(metResult.remainingBudget, 0);
    assert.equal(metResult.isSoftBudgetMet, true);
    assert.ok(metResult.statusText.includes('reached'));
  });

  await t.test('validateAndSanitizeManifestItem accepts text-only personalized gift with empty URL', () => {
    const res = validateAndSanitizeManifestItem({
      title: 'Handmade Wool Beanie',
      url: '',
      price: 25.5,
      description: 'Navy blue color with fleece lining',
      properties: {
        isPersonalized: true,
        details: [
          { label: 'Size', value: 'Medium' },
          { label: 'Color', value: 'Navy' },
        ],
      },
    });

    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.data.name, 'Handmade Wool Beanie');
      assert.equal(res.data.url, '');
      assert.equal(res.data.price, 25.5);
      assert.equal(res.data.description, 'Navy blue color with fleece lining');
      assert.equal(res.data.isPersonalized, true);
      assert.equal(res.data.properties?.isPersonalized, true);
      assert.deepEqual(res.data.properties?.details, [
        { label: 'Size', value: 'Medium' },
        { label: 'Color', value: 'Navy' },
      ]);
    }
  });

  await t.test('validateAndSanitizeManifestItem strips XSS and bounds lengths strictly', () => {
    const dangerousTitle = '<b>Special Gift</b> <script>alert("pwned")</script>' + 'A'.repeat(150);
    const dangerousDesc = '<p>Handcrafted cookies</p><img src="x" onerror="alert(1)">' + 'B'.repeat(600);

    const res = validateAndSanitizeManifestItem({
      title: dangerousTitle,
      url: '',
      price: '30.00',
      description: dangerousDesc,
    });

    assert.equal(res.valid, true);
    if (res.valid) {
      assert.ok(!res.data.name.includes('<'));
      assert.ok(!res.data.name.includes('>'));
      assert.ok(!res.data.name.includes('<b>'));
      assert.ok(res.data.name.length <= 100);

      assert.ok(!res.data.description?.includes('<'));
      assert.ok(!res.data.description?.includes('onerror'));
      assert.ok((res.data.description?.length ?? 0) <= 500);
      assert.equal(res.data.price, 30);
      assert.equal(res.data.isPersonalized, true);
    }
  });

  await t.test('validateAndSanitizeManifestItem rejects missing title for personalized gift', () => {
    const res = validateAndSanitizeManifestItem({
      title: '   ',
      url: '',
      properties: { isPersonalized: true },
    });

    assert.equal(res.valid, false);
    if (!res.valid) {
      assert.ok(res.error.includes('title is required'));
    }
  });

  await t.test('validateAndSanitizeManifestItem enforces SSRF protection for URL gifts', () => {
    // Valid e-commerce URL
    const validUrlRes = validateAndSanitizeManifestItem({
      title: 'Amazon Gadget',
      url: 'https://www.amazon.com/dp/B08N5WRWNW',
      price: 49.99,
    });
    assert.equal(validUrlRes.valid, true);
    if (validUrlRes.valid) {
      assert.equal(validUrlRes.data.isPersonalized, false);
      assert.equal(validUrlRes.data.url, 'https://www.amazon.com/dp/B08N5WRWNW');
    }

    // SSRF attempt blocked
    const ssrfRes = validateAndSanitizeManifestItem({
      title: 'AWS Metadata Probe',
      url: 'http://169.254.169.254/latest/meta-data',
    });
    assert.equal(ssrfRes.valid, false);
  });
});
