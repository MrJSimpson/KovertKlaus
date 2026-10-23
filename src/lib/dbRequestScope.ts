import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * @file dbRequestScope.ts
 * @description Per-request database client scope for the Cloudflare edge worker.
 *
 * Tier 1 (what): While a worker request (or cron run) is in flight, `getRawDb()` / `getRawAdminDb()`
 * create their Prisma clients inside this scope instead of the module-level cache, and the scope
 * closes them after the response.
 * Tier 2 (why): Cloudflare Workers bind sockets to the request that opened them. A Neon pool cached
 * at module level and reused by a later or concurrent request throws ("Cannot perform I/O on behalf
 * of a different request"), surfacing as intermittent 500s / error 1101. Node.js (self-hosted Next.js)
 * has no such rule, so outside a scope the existing module cache is used unchanged.
 * Tier 3 (how): `runWithDbScope(fn, waitUntil)` runs `fn` with a fresh scope; clients register a
 * closer via `getScopedClient`; disposal runs through `waitUntil` so it never delays the response.
 * Closing releases a client's connections but keeps the client: it is parked and the next request
 * reuses it (Prisma reconnects on that request's first query, so the new socket belongs to it).
 * Building a Prisma client and compiling its queries cost most of a request's CPU time, and reuse
 * keeps both. A parked client is only ever held by one request at a time.
 */

/** A client created inside a scope, with the function that releases its connections. */
interface ScopedClient<T> {
  client: T;
  /** Releases the client's connections. The client stays usable and reconnects when next queried. */
  close: () => Promise<void>;
}

/** Clients created during one request, keyed by role + connection string. */
interface DbScope {
  clients: Map<string, ScopedClient<unknown>>;
}

const storage = new AsyncLocalStorage<DbScope>();

/** Most parked clients kept per key; enough for a few concurrent requests in one isolate. */
const MAX_PARKED_PER_KEY = 4;

/** Clients whose request has ended and whose connections are closed, ready for the next request. */
const parked = new Map<string, ScopedClient<unknown>[]>();

/** Parks a closed client for reuse, unless the key already has enough parked. */
function park(key: string, entry: ScopedClient<unknown>): void {
  const list = parked.get(key) ?? [];
  if (list.length >= MAX_PARKED_PER_KEY) return;
  list.push(entry);
  parked.set(key, list);
}

/** Forgets every parked client (tests, or after a connection string changes). */
export function clearParkedClients(): void {
  parked.clear();
}

/**
 * Reports whether the caller is running inside a per-request database scope.
 */
export function inDbScope(): boolean {
  return storage.getStore() !== undefined;
}

/**
 * Returns the scope's client for `key`, creating it with `create` on first use.
 *
 * Tier 1: Within one request every call with the same key shares one client.
 * Tier 2: Concurrent requests never share a client, so no socket crosses requests. A later request
 * may get a parked client back, with its connections already closed.
 * Tier 3: Returns `undefined` outside a scope so callers fall back to their module cache.
 */
export function getScopedClient<T>(key: string, create: () => ScopedClient<T>): T | undefined {
  const scope = storage.getStore();
  if (!scope) return undefined;
  const existing = scope.clients.get(key) as ScopedClient<T> | undefined;
  if (existing) return existing.client;
  const entry = (parked.get(key)?.pop() as ScopedClient<T> | undefined) ?? create();
  scope.clients.set(key, entry as ScopedClient<unknown>);
  return entry.client;
}

/**
 * Drops and closes the scope's client for `key` (used by retry logic after connection errors).
 * A dropped client is never parked, so a broken one is not handed to another request.
 */
export async function dropScopedClient(key: string): Promise<void> {
  const scope = storage.getStore();
  const entry = scope?.clients.get(key);
  if (!scope || !entry) return;
  scope.clients.delete(key);
  await entry.close().catch(() => {});
}

/**
 * Closes every client used in a scope and parks it for reuse. Never throws; a client whose close
 * fails is discarded instead of parked.
 */
async function disposeScope(scope: DbScope): Promise<void> {
  const entries = [...scope.clients];
  scope.clients.clear();
  await Promise.all(
    entries.map(([key, entry]) =>
      entry.close().then(
        () => park(key, entry),
        () => {}
      )
    )
  );
}

/**
 * Runs `fn` inside a fresh per-request database scope.
 *
 * Tier 1: All Prisma clients created during `fn` belong to this request only.
 * Tier 2: Connections are closed after `fn` settles; with `waitUntil` the close happens after the
 * response is returned, so it adds no latency.
 * Tier 3: Use in the worker's `fetch` and `scheduled` entry points.
 */
export async function runWithDbScope<T>(fn: () => Promise<T>, waitUntil?: (p: Promise<unknown>) => void): Promise<T> {
  const scope: DbScope = { clients: new Map() };
  try {
    return await storage.run(scope, fn);
  } finally {
    const disposal = disposeScope(scope);
    if (waitUntil) waitUntil(disposal);
    else await disposal;
  }
}
