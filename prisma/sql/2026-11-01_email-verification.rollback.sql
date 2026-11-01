-- =============================================================================
-- Rollback for 2026-11-01_email-verification.forward.sql
--
-- Deploy the previous build FIRST (it never reads the column), then run this.
-- Dropping the column while the new build is live makes every signed-in
-- request fail.
-- =============================================================================

BEGIN;

ALTER TABLE app."User" DROP COLUMN IF EXISTS "emailVerifiedAt";

COMMIT;
