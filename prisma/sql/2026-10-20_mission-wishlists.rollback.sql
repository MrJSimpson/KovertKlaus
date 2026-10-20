-- =============================================================================
-- Rollback for 2026-10-20_mission-wishlists.forward.sql (BEFORE the cleanup step)
--
-- What: removes the lists the forward script created (copies and empty lists)
-- and any created by the new build, with their items, then drops
-- Wishlist."memberId" and Exchange."allowWishlistOverBudget". Members keep the
-- shared lists ExchangeMember."wishlistId" still points at.
--
-- Safety:
--   * Items agents added to their own copies after the forward script are lost;
--     items added to the original lists stay.
--   * Agents who joined after the deploy lose their list (the old build links or
--     creates one again when they next open the mission).
--   * After the cleanup step has run, this script cannot restore the dropped
--     column or deleted lists: restore the backup instead.
--   * Runs in one transaction.
-- =============================================================================

BEGIN;

-- Lists no member points at through the old column were created by the forward
-- script or the new build.
CREATE TEMP TABLE new_lists ON COMMIT DROP AS
SELECT w.id
FROM app."Wishlist" w
WHERE w."memberId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM app."ExchangeMember" m WHERE m."wishlistId" = w.id);

DELETE FROM app."Item" i
USING app."WishlistItem" wi
WHERE wi."itemId" = i.id
  AND wi."wishlistId" IN (SELECT id FROM new_lists);
DELETE FROM app."Wishlist" WHERE id IN (SELECT id FROM new_lists);

ALTER TABLE app."Wishlist" DROP CONSTRAINT IF EXISTS "Wishlist_memberId_fkey";
DROP INDEX IF EXISTS app."Wishlist_memberId_key";
ALTER TABLE app."Wishlist" DROP COLUMN IF EXISTS "memberId";
ALTER TABLE app."Exchange" DROP COLUMN IF EXISTS "allowWishlistOverBudget";

COMMIT;
