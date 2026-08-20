import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * Isolated Administrator Database Client (`adminDb`)
 * 
 * Security & Privilege Separation Invariant:
 * 1. Connects to `DATABASE_ADMIN_URL` if provided (hardened mode with privileged administrative database role).
 * 2. Gracefully falls back to `DATABASE_URL` (or local docker postgres) when `DATABASE_ADMIN_URL` is omitted,
 *    maintaining 100% zero-configuration for local development and self-hosted environments.
 * 3. Restricts blast radius: In hardened production, public user endpoints connect via `db` using a restricted role
 *    (revoked permissions on `AdminUser` and `SystemConfig`), while `/api/northpole/*` routes use `adminDb`.
 */
const adminConnectionString =
  process.env.DATABASE_ADMIN_URL ||
  process.env.DATABASE_URL ||
  "postgresql://kovert:kovertsecret@localhost:5433/kovertklaus?schema=public";

const isLocalhost = adminConnectionString.includes('localhost') || adminConnectionString.includes('127.0.0.1');

const adminPool = new pg.Pool({
  connectionString: adminConnectionString,
  ssl: !isLocalhost || adminConnectionString.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 5, // Dedicated lean connection pool for administrative actions
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const adminAdapter = new PrismaPg(adminPool);

const globalForAdminPrisma = global as unknown as { adminPrisma: PrismaClient };

export const adminDb = globalForAdminPrisma.adminPrisma || new PrismaClient({ adapter: adminAdapter });

if (process.env.NODE_ENV !== 'production') globalForAdminPrisma.adminPrisma = adminDb;
