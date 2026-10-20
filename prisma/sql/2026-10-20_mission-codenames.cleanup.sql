-- =============================================================================
-- Mission-assigned codenames, step 2 of 2 (run AFTER the new build is live)
--
-- What: drops the retired account-level codename columns from "User".
-- Why: the new build never reads them; the old build still did, so they must
-- outlive the deploy. `npx prisma db push` would drop them too, but only with
-- --accept-data-loss; this script makes the drop explicit and reviewable.
--
-- Safety: irreversible for the data in these columns. Take a backup first
-- (export-db). The rollback script can re-add the columns, empty.
-- =============================================================================
BEGIN;

ALTER TABLE app."User" DROP COLUMN IF EXISTS codename;
ALTER TABLE app."User" DROP COLUMN IF EXISTS "preferredCodename";
ALTER TABLE app."User" DROP COLUMN IF EXISTS "autoRandomizeCodename";

COMMIT;
