import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectProductCategory,
  getCategorySuggestedKeys,
  matchDossierToVariables,
  updateCatalogIntelligence,
  sanitizeItemDetails,
  MAX_ITEM_DETAILS,
  MAX_CATALOG_OPTIONS_PER_KEY,
} from './product-intelligence';

test('Product Intelligence Engine Test Suite', async (t) => {
  await t.test('detectProductCategory classifies apparel, footwear, tech, and books accurately', () => {
    assert.equal(
      detectProductCategory('Champion Men\'s Everyday Fleece Hoodie Sweatshirt', 'amazon.com'),
      'APPAREL_TOPS'
    );
    assert.equal(
      detectProductCategory('Levi\'s 511 Slim Fit Flex Jeans', 'target.com'),
      'APPAREL_BOTTOMS'
    );
    assert.equal(
      detectProductCategory('Nike Air Max 270 Running Shoes', 'nike.com'),
      'FOOTWEAR'
    );
    assert.equal(
      detectProductCategory('Apple iPad 10.9-inch 64GB Wi-Fi', 'bestbuy.com'),
      'ELECTRONICS'
    );
    assert.equal(
      detectProductCategory('Dungeons & Dragons Player\'s Handbook Hardcover', 'amazon.com'),
      'BOOKS_GAMES'
    );
    assert.equal(
      detectProductCategory('Hydro Flask 32 oz Wide Mouth Water Bottle', 'rei.com'),
      'GENERAL'
    );
  });

  await t.test('getCategorySuggestedKeys returns at most 4 variables per category', () => {
    const categories = ['APPAREL_TOPS', 'APPAREL_BOTTOMS', 'FOOTWEAR', 'ELECTRONICS', 'BOOKS_GAMES', 'GENERAL'] as const;
    for (const cat of categories) {
      const keys = getCategorySuggestedKeys(cat);
      assert.ok(keys.length <= MAX_ITEM_DETAILS);
      assert.ok(keys.length >= 2);
    }
  });

  await t.test('matchDossierToVariables matches user sizes and favorite colors', () => {
    const variables = ['Size', 'Color', 'Style', 'Notes for Santa'];
    const dossier = {
      topHalfSize: 'XL',
      shoeSize: '10.5',
      favoriteColors: 'Navy Blue, Forest Green',
    };

    const matches = matchDossierToVariables(variables, dossier);
    assert.deepEqual(matches['Size'], ['XL']);
    assert.deepEqual(matches['Color'], ['Navy Blue', 'Forest Green']);
    assert.equal(matches['Style'], undefined);

    const footwearVariables = ['Shoe Size', 'Color', 'Width'];
    const shoeMatches = matchDossierToVariables(footwearVariables, dossier);
    assert.deepEqual(shoeMatches['Shoe Size'], ['10.5']);
  });

  await t.test('updateCatalogIntelligence increments counts, sorts descending, and prunes to top 5', () => {
    let catalog = updateCatalogIntelligence(null, [
      { label: 'Size', value: 'L' },
      { label: 'Color', value: 'Black' },
    ], 'APPAREL_TOPS');

    assert.equal(catalog.category, 'APPAREL_TOPS');
    assert.equal(catalog.popularOptions?.['Size']?.[0]?.count, 1);
    assert.equal(catalog.popularOptions?.['Size']?.[0]?.val, 'L');

    // Add more entries
    catalog = updateCatalogIntelligence(catalog, [{ label: 'Size', value: 'L' }]);
    catalog = updateCatalogIntelligence(catalog, [{ label: 'Size', value: 'M' }]);
    catalog = updateCatalogIntelligence(catalog, [{ label: 'Size', value: 'L' }]);
    catalog = updateCatalogIntelligence(catalog, [{ label: 'Size', value: 'XL' }]);
    catalog = updateCatalogIntelligence(catalog, [{ label: 'Size', value: 'S' }]);
    catalog = updateCatalogIntelligence(catalog, [{ label: 'Size', value: 'XXL' }]);
    catalog = updateCatalogIntelligence(catalog, [{ label: 'Size', value: 'XXXL' }]); // 6th option

    const sizeOpts = catalog.popularOptions?.['Size'] || [];
    assert.equal(sizeOpts.length, MAX_CATALOG_OPTIONS_PER_KEY); // capped at 5
    assert.equal(sizeOpts[0].val, 'L');
    assert.equal(sizeOpts[0].count, 3); // L appeared 3 times
  });

  await t.test('sanitizeItemDetails bounds to 4 items and trims strings', () => {
    const raw = [
      { label: ' Size ', value: ' Large ' },
      { label: 'Color', value: 'Navy' },
      { label: 'Style', value: 'Hoodie' },
      { label: 'Notes', value: 'Winter' },
      { label: 'Extra 5', value: 'Ignored' },
    ];

    const sanitized = sanitizeItemDetails(raw);
    assert.equal(sanitized.length, 4);
    assert.equal(sanitized[0].label, 'Size');
    assert.equal(sanitized[0].value, 'Large');
  });
});
