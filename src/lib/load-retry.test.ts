import test from 'node:test';
import assert from 'node:assert';
import { fetchJsonWithRetry, isRetryableStatus, LOAD_RETRY_DELAYS_MS } from './load-retry';
import { DB_UNAVAILABLE_BODY, dbUnavailableResponse, isDbConnectionError } from './db-errors';

/** A fetch that answers from a script: a Response, or an Error to throw. */
function scripted(steps: Array<Response | Error>) {
  const calls: string[] = [];
  const fetchFn = async (url: string) => {
    calls.push(url);
    const step = steps.shift();
    if (!step) throw new Error('fetch called more often than scripted');
    if (step instanceof Error) throw step;
    return step;
  };
  return { calls, fetchFn };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const noSleep = { sleep: async () => {} };

test('Load retry - retryable statuses', () => {
  assert.strictEqual(isRetryableStatus(500), true);
  assert.strictEqual(isRetryableStatus(503), true);
  assert.strictEqual(isRetryableStatus(504), true);
  assert.strictEqual(isRetryableStatus(501), false);
  assert.strictEqual(isRetryableStatus(404), false);
  assert.strictEqual(isRetryableStatus(401), false);
  assert.strictEqual(isRetryableStatus(200), false);
});

test('Load retry - schedule waits about half a minute in all', () => {
  const total = LOAD_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
  assert.ok(total >= 20000 && total <= 35000, `total wait ${total}ms`);
});

test('Load retry - a waking database is retried until it answers', async () => {
  const { calls, fetchFn } = scripted([json(DB_UNAVAILABLE_BODY, 503), new TypeError('Failed to fetch'), json({ success: true, data: { id: 'm1' } })]);
  const retries: number[] = [];
  const waits: number[] = [];
  const result = await fetchJsonWithRetry('/api/operations?code=X', {
    fetchFn,
    onRetry: (n) => retries.push(n),
    sleep: async (ms) => void waits.push(ms),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 200);
  assert.deepStrictEqual(result.json.data, { id: 'm1' });
  assert.strictEqual(calls.length, 3);
  assert.deepStrictEqual(retries, [1, 2]);
  assert.deepStrictEqual(waits, LOAD_RETRY_DELAYS_MS.slice(0, 2));
});

test('Load retry - client errors return at once', async () => {
  for (const status of [401, 403, 404]) {
    const { calls, fetchFn } = scripted([json({ error: 'Exchange not found' }, status)]);
    const result = await fetchJsonWithRetry('/x', { fetchFn, ...noSleep });
    assert.strictEqual(result.status, status);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.json.error, 'Exchange not found');
    assert.strictEqual(calls.length, 1);
  }
});

test('Load retry - a non-JSON body (edge error page) is retried, even with 200', async () => {
  const { calls, fetchFn } = scripted([new Response('<html>error</html>', { status: 200 }), json({ success: true })]);
  const result = await fetchJsonWithRetry('/x', { fetchFn, ...noSleep });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(calls.length, 2);
});

test('Load retry - gives up after the schedule with the last response', async () => {
  const { calls, fetchFn } = scripted([json(DB_UNAVAILABLE_BODY, 503), json(DB_UNAVAILABLE_BODY, 503), json(DB_UNAVAILABLE_BODY, 503)]);
  const result = await fetchJsonWithRetry('/x', { fetchFn, delays: [1, 1], ...noSleep });
  assert.strictEqual(result.status, 503);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.json.retryable, true);
  assert.strictEqual(calls.length, 3);
});

test('Load retry - gives up after the schedule by rethrowing a network error', async () => {
  const { fetchFn } = scripted([new TypeError('Failed to fetch'), new TypeError('Failed to fetch')]);
  await assert.rejects(fetchJsonWithRetry('/x', { fetchFn, delays: [1], ...noSleep }), /Failed to fetch/);
});

test('DB errors - connection failures are recognised; query errors are not', () => {
  assert.strictEqual(isDbConnectionError(new Error("Can't reach database server at neon.tech")), true);
  assert.strictEqual(isDbConnectionError(new Error('Connection terminated unexpectedly')), true);
  assert.strictEqual(isDbConnectionError(Object.assign(new Error('boom'), { name: 'PrismaClientInitializationError' })), true);
  assert.strictEqual(isDbConnectionError(new Error('Unique constraint failed on the fields: (`code`)')), false);
  assert.strictEqual(isDbConnectionError(null), false);
  assert.strictEqual(isDbConnectionError('socket'), false);
});

test('DB errors - unavailable response is a retryable 503 without internal text', async () => {
  const res = dbUnavailableResponse();
  assert.strictEqual(res.status, 503);
  assert.strictEqual(res.headers.get('Retry-After'), '2');
  const body = await res.json();
  assert.strictEqual(body.retryable, true);
  assert.doesNotMatch(body.error, /prisma|neon|socket/i);
});
