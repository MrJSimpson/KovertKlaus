import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafePublicUrl, normalizeProductUrl, sanitizeText, isValidEmail, validatePassword } from './security';

test('Security & Scraper Engine Test Suite', async (t) => {
  await t.test('isSafePublicUrl permits valid public http/https URLs', () => {
    assert.equal(isSafePublicUrl('https://www.lego.com/en-us/product/millennium-falcon-75192').safe, true);
    assert.equal(isSafePublicUrl('https://target.com/p/apple-airpods/-/A-12345').safe, true);
    assert.equal(isSafePublicUrl('https://github.com/MrJSimpson/KovertKlaus').safe, true);
    assert.equal(isSafePublicUrl('http://example.com/item').safe, true);
  });

  await t.test('isSafePublicUrl blocks invalid protocols, empty strings, and embedded credentials', () => {
    assert.equal(isSafePublicUrl('').safe, false);
    assert.equal(isSafePublicUrl('ftp://example.com/file').safe, false);
    assert.equal(isSafePublicUrl('file:///etc/passwd').safe, false);
    assert.equal(isSafePublicUrl('javascript:alert(1)').safe, false);
    assert.equal(isSafePublicUrl('http://admin:secret@example.com').safe, false);
  });

  await t.test('isSafePublicUrl blocks loopback and localhost addresses (OWASP A01 SSRF)', () => {
    assert.equal(isSafePublicUrl('http://localhost:3000').safe, false);
    assert.equal(isSafePublicUrl('http://127.0.0.1:5432').safe, false);
    assert.equal(isSafePublicUrl('http://127.0.0.2:80').safe, false);
    assert.equal(isSafePublicUrl('http://[::1]:80').safe, false);
    assert.equal(isSafePublicUrl('http://0.0.0.0:80').safe, false);
    assert.equal(isSafePublicUrl('http://subdomain.localhost/test').safe, false);
  });

  await t.test('isSafePublicUrl blocks AWS / Cloud Metadata endpoints', () => {
    assert.equal(isSafePublicUrl('http://169.254.169.254/latest/meta-data/').safe, false);
    assert.equal(isSafePublicUrl('http://instance-data/latest/meta-data/').safe, false);
    assert.equal(isSafePublicUrl('http://[fd00:ec2::254]/').safe, false);
  });

  await t.test('isSafePublicUrl blocks Private IPv4 and Carrier NAT ranges', () => {
    assert.equal(isSafePublicUrl('http://10.0.0.1/admin').safe, false);
    assert.equal(isSafePublicUrl('http://192.168.1.1/router').safe, false);
    assert.equal(isSafePublicUrl('http://172.16.0.1:8080').safe, false);
    assert.equal(isSafePublicUrl('http://172.31.255.255/').safe, false);
    assert.equal(isSafePublicUrl('http://100.64.0.1/').safe, false);
  });

  await t.test('isSafePublicUrl blocks DNS rebinding and wildcard domains', () => {
    assert.equal(isSafePublicUrl('http://127.0.0.1.nip.io').safe, false);
    assert.equal(isSafePublicUrl('http://app.sslip.io').safe, false);
    assert.equal(isSafePublicUrl('http://localtest.me').safe, false);
  });

  await t.test('isSafePublicUrl blocks Integer, Hex, and Octal encoded IP addresses', () => {
    assert.equal(isSafePublicUrl('http://2130706433/').safe, false); // 127.0.0.1
    assert.equal(isSafePublicUrl('http://0x7f000001/').safe, false); // 127.0.0.1
    assert.equal(isSafePublicUrl('http://017700000001/').safe, false); // 127.0.0.1
  });

  await t.test('normalizeProductUrl strips tracking parameters and trailing slashes', () => {
    const raw = 'https://www.amazon.com/dp/B08N5WRWNW/?ref_=ast_sto_dp&tag=affil-20&utm_source=facebook&fbclid=IwAR2';
    const clean = normalizeProductUrl(raw);
    assert.equal(clean, 'https://www.amazon.com/dp/B08N5WRWNW');

    const targetUrl = 'https://www.target.com/p/product-name/-/A-12345678?utm_medium=cpc&gclid=ABC123';
    assert.equal(normalizeProductUrl(targetUrl), 'https://www.target.com/p/product-name/-/A-12345678');
  });

  await t.test('sanitizeText strips dangerous HTML tags and escapes XSS payloads', () => {
    assert.equal(sanitizeText('Hello <b>World</b>'), 'Hello World');
    assert.equal(sanitizeText('<script>alert("xss")</script>Clean Text'), 'alert("xss")Clean Text');
    assert.equal(sanitizeText(''), '');
  });

  await t.test('isValidEmail validates RFC compliant emails', () => {
    assert.equal(isValidEmail('santa@kovertklaus.com'), true);
    assert.equal(isValidEmail('invalid-email'), false);
    assert.equal(isValidEmail(''), false);
  });

  await t.test('validatePassword enforces minimum 10 characters with mixed character sets', () => {
    assert.equal(validatePassword('Short1!').isValid, false);
    assert.equal(validatePassword('nocapitalletter123!').isValid, false);
    assert.equal(validatePassword('NOLOWERCASE123!').isValid, false);
    assert.equal(validatePassword('NoNumbersHere!@#').isValid, false);
    assert.equal(validatePassword('NoSpecialCharacters123').isValid, false);
    assert.equal(validatePassword('Klaus2026!Security').isValid, true);
  });
});
