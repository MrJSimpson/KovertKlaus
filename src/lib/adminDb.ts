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

let cachedAdminDb: PrismaClient | null = null;

let cachedAdminPool: pg.Pool | null = null;
let lastAdminConnStr: string = '';

const BACKOFF_DELAYS = [500, 1200, 2500];

/**
 * Tears down active admin database connections and closes underlying connection pools
 * before wiping references to prevent socket and connection leaks.
 */
export async function invalidateCachedAdminDb(): Promise<void> {
  const dbToDisconnect = cachedAdminDb;
  const poolToClose = cachedAdminPool;

  cachedAdminDb = null;
  cachedAdminPool = null;
  lastAdminConnStr = '';

  if (dbToDisconnect) {
    try {
      await dbToDisconnect.$disconnect();
    } catch (err) {
      console.warn('[AdminDB Teardown] Error disconnecting Prisma client:', err);
    }
  }

  if (poolToClose) {
    try {
      await poolToClose.end();
    } catch (err) {
      console.warn('[AdminDB Teardown] Error ending Admin PostgreSQL pool:', err);
    }
  }
}

export function getAdminDb(overrideConnStr?: string): PrismaClient {
  const adminConnectionString =
    overrideConnStr ||
    process.env.DATABASE_ADMIN_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL;

  if (!adminConnectionString) {
    throw new Error('DATABASE_ADMIN_URL (or DATABASE_URL) is not defined in the environment.');
  }

  if (cachedAdminDb && lastAdminConnStr === adminConnectionString) {
    return cachedAdminDb;
  }

  const isNeon = adminConnectionString.includes('neon.tech');
  const isLocalhost = adminConnectionString.includes('localhost') || adminConnectionString.includes('127.0.0.1');

  let adapter: any;
  if (isNeon) {
    adapter = new PrismaNeon(
      {
        connectionString: adminConnectionString,
        connectionTimeoutMillis: 15000, // 15s extended timeout for Neon compute cold starts
        max: 5,
      },
      {
        onPoolError: (err) => console.warn('[Admin Neon Pool Warning]', err?.message || err),
        onConnectionError: (err) => console.warn('[Admin Neon Connection Warning]', err?.message || err),
      }
    );
  } else {
    const adminPool = new pg.Pool({
      connectionString: adminConnectionString,
      ssl: !isLocalhost || adminConnectionString.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    cachedAdminPool = adminPool;
    adapter = new PrismaPg(adminPool);
  }

  cachedAdminDb = new PrismaClient({ adapter });
  lastAdminConnStr = adminConnectionString;
  return cachedAdminDb;
}

/**
 * Executes an administrative database callback with automatic retry and exponential backoff
 * to self-heal against Neon scale-to-zero compute cold starts and stale WebSocket drops.
 */
export async function withAdminDbRetry<T>(fn: (client: PrismaClient) => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      const client = getAdminDb();
      return await fn(client);
    } catch (err: any) {
      attempt++;
      const isConnError =
        err?.message?.includes('socket') ||
        err?.message?.includes('connection') ||
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
        console.warn(`[AdminDB Retry] Neon cold start / connection drop detected (attempt ${attempt}/${maxRetries}), reconnecting in ${delay}ms...`, err?.message);
        await invalidateCachedAdminDb();
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Wraps an administrative Prisma model delegate (e.g. adminDb.systemConfig, adminDb.clearanceLead, adminDb.systemLog)
 * so that all queries automatically execute with transparent cold-start retry protection.
 */
function wrapAdminModelDelegate(modelName: string): any {
  return new Proxy({}, {
    get(_target, method) {
      return async (...args: any[]) => {
        return withAdminDbRetry(async (freshClient) => {
          const delegate = (freshClient as any)[modelName];
          if (delegate && typeof delegate[method] === 'function') {
            return delegate[method](...args);
          }
          throw new Error(`Method ${String(method)} not found on admin model delegate ${modelName}`);
        });
      };
    },
  });
}

export const adminDb = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    // Special top-level Prisma methods
    if (prop === '$transaction') {
      return async (arg: any, options?: any) => {
        return withAdminDbRetry(async (freshClient) => {
          return freshClient.$transaction(arg, options);
        });
      };
    }
    if (prop === '$queryRaw' || prop === '$queryRawUnsafe') {
      return async (...args: any[]) => {
        return withAdminDbRetry(async (freshClient) => {
          return (freshClient as any)[prop](...args);
        });
      };
    }
    if (prop === '$executeRaw' || prop === '$executeRawUnsafe') {
      return async (...args: any[]) => {
        return withAdminDbRetry(async (freshClient) => {
          return (freshClient as any)[prop](...args);
        });
      };
    }
    if (prop === '$connect') {
      return async () => {
        return withAdminDbRetry(async (freshClient) => freshClient.$connect());
      };
    }
    if (prop === '$disconnect') {
      return invalidateCachedAdminDb;
    }

    // Wrap model delegates for transparent self-healing
    if (typeof prop === 'string' && !prop.startsWith('_') && !prop.startsWith('$')) {
      return wrapAdminModelDelegate(prop);
    }

    const client = getAdminDb();
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});
