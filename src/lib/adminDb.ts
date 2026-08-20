import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool as NeonPool } from '@neondatabase/serverless';
import pg from 'pg';

let cachedAdminDb: PrismaClient | null = null;
let lastAdminConnStr: string = '';

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
    adapter = new PrismaNeon({ connectionString: adminConnectionString });
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

