import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import ws from 'ws';

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
let cachedPool: pg.Pool | null = null;
let lastConnStr: string = '';

const BACKOFF_DELAYS = [500, 1200, 2500];

/**
 * Tears down active database connections and closes underlying connection pools
 * before wiping references to prevent socket and connection leaks.
 */
export async function invalidateCachedDb(): Promise<void> {
  const dbToDisconnect = cachedDb;
  const poolToClose = cachedPool;

  cachedDb = null;
  cachedPool = null;
  lastConnStr = '';

  if (dbToDisconnect) {
    try {
      await dbToDisconnect.$disconnect();
    } catch (err) {
      console.warn('[DB Teardown] Error disconnecting Prisma client:', err);
    }
  }

  if (poolToClose) {
    try {
      await poolToClose.end();
    } catch (err) {
      console.warn('[DB Teardown] Error ending PostgreSQL connection pool:', err);
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

  if (cachedDb && lastConnStr === connectionString) {
    return cachedDb;
  }

  const isNeon = connectionString.includes('neon.tech');
  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  let adapter: any;
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
    const pool = new pg.Pool({
      connectionString,
      ssl: !isLocalhost || connectionString.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    cachedPool = pool;
    adapter = new PrismaPg(pool);
  }

  cachedDb = new PrismaClient({ adapter });
  lastConnStr = connectionString;
  return cachedDb;
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
    } catch (err: any) {
      attempt++;
      const isConnError =
        err?.message?.includes('socket') ||
        err?.message?.includes('connection') ||
        err?.message?.includes('Connection terminated') ||
        err?.message?.includes('closed') ||
        err?.message?.includes('WebSocket') ||
        err?.message?.includes('ECONNRESET') ||
        err?.message?.includes('ETIMEDOUT') ||
        err?.message?.includes('Connection lost') ||
        err?.message?.includes('Can\'t reach database server') ||
        err?.message?.includes('57P01') ||
        err?.message?.includes('terminating connection') ||
        err?.name?.includes('PrismaClientInitializationError') ||
        err?.name?.includes('PrismaClientRustPanicError') ||
        err?.name?.includes('PrismaClientUnknownRequestError');

      if (isConnError && attempt < maxRetries) {
        const delay = BACKOFF_DELAYS[attempt - 1] || 1000;
        console.warn(`[DB Retry] Neon cold start / connection drop detected (attempt ${attempt}/${maxRetries}), reconnecting in ${delay}ms...`, err?.message);
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
function wrapModelDelegate(modelName: string, overrideConnStr?: string): any {
  return new Proxy({}, {
    get(_target, method) {
      return async (...args: any[]) => {
        return withDbRetry(async (freshClient) => {
          const delegate = (freshClient as any)[modelName];
          if (delegate && typeof delegate[method] === 'function') {
            return delegate[method](...args);
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
        return async (arg: any, options?: any) => {
          return withDbRetry(async (freshClient) => {
            return freshClient.$transaction(arg, options);
          }, 3, overrideConnStr);
        };
      }
      if (prop === '$queryRaw' || prop === '$queryRawUnsafe') {
        return async (...args: any[]) => {
          return withDbRetry(async (freshClient) => {
            return (freshClient as any)[prop](...args);
          }, 3, overrideConnStr);
        };
      }
      if (prop === '$executeRaw' || prop === '$executeRawUnsafe') {
        return async (...args: any[]) => {
          return withDbRetry(async (freshClient) => {
            return (freshClient as any)[prop](...args);
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
      const val = (client as any)[prop];
      if (typeof val === 'function') {
        return val.bind(client);
      }
      return val;
    },
  });
}

export const db = getDb();
