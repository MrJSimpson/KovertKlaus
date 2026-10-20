-- =============================================================================
-- Mission-scoped Wishlist Manifests, step 2 of 2 (run AFTER the new build is live)
--
-- What:
--   1. Delete lists linked to no mission membership (the old dashboard's
--      unused or leftover manifests) and the items left on no list.
--   2. Make Wishlist."memberId" required.
--   3. Drop ExchangeMember."wishlistId" (replaced by Wishlist."memberId").
--
-- Why: the new build never shows a list outside a mission, so these rows are
-- unreachable. Afterwards the database matches prisma/schema.prisma exactly.
--
-- Safety:
--   * Deletes data. Take a backup first (export-db); the forward script's backup
--     also holds these lists.
--   * Not reversible by script. To undo, restore the backup.
--   * Runs in one transaction.
-- =============================================================================

BEGIN;

-- 1. Lists outside any mission, then items on no list.
DELETE FROM app."Wishlist" WHERE "memberId" IS NULL;
DELETE FROM app."Item" i
WHERE NOT EXISTS (SELECT 1 FROM app."WishlistItem" wi WHERE wi."itemId" = i.id);

-- 2. Every list belongs to a membership.
ALTER TABLE app."Wishlist" ALTER COLUMN "memberId" SET NOT NULL;

-- 3. The old link from member to list.
ALTER TABLE app."ExchangeMember" DROP COLUMN IF EXISTS "wishlistId";

COMMIT;
