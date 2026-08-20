import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool as NeonPool } from '@neondatabase/serverless';
import pg from 'pg';

const adminConnectionString =
  process.env.DATABASE_ADMIN_URL ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "postgresql://kovert:kovertsecret@localhost:5433/kovertklaus?schema=public";

const isNeon = adminConnectionString.includes('neon.tech');
const isLocalhost = adminConnectionString.includes('localhost') || adminConnectionString.includes('127.0.0.1');

function createAdminAdapter() {
  if (isNeon) {
    const pool = new NeonPool({ connectionString: adminConnectionString });
    return new PrismaNeon(pool as any);
  }
  const adminPool = new pg.Pool({
    connectionString: adminConnectionString,
    ssl: !isLocalhost || adminConnectionString.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  return new PrismaPg(adminPool);
}

const adminAdapter = createAdminAdapter();

const globalForAdminPrisma = global as unknown as { adminPrisma: PrismaClient };

export const adminDb = globalForAdminPrisma.adminPrisma || new PrismaClient({ adapter: adminAdapter });

if (process.env.NODE_ENV !== 'production') globalForAdminPrisma.adminPrisma = adminDb;
