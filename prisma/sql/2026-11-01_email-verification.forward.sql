-- =============================================================================
-- Email verification (run BEFORE deploying the new build)
--
-- What: nullable column app."User"."emailVerifiedAt". Null means the agent has
-- not verified their address yet; the new build keeps them out of the
-- dashboard until they do (src/lib/email-verification.ts).
--
-- Existing accounts are grandfathered (owner decision 2026-11-01): every user
-- that exists when this runs is marked verified as of their sign-up time, so
-- nobody already using KovertKlaus is locked out. Only accounts created after
-- the new build deploys have to verify.
--
-- Safety:
--   * Additive: the running (old) build never reads the column, so running this
--     first is safe.
--   * Run it BEFORE the deploy. If the new build deploys first, every account
--     reads as unverified and is sent to the verify-email page until this runs.
--   * Rerunning is a no-op (IF NOT EXISTS; the UPDATE only touches nulls). Do
--     not rerun it after the deploy: it would mark new unverified sign-ups as
--     verified.
--   * Run as the owner role.
--
-- Rollback: 2026-11-01_email-verification.rollback.sql
-- =============================================================================

BEGIN;

ALTER TABLE app."User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

UPDATE app."User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;

COMMIT;
