-- =============================================================================
-- Rollback for 2026-10-26_email-outbox.forward.sql
--
-- What: drops admin."EmailOutbox". Deploy the old build first.
--
-- Safety:
--   * HELD rows are emails not yet sent; they are lost. Check first:
--       SELECT count(*) FROM admin."EmailOutbox" WHERE status = 'HELD';
--   * Runs in one transaction.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS admin."EmailOutbox";

COMMIT;
