import test from 'node:test';
import assert from 'node:assert';
import { LEGAL_ATTRIBUTION, LEGAL_CONTACT_EMAIL, MINIMUM_AGE, PRIVACY_POLICY, TERMS_OF_SERVICE, type LegalDocument } from './legal';

const allText = (doc: LegalDocument) =>
  [doc.title, doc.notice, doc.intro, ...doc.sections.flatMap((s) => [s.heading, ...s.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : b.items))])].join('\n');

for (const doc of [PRIVACY_POLICY, TERMS_OF_SERVICE]) {
  test(`${doc.title}: says it is not a commercial product yet and will change first`, () => {
    assert.match(doc.notice, /not a commercial product \(yet\)/);
    assert.match(doc.notice, /will change/);
  });

  test(`${doc.title}: gives the privacy contact and the minimum age`, () => {
    const text = allText(doc);
    assert.ok(text.includes(LEGAL_CONTACT_EMAIL));
    assert.ok(text.includes(String(MINIMUM_AGE)));
  });

  test(`${doc.title}: section ids are unique anchors`, () => {
    const ids = doc.sections.map((s) => s.id);
    assert.strictEqual(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z][a-z-]*$/);
  });

  test(`${doc.title}: no leftovers from the source policies`, () => {
    const text = allText(doc);
    for (const word of ['37signals', 'Basecamp', 'HEY', 'subscription', 'refund', 'credit card']) {
      assert.ok(!text.includes(word), word);
    }
  });
}

test('Privacy Policy: names every service provider that handles personal data', () => {
  const text = allText(PRIVACY_POLICY);
  for (const provider of ['Cloudflare', 'Neon', 'Brevo']) assert.ok(text.includes(provider), provider);
});

test('Privacy Policy: states there is no tracking and no selling', () => {
  const text = allText(PRIVACY_POLICY);
  assert.match(text, /never sell/);
  assert.match(text, /no advertising, analytics or tracking cookies/);
});

test('Attribution: CC BY 4.0 credit with source and license links', () => {
  assert.strictEqual(LEGAL_ATTRIBUTION.license, 'CC BY 4.0');
  assert.match(LEGAL_ATTRIBUTION.sourceUrl, /^https:\/\/github\.com\/basecamp\/policies$/);
  assert.match(LEGAL_ATTRIBUTION.licenseUrl, /creativecommons\.org\/licenses\/by\/4\.0/);
});
