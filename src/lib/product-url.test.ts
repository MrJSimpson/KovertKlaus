/**
 * @file product-url.test.ts
 * @description Tests for finding the store link in pasted text.
 *
 * Tier 1 (what): share text, bare domains, links with trailing punctuation, and text with no link.
 * Tier 2 (why): The inputs mirror real `BLOCKED_SSRF` log rows from 2026-11-14 to 11-16 (product
 * names, store share text, "etsy,com"), with made-up product IDs.
 * Tier 3 (how): Pure function tests.
 */

import test from 'node:test';
import assert from 'node:assert';
import { extractProductUrl } from './product-url';

test('extractProductUrl', async (t) => {
  await t.test('keeps a plain link', () => {
    assert.strictEqual(extractProductUrl('  https://www.amazon.com/dp/B000000001  '), 'https://www.amazon.com/dp/B000000001');
  });

  await t.test('pulls the link out of store share text', () => {
    assert.strictEqual(
      extractProductUrl('Take a look at this item from Walmart https://www.walmart.com/ip/123456?sid=abc'),
      'https://www.walmart.com/ip/123456?sid=abc'
    );
    assert.strictEqual(
      extractProductUrl('Amazon.com: Zip Hoodie, Large (Pack of 1)\nhttps://a.co/d/0abcDEF'),
      'https://a.co/d/0abcDEF'
    );
  });

  await t.test('drops punctuation that ends the sentence', () => {
    assert.strictEqual(extractProductUrl('Get me this (https://www.etsy.com/listing/1/pin).'), 'https://www.etsy.com/listing/1/pin');
  });

  await t.test('adds https:// to a bare link', () => {
    assert.strictEqual(extractProductUrl('amazon.com/dp/B000000001'), 'https://amazon.com/dp/B000000001');
    assert.strictEqual(extractProductUrl('www.llbean.com'), 'https://www.llbean.com');
  });

  await t.test('returns null when there is no link', () => {
    for (const text of ['24 oz black yeti coffee mug', 'Take a look at this item from Walmart', 'etsy,com', 'HOTOUCH Women Casual Jacket | Solid Color', '', '   ', null, undefined]) {
      assert.strictEqual(extractProductUrl(text), null, String(text));
    }
  });
});
