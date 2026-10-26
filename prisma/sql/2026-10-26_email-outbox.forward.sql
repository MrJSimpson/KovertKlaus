-- =============================================================================
-- Email daily limit: send ledger and held emails (run BEFORE deploying the new build)
--
-- What: table admin."EmailOutbox". Every Brevo send adds a SENT row (counts
-- only, no content); an email over the daily cap is kept as a HELD row and sent
-- after midnight Pacific by the hourly cron. See src/lib/email/daily-limit.ts.
--
-- Safety:
--   * New table only: the running (old) build never reads it.
--   * Admin schema: owner-only, nothing is granted to the app role (held rows
--     contain email content such as assignment details). Run as the owner.
--   * Rerunning is a no-op (IF NOT EXISTS).
--
-- Rollback: 2026-10-26_email-outbox.rollback.sql
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS admin."EmailOutbox" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recipients" INTEGER NOT NULL DEFAULT 1,
    "subject" TEXT NOT NULL,
    "message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailOutbox_status_createdAt_idx" ON admin."EmailOutbox"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailOutbox_status_sentAt_idx" ON admin."EmailOutbox"("status", "sentAt");

COMMIT;
