import test from 'node:test';
import assert from 'node:assert';
import { dropScopedClient, getScopedClient, inDbScope, runWithDbScope } from './dbRequestScope';

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
