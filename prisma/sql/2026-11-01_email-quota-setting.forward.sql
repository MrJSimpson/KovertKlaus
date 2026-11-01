-- =============================================================================
-- Email quota as a North Pole setting (run BEFORE deploying the new build)
--
-- What: four columns on admin."SystemConfig" for the Brevo sending allowance:
-- emailQuotaPeriod (DAY | MONTH), emailQuota, emailQuotaResetDay (1-28) and
-- emailDailyCap (0 = none). Replaces the EMAIL_DAILY_QUOTA env var
-- (src/lib/email/quota-config.ts).
--
-- Safety:
--   * Additive, with defaults equal to today's behaviour (300 a day), so the
--     running (old) build is unaffected and nothing changes until an admin
--     edits the setting.
--   * Admin schema: run as the owner role.
--   * Rerunning is a no-op (IF NOT EXISTS).
--
-- Generated with `prisma migrate diff` from the release branch schema.
-- Rollback: 2026-11-01_email-quota-setting.rollback.sql
-- =============================================================================

BEGIN;

ALTER TABLE "admin"."SystemConfig"
  ADD COLUMN IF NOT EXISTS "emailQuotaPeriod" TEXT NOT NULL DEFAULT 'DAY',
  ADD COLUMN IF NOT EXISTS "emailQuota" INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS "emailQuotaResetDay" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "emailDailyCap" INTEGER NOT NULL DEFAULT 0;

COMMIT;
