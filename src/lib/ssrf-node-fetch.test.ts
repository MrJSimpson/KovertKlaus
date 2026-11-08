/**
 * @file ssrf-node-fetch.test.ts
 * @description Tests the connect-time SSRF guard used by the Node scraper route.
 *
 * Tier 1 (what): Address classification, the guarded DNS lookup, and end-to-end blocking against a
 * real local HTTP server.
 * Tier 2 (why): The guard closes the "public name, private address" gap in `isSafePublicUrl`; these
 * tests prove a blocked target never receives a request.
 * Tier 3 (how): A fake resolver maps test hostnames to 127.0.0.1, where a counting server listens.
 */

import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { LookupAddress } from 'node:dns';
import { createGuardedLookup, createSsrfSafeFetch, isPublicAddress, type ResolveAll } from './ssrf-node-fetch';
import { fetchProductPage, ProductFetchError } from './product-fetch';

/** Resolver that answers from a fixed table, like a hostile or misconfigured DNS server would. */
function fakeResolver(table: Record<string, LookupAddress[]>): ResolveAll {
  return (hostname, _options, callback) => {
    const addresses = table[hostname];
    if (!addresses) {
      const error: NodeJS.ErrnoException = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
      error.code = 'ENOTFOUND';
      callback(error, []);
      return;
    }
    callback(null, addresses);
  };
}

const LOOPBACK: LookupAddress[] = [{ address: '127.0.0.1', family: 4 }];

/** Starts a server on 127.0.0.1 that counts requests. */
async function startCountingServer(): Promise<{ port: number; hits: () => number; stop: () => Promise<void> }> {
  let count = 0;
  const server = http.createServer((_req, res) => {
    count++;
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head><title>Internal admin panel</title></head></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    hits: () => count,
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

async function rejectsWithReason(promise: Promise<unknown>, reason: string): Promise<void> {
  await assert.rejects(promise, (error: unknown) => error instanceof ProductFetchError && error.reason === reason);
}

test('isPublicAddress - accepts public unicast addresses', () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.255.255', '172.32.0.0', '100.63.255.255', '2606:4700:4700::1111', '2a00:1450:4001::200e']) {
    assert.strictEqual(isPublicAddress(address), true, address);
  }
});

test('isPublicAddress - refuses loopback, private, link-local, reserved and embedded forms', () => {
  const blocked = [
    '0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '127.255.255.254', '169.254.169.254',
    '172.16.0.1', '172.31.255.255', '192.0.0.8', '192.0.2.1', '192.168.1.1', '198.18.0.1',
    '198.51.100.7', '203.0.113.9', '224.0.0.1', '239.255.255.250', '255.255.255.255',
    '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '64:ff9b::a00:1',
    '2001:db8::1', '2002:c0a8:101::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1',
  ];
  for (const address of blocked) {
    assert.strictEqual(isPublicAddress(address), false, address);
  }
});

test('isPublicAddress - refuses anything that is not an IP literal', () => {
  for (const value of ['', 'localhost', 'example.com', '127.0.0.1.nip.io', '[::1]', '1.2.3']) {
    assert.strictEqual(isPublicAddress(value), false, value);
  }
});

test('createGuardedLookup - passes public answers in both callback forms', async () => {
  const lookup = createGuardedLookup(fakeResolver({ 'shop.example': [{ address: '93.184.216.34', family: 4 }] }));

  const single = await new Promise<[string, number | undefined]>((resolve, reject) =>
    lookup('shop.example', {}, (error, address, family) => (error ? reject(error) : resolve([address as string, family]))),
  );
  assert.deepStrictEqual(single, ['93.184.216.34', 4]);

  const all = await new Promise<LookupAddress[]>((resolve, reject) =>
    lookup('shop.example', { all: true }, (error, addresses) => (error ? reject(error) : resolve(addresses as LookupAddress[]))),
  );
  assert.deepStrictEqual(all, [{ address: '93.184.216.34', family: 4 }]);
});

test('createGuardedLookup - fails when any answer is private, when there are none, or when DNS fails', async () => {
  const lookup = createGuardedLookup(
    fakeResolver({
      'mixed.example': [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }],
      'empty.example': [],
    }),
  );
  const run = (hostname: string) =>
    new Promise<NodeJS.ErrnoException | null>((resolve) => lookup(hostname, { all: true }, (error) => resolve(error)));

  assert.strictEqual((await run('mixed.example'))?.code, 'ERR_SSRF_BLOCKED_ADDRESS');
  assert.strictEqual((await run('empty.example'))?.code, 'ERR_SSRF_BLOCKED_ADDRESS');
  assert.strictEqual((await run('missing.example'))?.code, 'ENOTFOUND');
});

test('createSsrfSafeFetch - a public name that resolves to loopback never reaches the server', async () => {
  const server = await startCountingServer();
  const safeFetch = createSsrfSafeFetch({ resolveAll: fakeResolver({ 'gifts.example': LOOPBACK }) });
  try {
    await rejectsWithReason(safeFetch(`http://gifts.example:${server.port}/item`), 'BLOCKED_ADDRESS');
    assert.strictEqual(server.hits(), 0);
  } finally {
    await safeFetch.close();
    await server.stop();
  }
});

test('createSsrfSafeFetch - literal private IPs are refused before connecting', async () => {
  const server = await startCountingServer();
  const safeFetch = createSsrfSafeFetch();
  try {
    await rejectsWithReason(safeFetch(`http://127.0.0.1:${server.port}/`), 'BLOCKED_ADDRESS');
    await rejectsWithReason(safeFetch(`http://[::1]:${server.port}/`), 'BLOCKED_ADDRESS');
    assert.strictEqual(server.hits(), 0);
  } finally {
    await safeFetch.close();
    await server.stop();
  }
});

test('createSsrfSafeFetch - the resolved address is the one connected to (allowed case)', async () => {
  const server = await startCountingServer();
  // Permissive classifier: proves the guarded lookup sits in the connection path and its answer is used.
  const safeFetch = createSsrfSafeFetch({ resolveAll: fakeResolver({ 'gifts.example': LOOPBACK }), isAllowed: () => true });
  try {
    const response = await safeFetch(`http://gifts.example:${server.port}/item`);
    assert.strictEqual(response.status, 200);
    assert.match(await response.text(), /Internal admin panel/);
    assert.strictEqual(server.hits(), 1);
  } finally {
    await safeFetch.close();
    await server.stop();
  }
});

test('fetchProductPage + createSsrfSafeFetch - reports a blocked address as BLOCKED_ADDRESS, not NETWORK', async () => {
  const server = await startCountingServer();
  const safeFetch = createSsrfSafeFetch({ resolveAll: fakeResolver({ 'gifts.example': LOOPBACK }) });
  try {
    await rejectsWithReason(fetchProductPage(`http://gifts.example:${server.port}/item`, { fetchImpl: safeFetch }), 'BLOCKED_ADDRESS');
    assert.strictEqual(server.hits(), 0);
  } finally {
    await safeFetch.close();
    await server.stop();
  }
});
