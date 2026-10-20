-- =============================================================================
-- Rollback for 2026-10-20_mission-codenames.forward.sql (and .cleanup.sql)
--
-- Restores the schema the previous build expects. Data is NOT restored:
--   * renamed duplicates and pool names given to blank members stay as they are;
--   * if the cleanup script ran, the User codename columns come back empty.
--     Restore them from the pre-migration backup if they matter.
-- Deploy the previous build right after running this.
-- =============================================================================
BEGIN;

DROP INDEX IF EXISTS app."ExchangeMember_exchangeId_codename_key";
CREATE INDEX IF NOT EXISTS "ExchangeMember_exchangeId_codename_idx"
  ON app."ExchangeMember" ("exchangeId", codename);
ALTER TABLE app."ExchangeMember" DROP COLUMN IF EXISTS "codenameAcceptedAt";

ALTER TABLE app."User" ADD COLUMN IF NOT EXISTS codename TEXT;
ALTER TABLE app."User" ADD COLUMN IF NOT EXISTS "preferredCodename" TEXT;
ALTER TABLE app."User" ADD COLUMN IF NOT EXISTS "autoRandomizeCodename" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
