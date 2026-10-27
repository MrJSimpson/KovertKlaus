-- =============================================================================
-- Rollback for 2026-10-27_feedback.forward.sql
--
-- What: drops app."Feedback". Deploy the old build first.
--
-- Safety:
--   * Every feedback submission is lost. Check or export first:
--       SELECT count(*) FROM app."Feedback";
--   * Runs in one transaction.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS app."Feedback";

COMMIT;
