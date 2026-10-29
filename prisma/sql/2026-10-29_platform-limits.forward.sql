-- =============================================================================
-- Platform limits and release stage (run BEFORE deploying the new build)
--
-- What: four columns on admin."SystemConfig", edited in North Pole -> Config:
--   * "maxActiveHostedMissions" (5): missions one Head Elf can run at once
--   * "maxMissionAgents" (50): agents per mission (a Head Elf's cap may be lower)
--   * "maxItemQuantity" (25): quantity per Secret Santa wishlist item
--   * "releaseStage" ('ALPHA'): 'ALPHA' needs a code to register; 'BETA' is open
-- and "maxWishlistItems" changes from 50 to 20 (default and the current row).
-- Bounds live in src/lib/platform-limits.ts; the server refuses values outside
-- them.
--
-- Safety:
--   * Adds columns with defaults; the running (old) build never reads them.
--   * The new build reads them on every config load, so run this first. The
--     schema-pushed gate holds the deploy until then.
--   * Admin schema: owner-only. Run as the owner.
--   * Rerunning is a no-op (IF NOT EXISTS; the UPDATE only touches 50).
--
-- Rollback: 2026-10-29_platform-limits.rollback.sql
-- =============================================================================

BEGIN;

ALTER TABLE admin."SystemConfig" ADD COLUMN IF NOT EXISTS "maxActiveHostedMissions" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE admin."SystemConfig" ADD COLUMN IF NOT EXISTS "maxMissionAgents" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE admin."SystemConfig" ADD COLUMN IF NOT EXISTS "maxItemQuantity" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE admin."SystemConfig" ADD COLUMN IF NOT EXISTS "releaseStage" TEXT NOT NULL DEFAULT 'ALPHA';

ALTER TABLE admin."SystemConfig" ALTER COLUMN "maxWishlistItems" SET DEFAULT 20;
UPDATE admin."SystemConfig" SET "maxWishlistItems" = 20 WHERE "maxWishlistItems" = 50;

COMMIT;
