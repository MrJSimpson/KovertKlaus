-- =============================================================================
-- Rollback for 2026-10-21_draw-repair.forward.sql
--
-- What: drops the three repair columns. Deploy the old build first.
--
-- Safety:
--   * Missions paused for repair are RECRUITING with these columns set. After
--     the rollback they are ordinary RECRUITING missions past their cutoff; the
--     old build moves them to SETUP on its next sweep and notifies the Head Elf
--     hourly as before. Nothing else is lost.
--   * Runs in one transaction.
-- =============================================================================

BEGIN;

ALTER TABLE app."Exchange" DROP COLUMN IF EXISTS "repairNoticeAt";
ALTER TABLE app."Exchange" DROP COLUMN IF EXISTS "repairIssues";
ALTER TABLE app."Exchange" DROP COLUMN IF EXISTS "repairDeadline";

COMMIT;
