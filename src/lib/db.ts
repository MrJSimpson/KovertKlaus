import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool as NeonPool } from '@neondatabase/serverless';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || "postgresql://kovert:kovertsecret@localhost:5433/kovertklaus?schema=public";

const isNeon = connectionString.includes('neon.tech');
const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

function createAppAdapter() {
  if (isNeon) {
    const pool = new NeonPool({ connectionString });
    return new PrismaNeon(pool as any);
  }
  const pool = new pg.Pool({
    connectionString,
    ssl: !isLocalhost || connectionString.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  return new PrismaPg(pool);
}

const adapter = createAppAdapter();

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
