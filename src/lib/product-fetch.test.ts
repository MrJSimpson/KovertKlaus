import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProductTitle, describeFetchFailure, fetchProductPage, isUsableProductTitle, ProductFetchError } from './product-fetch';

/** A fake fetch that serves `routes` by URL and records every request. */
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: { url: string; redirect?: RequestRedirect }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, redirect: init?.redirect });
    const route = routes[url];
    if (!route) throw new TypeError(`fetch failed: ${url}`);
    return route();
  }) as typeof fetch;
  return { impl, calls };
}

const redirectTo = (location: string, status = 301) => () => new Response(null, { status, headers: { location } });
const page = (html: string) => () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });

async function rejectsWith(promise: Promise<unknown>, reason: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof ProductFetchError && error.reason === reason);
}

test('Product page fetch (scraper)', async (t) => {
  await t.test('never asks the runtime for redirect: error (Cloudflare Workers rejects it)', async () => {
    const { impl, calls } = fakeFetch({ 'https://shop.example.com/p/1': page('<title>Gift</title>') });
    const result = await fetchProductPage('https://shop.example.com/p/1', { fetchImpl: impl });
    assert.equal(result.html, '<title>Gift</title>');
    assert.equal(result.redirects, 0);
    assert.deepEqual(calls.map((c) => c.redirect), ['manual']);
  });

  await t.test('follows safe redirects, resolving relative locations', async () => {
    const { impl, calls } = fakeFetch({
      'http://amazon.com/dp/X': redirectTo('https://amazon.com/dp/X'),
      'https://amazon.com/dp/X': redirectTo('/gp/product/X', 302),
      'https://amazon.com/gp/product/X': page('ok'),
    });
    const result = await fetchProductPage('http://amazon.com/dp/X', { fetchImpl: impl });
    assert.equal(result.finalUrl, 'https://amazon.com/gp/product/X');
    assert.equal(result.redirects, 2);
    assert.equal(calls.length, 3);
  });

  await t.test('blocks a redirect to a private or metadata address before fetching it', async () => {
    for (const target of ['http://127.0.0.1:5432/', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.1/admin', 'file:///etc/passwd']) {
      const { impl, calls } = fakeFetch({ 'https://evil.example.com/gift': redirectTo(target) });
      await rejectsWith(fetchProductPage('https://evil.example.com/gift', { fetchImpl: impl }), 'BLOCKED_REDIRECT');
      assert.equal(calls.length, 1, `${target} must never be requested`);
    }
  });

  await t.test('gives up after the redirect limit', async () => {
    const { impl, calls } = fakeFetch({
      'https://a.example.com/': redirectTo('https://b.example.com/'),
      'https://b.example.com/': redirectTo('https://a.example.com/'),
    });
    await rejectsWith(fetchProductPage('https://a.example.com/', { fetchImpl: impl, maxRedirects: 3 }), 'TOO_MANY_REDIRECTS');
    assert.equal(calls.length, 4);
  });

  await t.test('reports HTTP errors, network failures and timeouts with a reason', async () => {
    const blocked = fakeFetch({ 'https://shop.example.com/': () => new Response('denied', { status: 403 }) });
    await rejectsWith(fetchProductPage('https://shop.example.com/', { fetchImpl: blocked.impl }), 'HTTP_STATUS');

    const offline = fakeFetch({});
    await rejectsWith(fetchProductPage('https://shop.example.com/', { fetchImpl: offline.impl }), 'NETWORK');

    const hang = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as typeof fetch;
    await rejectsWith(fetchProductPage('https://slow.example.com/', { fetchImpl: hang, timeoutMs: 20 }), 'TIMEOUT');
  });

  await t.test('maps failures to scraper log actions', () => {
    assert.equal(describeFetchFailure(new ProductFetchError('x', 'BLOCKED_REDIRECT', 302)).action, 'BLOCKED_SSRF');
    assert.equal(describeFetchFailure(new ProductFetchError('x', 'TIMEOUT')).action, 'TIMEOUT');
    const http = describeFetchFailure(new ProductFetchError('HTTP 403', 'HTTP_STATUS', 403));
    assert.equal(http.action, 'SCRAPE_FAILURE');
    assert.equal(http.details.status, 403);
    assert.equal(describeFetchFailure(new Error('db down')).details.reason, 'PROCESSING');
  });

  await t.test('rejects bot-check pages and domain-only titles so they are never cached', () => {
    const reasonOf = (title: string, host = 'www.etsy.com') => {
      try {
        assertProductTitle(title, host);
        return null;
      } catch (error) {
        return error instanceof ProductFetchError ? error.reason : 'OTHER';
      }
    };
    // Seen on kovertklaus.com 2026-10-24
    assert.equal(reasonOf('Robot or human?', 'www.walmart.com'), 'BOT_CHALLENGE');
    assert.equal(reasonOf('Human or robot?'), 'BOT_CHALLENGE');
    assert.equal(reasonOf('etsy.com'), 'NO_METADATA');
    assert.equal(reasonOf('www.etsy.com'), 'NO_METADATA');
    assert.equal(reasonOf('   '), 'NO_METADATA');
    assert.equal(reasonOf('Just a moment...', 'shop.example.com'), 'BOT_CHALLENGE');
    assert.equal(reasonOf('Access Denied', 'www.example.com'), 'BOT_CHALLENGE');
    assert.equal(reasonOf('Amazon.com: Sorry! Something went wrong!', 'www.amazon.com'), 'BOT_CHALLENGE');
    // Real products that merely contain similar words are kept
    assert.equal(reasonOf('Robot Vacuum Cleaner with Self-Empty Base', 'www.amazon.com'), null);
    assert.equal(reasonOf('The Human Body Book', 'www.amazon.com'), null);
    assert.equal(reasonOf('Personalized Wooden Ornament - Etsy'), null);
    assert.equal(isUsableProductTitle('www.etsy.com', 'www.etsy.com'), false);
    assert.equal(isUsableProductTitle('Knitted Scarf', 'www.etsy.com'), true);
  });

  await t.test('logs title rejections as scrape failures with their reason', () => {
    const failure = describeFetchFailure(new ProductFetchError('x', 'BOT_CHALLENGE'));
    assert.equal(failure.action, 'SCRAPE_FAILURE');
    assert.equal(failure.details.reason, 'BOT_CHALLENGE');
  });
});
