-- =============================================================================
-- Rollback for 2026-10-12_schema-separation.forward.sql
-- Moves every table and enum back into "public" and removes the schema-level
-- access rules. Metadata only: no data is rewritten or lost. Pair it with a
-- redeploy of the pre-separation build (that build queries "public".*).
-- =============================================================================
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kovert_app') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA app
      REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM kovert_app;
    REVOKE USAGE ON SCHEMA app FROM kovert_app;
  END IF;
END
$$;

ALTER TABLE admin."AdminUser"    SET SCHEMA public;
ALTER TABLE admin."SystemConfig" SET SCHEMA public;
ALTER TABLE admin."SystemLog"    SET SCHEMA public;

ALTER TABLE app."User"              SET SCHEMA public;
ALTER TABLE app."Exchange"          SET SCHEMA public;
ALTER TABLE app."ProductCatalog"    SET SCHEMA public;
ALTER TABLE app."Item"              SET SCHEMA public;
ALTER TABLE app."Wishlist"          SET SCHEMA public;
ALTER TABLE app."WishlistItem"      SET SCHEMA public;
ALTER TABLE app."ExchangeMember"    SET SCHEMA public;
ALTER TABLE app."CovertInviteToken" SET SCHEMA public;
ALTER TABLE app."ExclusionRule"     SET SCHEMA public;
ALTER TABLE app."ExchangeMessage"   SET SCHEMA public;
ALTER TABLE app."Notification"      SET SCHEMA public;
ALTER TABLE app."ExchangeReport"    SET SCHEMA public;
ALTER TABLE app."ClearanceLead"     SET SCHEMA public;
ALTER TABLE app."ThemePreset"       SET SCHEMA public;
ALTER TABLE app."PreLaunchApproval" SET SCHEMA public;

ALTER TYPE admin."LogLevel"       SET SCHEMA public;
ALTER TYPE app."AccountStatus"  SET SCHEMA public;
ALTER TYPE app."ExchangeStatus" SET SCHEMA public;
ALTER TYPE app."GiftingType"    SET SCHEMA public;
ALTER TYPE app."PaymentStatus"  SET SCHEMA public;
ALTER TYPE app."MemberRole"     SET SCHEMA public;
ALTER TYPE app."ShippingStatus" SET SCHEMA public;
ALTER TYPE app."WishlistType"   SET SCHEMA public;

-- RESTRICT (the default) refuses to drop a schema that still holds objects.
DROP SCHEMA app;
DROP SCHEMA admin;

COMMIT;
