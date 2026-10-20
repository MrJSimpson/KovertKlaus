-- =============================================================================
-- Mission cancellation and deletion (run BEFORE deploying the new build)
--
-- What:
--   1. Enum app."MissionActor" (HEAD_ELF, ADMIN, SYSTEM).
--   2. Enum value app."ExchangeStatus".'CANCELLED'.
--   3. Exchange columns "cancelledAt", "cancelledBy", "cancelReason",
--      "cancelCode", "cancelledFromStatus".
--   4. Notification."dedupeKey" plus a unique index on ("userId", "dedupeKey"),
--      so a repeating notice updates one row instead of adding one per sweep.
--   5. Table app."MissionHistory": one row per deleted mission (outcome and
--      reason only, no title or people).
--
-- Why: Head Elves and North Pole admins can cancel missions; cancelled missions
-- are deleted by hand (48 h after a cancellation before the draw) or
-- automatically 90 days after cancellation. See src/lib/mission-cancel.ts.
--
-- Safety:
--   * Additive: the running (old) build never reads the new columns or table,
--     and no row uses 'CANCELLED' until the new build is live.
--   * Rerunning is a no-op (IF NOT EXISTS everywhere).
--   * Grants: MissionHistory is created by the owner role, so the default
--     privileges from 2026-10-12_schema-separation give kovert_app access. Run
--     this as the same owner role as that script.
--   * Postgres 12+ allows ALTER TYPE ... ADD VALUE inside a transaction; the new
--     value is not used in this transaction.
--
-- Rollback: 2026-10-21_mission-cancellation.rollback.sql
-- =============================================================================

BEGIN;

-- 1. Who cancelled or deleted a mission.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app' AND t.typname = 'MissionActor'
  ) THEN
    CREATE TYPE app."MissionActor" AS ENUM ('HEAD_ELF', 'ADMIN', 'SYSTEM');
  END IF;
END
$$;

-- 2. New mission status.
ALTER TYPE app."ExchangeStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- 3. Cancellation details on the mission.
ALTER TABLE app."Exchange" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE app."Exchange" ADD COLUMN IF NOT EXISTS "cancelledBy" app."MissionActor";
ALTER TABLE app."Exchange" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE app."Exchange" ADD COLUMN IF NOT EXISTS "cancelCode" TEXT;
ALTER TABLE app."Exchange" ADD COLUMN IF NOT EXISTS "cancelledFromStatus" app."ExchangeStatus";

-- 4. One row per repeating notice.
ALTER TABLE app."Notification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_userId_dedupeKey_key" ON app."Notification" ("userId", "dedupeKey");

-- 5. What remains of a deleted mission.
CREATE TABLE IF NOT EXISTS app."MissionHistory" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "isWhiteElephant" BOOLEAN NOT NULL,
  "memberCount" INTEGER NOT NULL,
  "missionCreatedAt" TIMESTAMP(3) NOT NULL,
  "executionDate" TIMESTAMP(3) NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "cancelledBy" app."MissionActor",
  "cancelledFromStatus" app."ExchangeStatus",
  "reason" TEXT NOT NULL,
  "deletedBy" app."MissionActor" NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MissionHistory_deletedAt_idx" ON app."MissionHistory" ("deletedAt");

COMMIT;
