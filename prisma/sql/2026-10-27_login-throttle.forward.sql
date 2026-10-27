-- =============================================================================
-- Sign-in rate limiting (run BEFORE deploying the new build)
--
-- What: table admin."LoginThrottle". One row per failed sign-in (agent or North
-- Pole), keyed by HMAC digests of the account and IP, never the values. Rows
-- older than a day are purged by the hourly cron. See src/lib/login-throttle.ts.
--
-- Safety:
--   * New table only: the running (old) build never reads it.
--   * Admin schema: owner-only, nothing is granted to the app role. Run as the
--     owner.
--   * The new build fails open if this table is missing (sign-ins still work,
--     unthrottled), but run it first anyway.
--   * Rerunning is a no-op (IF NOT EXISTS).
--
-- Rollback: 2026-10-27_login-throttle.rollback.sql
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS admin."LoginThrottle" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "accountHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoginThrottle_scope_accountHash_createdAt_idx" ON admin."LoginThrottle"("scope", "accountHash", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginThrottle_scope_ipHash_createdAt_idx" ON admin."LoginThrottle"("scope", "ipHash", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginThrottle_createdAt_idx" ON admin."LoginThrottle"("createdAt");

COMMIT;
