-- =============================================================================
-- Mission-assigned codenames, step 1 of 2 (run BEFORE deploying the new build)
--
-- What: ExchangeMember gets "codenameAcceptedAt" and a unique codename per
-- mission. Existing rows are made to satisfy that constraint first.
--   1. Add "codenameAcceptedAt".
--   2. Mark every existing codename as accepted (at "joinedAt"), so no agent's
--      identity changes in the middle of a mission.
--   3. Rename case-insensitive duplicates inside a mission to "<name> 2", " 3", …
--      (the earliest joiner keeps the original).
--   4. Replace the (exchangeId, codename) index with a unique index.
-- Then run scripts/assign-mission-codenames.ts: it gives members with no codename
-- (Head Elves, Covert Delivery joins) a free pool name, left unaccepted so the
-- agent can still reroll while the mission is recruiting.
--
-- Why: codenames are no longer personal (alpha feedback, 2026-10-20). Each
-- mission assigns one from CODENAME_POOL in src/lib/codename.ts.
--
-- Safety:
--   * Additive for the running (old) build: it never reads "codenameAcceptedAt",
--     and the User codename columns stay until step 2
--     (2026-10-20_mission-codenames.cleanup.sql) runs after the deploy.
--   * Between this script and the deploy, the old build's registration path
--     copies User.codename into a new membership and can now hit the unique index;
--     that path already catches enrollment errors, so keep the window short.
--   * Runs in one transaction: it applies fully or not at all.
--   * Take a backup first (export-db).
--
-- Rollback: 2026-10-20_mission-codenames.rollback.sql
-- =============================================================================
BEGIN;

-- 1. Acceptance timestamp ------------------------------------------------------
ALTER TABLE app."ExchangeMember" ADD COLUMN IF NOT EXISTS "codenameAcceptedAt" TIMESTAMP(3);

-- 2. Existing codenames are final ------------------------------------------------
UPDATE app."ExchangeMember"
   SET "codenameAcceptedAt" = "joinedAt"
 WHERE codename IS NOT NULL AND "codenameAcceptedAt" IS NULL;

-- 3. Duplicates within a mission ------------------------------------------------
WITH ranked AS (
  SELECT id, codename,
         row_number() OVER (PARTITION BY "exchangeId", lower(codename) ORDER BY "joinedAt", id) AS rn
    FROM app."ExchangeMember"
   WHERE codename IS NOT NULL
)
UPDATE app."ExchangeMember" m
   SET codename = ranked.codename || ' ' || ranked.rn
  FROM ranked
 WHERE m.id = ranked.id AND ranked.rn > 1;

-- 4. One codename per mission -----------------------------------------------------
DROP INDEX IF EXISTS app."ExchangeMember_exchangeId_codename_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "ExchangeMember_exchangeId_codename_key"
  ON app."ExchangeMember" ("exchangeId", codename);

COMMIT;
