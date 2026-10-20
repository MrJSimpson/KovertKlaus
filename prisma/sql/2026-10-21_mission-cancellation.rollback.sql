-- =============================================================================
-- Rollback for 2026-10-21_mission-cancellation.forward.sql
--
-- What: drops MissionHistory, Notification."dedupeKey" and its index, the
-- Exchange cancellation columns and app."MissionActor", then rebuilds
-- app."ExchangeStatus" without 'CANCELLED' (Postgres cannot drop an enum value).
--
-- Safety:
--   * Deploy the old build first, so nothing writes the new columns.
--   * Stops with an error if any mission is still CANCELLED: the old build has
--     no such status. Delete those missions (or restore the backup) first.
--   * MissionHistory rows are lost. Notifications keep their rows; only the
--     dedupe key goes.
--   * Runs in one transaction: it applies fully or not at all.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app."Exchange" WHERE status::text = 'CANCELLED') THEN
    RAISE EXCEPTION 'Cancelled missions exist; delete them or restore the backup before rolling back.';
  END IF;
END
$$;

DROP TABLE IF EXISTS app."MissionHistory";

DROP INDEX IF EXISTS app."Notification_userId_dedupeKey_key";
ALTER TABLE app."Notification" DROP COLUMN IF EXISTS "dedupeKey";

ALTER TABLE app."Exchange" DROP COLUMN IF EXISTS "cancelledFromStatus";
ALTER TABLE app."Exchange" DROP COLUMN IF EXISTS "cancelCode";
ALTER TABLE app."Exchange" DROP COLUMN IF EXISTS "cancelReason";
ALTER TABLE app."Exchange" DROP COLUMN IF EXISTS "cancelledBy";
ALTER TABLE app."Exchange" DROP COLUMN IF EXISTS "cancelledAt";

DROP TYPE IF EXISTS app."MissionActor";

-- Rebuild ExchangeStatus without CANCELLED.
ALTER TYPE app."ExchangeStatus" RENAME TO "ExchangeStatus_old";
CREATE TYPE app."ExchangeStatus" AS ENUM ('SETUP', 'RECRUITING', 'MATCHED', 'SHIPPED', 'EXECUTED', 'COMPLETED');
ALTER TABLE app."Exchange" ALTER COLUMN status DROP DEFAULT;
ALTER TABLE app."Exchange" ALTER COLUMN status TYPE app."ExchangeStatus" USING status::text::app."ExchangeStatus";
ALTER TABLE app."Exchange" ALTER COLUMN status SET DEFAULT 'RECRUITING';
DROP TYPE app."ExchangeStatus_old";

COMMIT;
