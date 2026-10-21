-- =============================================================================
-- Pre-draw repair window (run BEFORE deploying the new build)
--
-- What: Exchange columns "repairDeadline", "repairIssues" (JSON text) and
-- "repairNoticeAt". A mission whose draw is blocked (too few agents, a missing
-- address, an empty wishlist, impossible match rules) is paused until
-- "repairDeadline", then resumed or cancelled. See src/lib/mission-repair.ts.
--
-- Safety:
--   * Additive and nullable: the running (old) build never reads the columns.
--   * Rerunning is a no-op (IF NOT EXISTS).
--   * Requires 2026-10-21_mission-cancellation.forward.sql (already applied).
--
-- Rollback: 2026-10-21_draw-repair.rollback.sql
-- =============================================================================

BEGIN;

ALTER TABLE app."Exchange" ADD COLUMN IF NOT EXISTS "repairDeadline" TIMESTAMP(3);
ALTER TABLE app."Exchange" ADD COLUMN IF NOT EXISTS "repairIssues" TEXT;
ALTER TABLE app."Exchange" ADD COLUMN IF NOT EXISTS "repairNoticeAt" TIMESTAMP(3);

COMMIT;
