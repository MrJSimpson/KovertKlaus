-- =============================================================================
-- Rollback for 2026-11-01_join-requests.forward.sql
--
-- Deploy the previous build FIRST (it never reads the table), then run this.
-- Pending requests are lost; agents can ask again or be invited by email.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS "app"."MissionJoinRequest";
DROP TYPE IF EXISTS "app"."JoinRequestStatus";

COMMIT;
