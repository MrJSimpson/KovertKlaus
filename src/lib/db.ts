import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { dropScopedClient, getScopedClient, inDbScope } from './dbRequestScope';
import { isDbConnectionError } from './db-errors';

// In Node.js runtimes, configure ws constructor for Neon WebSocket communication
if (typeof process !== 'undefined' && process.versions?.node) {
  try {
    neonConfig.webSocketConstructor = ws;
  } catch {
    // Ignore in non-Node runtimes
  }
}

// Global Neon engine optimizations: fast pipelined handshakes
neonConfig.pipelineConnect = 'password';

let cachedDb: PrismaClient | null = null;
let lastConnStr: string = '';

const BACKOFF_DELAYS = [500, 1200, 2500];

/** A Prisma method looked up by name at runtime (model delegate methods and raw-query methods). */
type DynamicMethod = (...args: unknown[]) => Promise<unknown>;
type MethodTable = Record<PropertyKey, DynamicMethod | undefined>;

/** Options accepted by the callback form of `$transaction`. */
interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Tears down active database connections and closes underlying connection pools
 * before wiping references to prevent socket and connection leaks.
 */
export async function invalidateCachedDb(): Promise<void> {
  if (inDbScope()) {
    const scopedConn = process.env.DATABASE_URL;
    if (scopedConn) await dropScopedClient(`app:${scopedConn}`);
    return;
  }
  const dbToDisconnect = cachedDb;

  cachedDb = null;
  lastConnStr = '';

  if (dbToDisconnect) {
    try {
      await dbToDisconnect.$disconnect();
    } catch (err) {
      console.warn('[DB Teardown] Error disconnecting Prisma client:', err);
    }
  }
}

export function getRawDb(overrideConnStr?: string): PrismaClient {
  const connectionString =
    overrideConnStr ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in the environment.');
  }

  // Edge worker: one client per request (sockets cannot cross requests). Node.js: module cache.
  const scoped = getScopedClient(`app:${connectionString}`, () => createAppClient(connectionString));
  if (scoped) return scoped;

  if (cachedDb && lastConnStr === connectionString) {
    return cachedDb;
  }

  const created = createAppClient(connectionString);
  cachedDb = created.client;
  lastConnStr = connectionString;
  return cachedDb;
}

/**
 * Builds a Prisma client (Neon WebSocket adapter for neon.tech, pg pool otherwise) together with
 * a closer that releases its connections. Used for both the module cache and per-request scopes.
 */
function createAppClient(connectionString: string): { client: PrismaClient; close: () => Promise<void> } {
  const isNeon = connectionString.includes('neon.tech');
  const isLocalOrInternal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('kovertklaus-db') ||
    connectionString.includes('sslmode=disable');

  const requiresSsl =
    connectionString.includes('sslmode=require') ||
    (!isLocalOrInternal && !connectionString.includes('sslmode=disable'));

  let adapter: PrismaNeon | PrismaPg;
  if (isNeon) {
    adapter = new PrismaNeon(
      {
        connectionString,
        connectionTimeoutMillis: 15000, // 15s extended timeout for Neon compute cold starts
        max: 10,
      },
      {
        onPoolError: (err) => console.warn('[Neon Pool Warning]', err?.message || err),
        onConnectionError: (err) => console.warn('[Neon Connection Warning]', err?.message || err),
      }
    );
  } else {
    // The adapter owns its pool: $disconnect ends it and the next query opens a new one, so a
    // client parked between worker requests (src/lib/dbRequestScope.ts) never keeps an old socket.
    adapter = new PrismaPg({
      connectionString,
      ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  const client = new PrismaClient({ adapter });
  return {
    client,
    // Rejects when the disconnect fails, so the request scope discards the client instead of parking it.
    close: () => client.$disconnect(),
  };
}

/**
 * Executes a database callback function with automatic retry and exponential backoff
 * to self-heal against Neon scale-to-zero compute cold starts and stale WebSocket drops.
 */
export async function withDbRetry<T>(
  fn: (client: PrismaClient) => Promise<T>,
  maxRetries = 3,
  overrideConnStr?: string
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      const client = getRawDb(overrideConnStr);
      return await fn(client);
    } catch (err) {
      attempt++;
      if (isDbConnectionError(err) && attempt < maxRetries) {
        const delay = BACKOFF_DELAYS[attempt - 1] || 1000;
        console.warn(`[DB Retry] Neon cold start / connection drop detected (attempt ${attempt}/${maxRetries}), reconnecting in ${delay}ms...`, err instanceof Error ? err.message : err);
        await invalidateCachedDb();
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Wraps a Prisma model delegate (e.g. db.user, db.exchange, db.systemLog) so that
 * all queries automatically execute with transparent cold-start retry protection.
 */
function wrapModelDelegate(modelName: string, overrideConnStr?: string): object {
  return new Proxy({}, {
    get(_target, method) {
      return async (...args: unknown[]) => {
        return withDbRetry(async (freshClient) => {
          const delegate = (freshClient as unknown as Record<string, MethodTable | undefined>)[modelName];
          const fn = delegate?.[method];
          if (delegate && typeof fn === 'function') {
            return fn.apply(delegate, args);
          }
          throw new Error(`Method ${String(method)} not found on model delegate ${modelName}`);
        }, 3, overrideConnStr);
      };
    },
  });
}

/**
 * Factory that returns a resilient self-healing Prisma Proxy for any connection string.
 */
export function getDb(overrideConnStr?: string): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      // Special top-level Prisma methods
      if (prop === '$transaction') {
        // Callback form only: an array of already-built queries could not be rebuilt on a retry.
        return async <T>(arg: (tx: Prisma.TransactionClient) => Promise<T>, options?: TransactionOptions) => {
          return withDbRetry(async (freshClient) => {
            return freshClient.$transaction(arg, options);
          }, 3, overrideConnStr);
        };
      }
      if (prop === '$queryRaw' || prop === '$queryRawUnsafe') {
        return async (...args: unknown[]) => {
          return withDbRetry(async (freshClient) => {
            const raw = (freshClient as unknown as MethodTable)[prop];
            if (!raw) throw new Error(`Method ${prop} not found on the Prisma client`);
            return raw.apply(freshClient, args);
          }, 3, overrideConnStr);
        };
      }
      if (prop === '$executeRaw' || prop === '$executeRawUnsafe') {
        return async (...args: unknown[]) => {
          return withDbRetry(async (freshClient) => {
            const raw = (freshClient as unknown as MethodTable)[prop];
            if (!raw) throw new Error(`Method ${prop} not found on the Prisma client`);
            return raw.apply(freshClient, args);
          }, 3, overrideConnStr);
        };
      }
      if (prop === '$connect') {
        return async () => {
          return withDbRetry(async (freshClient) => freshClient.$connect(), 3, overrideConnStr);
        };
      }
      if (prop === '$disconnect') {
        return invalidateCachedDb;
      }

      // Wrap model delegates for transparent self-healing
      if (typeof prop === 'string' && !prop.startsWith('_') && !prop.startsWith('$')) {
        return wrapModelDelegate(prop, overrideConnStr);
      }

      const client = getRawDb(overrideConnStr);
      const val: unknown = Reflect.get(client, prop);
      if (typeof val === 'function') {
        return val.bind(client);
      }
      return val;
    },
  });
}

export const db = getDb();
