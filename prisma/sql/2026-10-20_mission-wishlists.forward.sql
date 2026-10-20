-- =============================================================================
-- Mission-scoped Wishlist Manifests, step 1 of 2 (run BEFORE deploying the new build)
-- Order: codenames forward -> assign-mission-codenames.ts -> THIS script -> deploy
-- -> codenames cleanup -> wishlists cleanup. Both cleanups drop columns the old
-- build still reads, so they must wait until the new build is live.
--
-- What: a Wishlist Manifest belongs to one ExchangeMember instead of the account.
--   1. Add Exchange."allowWishlistOverBudget" (Head Elf toggle, default on).
--   2. Add Wishlist."memberId" (the owning membership).
--   3. Each list linked to members goes to the earliest of them (by "joinedAt").
--   4. Every other member sharing that list gets a copy, items included, so
--      editing one mission's list no longer changes another's.
--   5. A member with no linked list gets a copy of their oldest account list of
--      the mission's type (Secret Santa or White Elephant), items included. The
--      old mission page showed and edited exactly that list (the user's oldest),
--      and givers saw it, so it is the list the agent actually used.
--   6. Members still without a list get an empty one of the mission's type.
--   7. Unique index and cascading foreign key on "memberId".
-- Lists linked to no member keep a NULL "memberId" until step 2
-- (2026-10-20_mission-wishlists.cleanup.sql) deletes them after the deploy.
--
-- Why: alpha feedback (2026-10-20). Nobody reused a list across missions, and
-- account-wide manifests confused agents. Lists now live on the mission page.
--
-- Safety:
--   * Additive for the running (old) build: it never reads the new columns,
--     ExchangeMember."wishlistId" stays until step 2, and "memberId" stays
--     nullable, so the old build can still create lists during the deploy.
--   * Runs in one transaction: it applies fully or not at all. Rerunning it is a
--     no-op (only lists and members without an owner or a list are touched).
--   * Take a backup first (export-db): step 2 deletes lists linked to no mission.
--
-- Rollback: 2026-10-20_mission-wishlists.rollback.sql
-- =============================================================================

BEGIN;

-- 1. Head Elf toggle: may a wishlist total more than budgetMax? (Items never may.)
ALTER TABLE app."Exchange" ADD COLUMN IF NOT EXISTS "allowWishlistOverBudget" BOOLEAN NOT NULL DEFAULT true;

-- 2. Owning membership.
ALTER TABLE app."Wishlist" ADD COLUMN IF NOT EXISTS "memberId" TEXT;

-- 3. The earliest member linked to a list keeps it.
UPDATE app."Wishlist" w
SET "memberId" = keeper.id
FROM (
  SELECT DISTINCT ON ("wishlistId") id, "wishlistId"
  FROM app."ExchangeMember"
  WHERE "wishlistId" IS NOT NULL
  ORDER BY "wishlistId", "joinedAt", id
) keeper
WHERE w.id = keeper."wishlistId"
  AND w."memberId" IS NULL;

-- 4 and 5. Lists to copy, items included:
--   (4) members sharing a list with an earlier member get a copy of it;
--   (5) members with no linked list get a copy of their oldest account list of
--       the mission's type, the list the old mission page showed them.
CREATE TEMP TABLE wishlist_copy ON COMMIT DROP AS
SELECT m.id AS member_id, m."userId" AS user_id, m."wishlistId" AS old_id, gen_random_uuid()::text AS new_id
FROM app."ExchangeMember" m
JOIN app."Wishlist" w ON w.id = m."wishlistId"
WHERE w."memberId" <> m.id
  AND NOT EXISTS (SELECT 1 FROM app."Wishlist" own WHERE own."memberId" = m.id)
UNION ALL
SELECT m.id, m."userId", src.id, gen_random_uuid()::text
FROM app."ExchangeMember" m
JOIN app."Exchange" e ON e.id = m."exchangeId"
JOIN LATERAL (
  SELECT w.id
  FROM app."Wishlist" w
  WHERE w."userId" = m."userId"
    AND w.type = (CASE WHEN e."isWhiteElephant" THEN 'WHITE_ELEPHANT' ELSE 'STANDARD' END)::app."WishlistType"
  ORDER BY w."createdAt", w.id
  LIMIT 1
) src ON true
WHERE m."wishlistId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM app."Wishlist" own WHERE own."memberId" = m.id);

INSERT INTO app."Wishlist" (id, "userId", "memberId", name, type, "createdAt", "updatedAt")
SELECT c.new_id, c.user_id, c.member_id, w.name, w.type, w."createdAt", now()
FROM wishlist_copy c
JOIN app."Wishlist" w ON w.id = c.old_id;

CREATE TEMP TABLE item_copy ON COMMIT DROP AS
SELECT c.new_id AS wishlist_id, wi."itemId" AS old_item, gen_random_uuid()::text AS new_item, wi.quantity
FROM wishlist_copy c
JOIN app."WishlistItem" wi ON wi."wishlistId" = c.old_id;

INSERT INTO app."Item" (id, "userId", "catalogId", name, url, price, description, "thumbnailUrl", properties, "createdAt", "updatedAt")
SELECT ic.new_item, i."userId", i."catalogId", i.name, i.url, i.price, i.description, i."thumbnailUrl", i.properties, i."createdAt", now()
FROM item_copy ic
JOIN app."Item" i ON i.id = ic.old_item;

INSERT INTO app."WishlistItem" (id, "wishlistId", "itemId", quantity)
SELECT gen_random_uuid()::text, wishlist_id, new_item, quantity
FROM item_copy;

-- 6. Members still without a list get an empty one.
INSERT INTO app."Wishlist" (id, "userId", "memberId", name, type, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m."userId", m.id,
       CASE WHEN e."isWhiteElephant" THEN 'White Elephant Gift' ELSE 'Wishlist' END,
       (CASE WHEN e."isWhiteElephant" THEN 'WHITE_ELEPHANT' ELSE 'STANDARD' END)::app."WishlistType",
       now(), now()
FROM app."ExchangeMember" m
JOIN app."Exchange" e ON e.id = m."exchangeId"
WHERE NOT EXISTS (SELECT 1 FROM app."Wishlist" w WHERE w."memberId" = m.id);

-- 7. One list per membership, deleted with it.
CREATE UNIQUE INDEX IF NOT EXISTS "Wishlist_memberId_key" ON app."Wishlist" ("memberId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Wishlist_memberId_fkey') THEN
    ALTER TABLE app."Wishlist"
      ADD CONSTRAINT "Wishlist_memberId_fkey" FOREIGN KEY ("memberId")
      REFERENCES app."ExchangeMember" (id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
