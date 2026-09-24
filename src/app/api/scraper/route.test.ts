import test from 'node:test';
import assert from 'node:assert';
import { POST } from './route';

test('Scraper API - Fallback for unreachable public e-commerce URLs', async () => {
  const request = new Request('http://localhost:3000/api/scraper', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://unreachable-product-store-404.com/gift' }),
  });

  const response = await POST(request);
  assert.strictEqual(response.status, 200);

  const json = await response.json();
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.fallback, true);
});

test('Scraper API - Blocks SSRF and single-label container hostnames with 403', async () => {
  const request = new Request('http://localhost:3000/api/scraper', {
    method: 'POST',
    body: JSON.stringify({ url: 'http://postgres:5432' }),
  });

  const response = await POST(request);
  assert.strictEqual(response.status, 403);
});

test('Scraper API - Handles missing payload gracefully', async () => {
  const request = new Request('http://localhost:3000/api/scraper', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const response = await POST(request);
  assert.strictEqual(response.status, 400);

  const json = await response.json();
  assert.strictEqual(json.error, 'Valid product URL is required');
});
