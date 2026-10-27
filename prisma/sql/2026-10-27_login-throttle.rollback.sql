-- =============================================================================
-- Rollback for 2026-10-27_login-throttle.forward.sql
--
-- What: drops admin."LoginThrottle". Deploy the old build first (the new build
-- fails open without the table, but logs an error on every sign-in).
--
-- Safety:
--   * Only failure counters are lost; nothing user-facing.
--   * Runs in one transaction.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS admin."LoginThrottle";

COMMIT;
