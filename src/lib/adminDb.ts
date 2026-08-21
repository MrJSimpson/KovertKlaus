import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaNeon } from '@prisma/adapter-neon';
import pg from 'pg';

let cachedAdminDb: PrismaClient | null = null;
let lastAdminConnStr: string = '';

export function invalidateCachedAdminDb(): void {
  cachedAdminDb = null;
  lastAdminConnStr = '';
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
    adapter = new PrismaNeon({
      connectionString: adminConnectionString,
      connectionTimeoutMillis: 10000,
    });
  } else {
    const adminPool = new pg.Pool({
      connectionString: adminConnectionString,
      ssl: !isLocalhost || adminConnectionString.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    adapter = new PrismaPg(adminPool);
  }

  cachedAdminDb = new PrismaClient({ adapter });
  lastAdminConnStr = adminConnectionString;
  return cachedAdminDb;
}

export async function withAdminDbRetry<T>(fn: (client: PrismaClient) => Promise<T>, maxRetries = 2): Promise<T> {
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
        err?.name?.includes('PrismaClientInitializationError') ||
        err?.name?.includes('PrismaClientRustPanicError');

      if (isConnError && attempt < maxRetries) {
        console.warn(`[AdminDB Retry] Neon connection issue (attempt ${attempt}/${maxRetries}), reconnecting...`, err.message);
        invalidateCachedAdminDb();
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      throw err;
    }
  }
}

export const adminDb = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getAdminDb();
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});
