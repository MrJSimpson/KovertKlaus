import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * Primary Application Database Client (`db`)
 * 
 * Scope & Security Role:
 * - Powers user-facing endpoints: exchange creation, wishlist curation, draws, and logins.
 * - Connects to `DATABASE_URL` (in production, connects to the pooled PgBouncer endpoint).
 * - For administrative operations with defense-in-depth isolation, see `adminDb` in `@/lib/adminDb`.
 */
const connectionString = process.env.DATABASE_URL || "postgresql://kovert:kovertsecret@localhost:5433/kovertklaus?schema=public";

const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new pg.Pool({
  connectionString,
  ssl: !isLocalhost || connectionString.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
