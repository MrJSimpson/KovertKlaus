-- =============================================================================
-- Rollback for 2026-11-01_email-quota-setting.forward.sql
--
-- Deploy the previous build FIRST (it never reads these columns), then run this.
-- The quota goes back to the code default (300 a day).
-- =============================================================================

BEGIN;

ALTER TABLE "admin"."SystemConfig"
  DROP COLUMN IF EXISTS "emailQuotaPeriod",
  DROP COLUMN IF EXISTS "emailQuota",
  DROP COLUMN IF EXISTS "emailQuotaResetDay",
  DROP COLUMN IF EXISTS "emailDailyCap";

COMMIT;
