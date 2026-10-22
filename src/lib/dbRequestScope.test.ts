import test, { beforeEach } from 'node:test';
import assert from 'node:assert';
import { clearParkedClients, dropScopedClient, getScopedClient, inDbScope, runWithDbScope } from './dbRequestScope';

// Parked clients outlive a request by design; start every test without any.
beforeEach(() => clearParkedClients());

/** Fake client factory that records creations and closes. */
function makeFactory() {
  const created: number[] = [];
  const closed: number[] = [];
  let next = 0;
  const create = () => {
    const id = ++next;
    created.push(id);
    return { client: { id }, close: async () => { closed.push(id); } };
  };
  return { create, created, closed };
}

const tick = () => new Promise((r) => setTimeout(r, 5));

test('DB Scope - outside a scope there is no scoped client (module cache is used)', () => {
  const f = makeFactory();
  assert.strictEqual(inDbScope(), false);
  assert.strictEqual(getScopedClient('admin:x', f.create), undefined);
  assert.deepStrictEqual(f.created, []);
});

test('DB Scope - one client per key within a request, closed after the request', async () => {
  const f = makeFactory();
  const ids = await runWithDbScope(async () => {
    const a = getScopedClient('admin:x', f.create)!;
    await tick();
    const b = getScopedClient('admin:x', f.create)!;
    const c = getScopedClient('app:x', f.create)!;
    return [a.id, b.id, c.id];
  });
  assert.deepStrictEqual(ids, [1, 1, 2], 'same key reuses, different key creates');
  assert.deepStrictEqual(f.closed.sort(), [1, 2], 'every client closed when the request ends');
});

test('DB Scope - concurrent requests never share a client', async () => {
  const f = makeFactory();
  const seen = await Promise.all(
    Array.from({ length: 20 }, () =>
      runWithDbScope(async () => {
        const first = getScopedClient('admin:x', f.create)!;
        await tick(); // interleave with the other requests
        const again = getScopedClient('admin:x', f.create)!;
        assert.strictEqual(again, first, 'stable within its own request');
        return first.id;
      })
    )
  );
  assert.strictEqual(new Set(seen).size, 20, 'each concurrent request got its own client');
  assert.strictEqual(f.closed.length, 20, 'all 20 clients closed');
});

test('DB Scope - clients are closed even when the request throws', async () => {
  const f = makeFactory();
  await assert.rejects(
    runWithDbScope(async () => {
      getScopedClient('admin:x', f.create);
      throw new Error('boom');
    })
  );
  assert.deepStrictEqual(f.closed, [1]);
});

test('DB Scope - drop closes and replaces the client (retry after connection error)', async () => {
  const f = makeFactory();
  await runWithDbScope(async () => {
    const a = getScopedClient('admin:x', f.create)!;
    await dropScopedClient('admin:x');
    const b = getScopedClient('admin:x', f.create)!;
    assert.notStrictEqual(a, b);
  });
  assert.deepStrictEqual(f.closed.sort(), [1, 2]);
});

test('DB Scope - waitUntil receives the disposal so the response is not delayed', async () => {
  const f = makeFactory();
  let pending: Promise<unknown> | null = null;
  await runWithDbScope(async () => { getScopedClient('admin:x', f.create); }, (p) => { pending = p; });
  assert.ok(pending, 'disposal handed to waitUntil');
  await pending;
  assert.deepStrictEqual(f.closed, [1]);
});

test('DB Scope - a later request reuses the closed client instead of building a new one', async () => {
  const f = makeFactory();
  const first = await runWithDbScope(async () => getScopedClient('app:x', f.create)!);
  const second = await runWithDbScope(async () => getScopedClient('app:x', f.create)!);
  assert.strictEqual(second, first, 'same client object');
  assert.deepStrictEqual(f.created, [1], 'built once');
  assert.deepStrictEqual(f.closed, [1, 1], 'its connections were closed after each request');
});

test('DB Scope - concurrent requests never share a client, even with parked ones available', async () => {
  const f = makeFactory();
  await runWithDbScope(async () => { getScopedClient('app:x', f.create); });
  const ids = await Promise.all(
    Array.from({ length: 6 }, () =>
      runWithDbScope(async () => {
        const c = getScopedClient('app:x', f.create)!;
        await tick();
        return c.id;
      })
    )
  );
  assert.strictEqual(new Set(ids).size, 6, 'each in-flight request holds its own client');
  assert.ok(ids.includes(1), 'the parked client went to one of them');
});

test('DB Scope - a client whose close fails is discarded, not reused', async () => {
  let built = 0;
  const create = () => ({ client: { id: ++built }, close: async () => { throw new Error('socket already gone'); } });
  await runWithDbScope(async () => { getScopedClient('app:x', create); });
  const next = await runWithDbScope(async () => getScopedClient('app:x', create)!);
  assert.strictEqual(next.id, 2);
});

test('DB Scope - a dropped client (connection error) is never handed to another request', async () => {
  const f = makeFactory();
  await runWithDbScope(async () => {
    getScopedClient('app:x', f.create);
    await dropScopedClient('app:x');
  });
  const next = await runWithDbScope(async () => getScopedClient('app:x', f.create)!);
  assert.strictEqual(next.id, 2);
});

test('DB Scope - at most 4 clients are parked per key', async () => {
  const f = makeFactory();
  await Promise.all(Array.from({ length: 7 }, () => runWithDbScope(async () => { getScopedClient('app:x', f.create); await tick(); })));
  const reused = await Promise.all(Array.from({ length: 7 }, () => runWithDbScope(async () => { const c = getScopedClient('app:x', f.create)!; await tick(); return c.id; })));
  assert.strictEqual(reused.filter((id) => id <= 7).length, 4);
});
