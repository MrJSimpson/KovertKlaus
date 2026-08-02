import test from 'node:test';
import assert from 'node:assert';
import { POST } from './route';

test('Scraper API - Rejects invalid URLs', async () => {
  const request = new Request('http://localhost:3000/api/scraper', {
    method: 'POST',
    body: JSON.stringify({ url: 'not-a-url' }),
  });

  const response = await POST(request);
  assert.strictEqual(response.status, 200);

  const json = await response.json();
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.fallback, true);
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
