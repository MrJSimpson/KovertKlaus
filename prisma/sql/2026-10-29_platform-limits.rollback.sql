-- =============================================================================
-- Rollback for 2026-10-29_platform-limits.forward.sql
--
-- What: drops the four platform-limit columns from admin."SystemConfig" and
-- puts "maxWishlistItems" back to 50. Deploy the old build first: the new build
-- cannot read SystemConfig without these columns.
--
-- Safety:
--   * Only the settings are lost (the release stage returns to the code
--     constant, ALPHA). No user data.
--   * Runs in one transaction.
-- =============================================================================

BEGIN;

ALTER TABLE admin."SystemConfig" DROP COLUMN IF EXISTS "maxActiveHostedMissions";
ALTER TABLE admin."SystemConfig" DROP COLUMN IF EXISTS "maxMissionAgents";
ALTER TABLE admin."SystemConfig" DROP COLUMN IF EXISTS "maxItemQuantity";
ALTER TABLE admin."SystemConfig" DROP COLUMN IF EXISTS "releaseStage";

ALTER TABLE admin."SystemConfig" ALTER COLUMN "maxWishlistItems" SET DEFAULT 50;
UPDATE admin."SystemConfig" SET "maxWishlistItems" = 50 WHERE "maxWishlistItems" = 20;

COMMIT;
