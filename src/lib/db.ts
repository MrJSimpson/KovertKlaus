import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool as NeonPool } from '@neondatabase/serverless';
import pg from 'pg';

let cachedDb: PrismaClient | null = null;
let lastConnStr: string = '';

export function getDb(overrideConnStr?: string): PrismaClient {
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
    adapter = new PrismaNeon({ connectionString });
  } else {
    const pool = new pg.Pool({
      connectionString,
      ssl: !isLocalhost || connectionString.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    adapter = new PrismaPg(pool);
  }

  cachedDb = new PrismaClient({ adapter });
  lastConnStr = connectionString;
  return cachedDb;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});

