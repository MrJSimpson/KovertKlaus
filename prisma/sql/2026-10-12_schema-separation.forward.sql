-- =============================================================================
-- Schema separation: move every table and enum out of "public" into
--   app   -> tables the application role (kovert_app) uses through `db`
--   admin -> tables reachable only through the owner role via `adminDb`
--
-- Why: Postgres grants nothing on new tables, and Prisma never issues GRANTs, so
-- every table added to "public" was unreachable by kovert_app until someone
-- remembered to grant it. With schemas, a table's location decides its access:
--   * new tables in app   inherit SELECT/INSERT/UPDATE/DELETE for kovert_app
--   * new tables in admin are unreachable by kovert_app (no USAGE on the schema)
--
-- Safety:
--   * Purely metadata: ALTER ... SET SCHEMA keeps data, indexes, constraints,
--     foreign keys and existing per-table grants. No rows are rewritten.
--   * Runs in one transaction: it applies fully or not at all.
--   * Code deployed before this change queries "public".* and fails until the
--     schema-aware build is live. Apply it right alongside that deploy.
--   * The kovert_app role exists only in production (Neon). Local Docker uses a
--     single owner role, so the role-specific grants are skipped there.
--
-- Rollback: 2026-10-12_schema-separation.rollback.sql
-- =============================================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS admin;

-- Enums -----------------------------------------------------------------------
ALTER TYPE public."AccountStatus"  SET SCHEMA app;
ALTER TYPE public."ExchangeStatus" SET SCHEMA app;
ALTER TYPE public."GiftingType"    SET SCHEMA app;
ALTER TYPE public."PaymentStatus"  SET SCHEMA app;
ALTER TYPE public."MemberRole"     SET SCHEMA app;
ALTER TYPE public."ShippingStatus" SET SCHEMA app;
ALTER TYPE public."WishlistType"   SET SCHEMA app;
ALTER TYPE public."LogLevel"       SET SCHEMA admin;

-- App tables ------------------------------------------------------------------
ALTER TABLE public."User"              SET SCHEMA app;
ALTER TABLE public."Exchange"          SET SCHEMA app;
ALTER TABLE public."ProductCatalog"    SET SCHEMA app;
ALTER TABLE public."Item"              SET SCHEMA app;
ALTER TABLE public."Wishlist"          SET SCHEMA app;
ALTER TABLE public."WishlistItem"      SET SCHEMA app;
ALTER TABLE public."ExchangeMember"    SET SCHEMA app;
ALTER TABLE public."CovertInviteToken" SET SCHEMA app;
ALTER TABLE public."ExclusionRule"     SET SCHEMA app;
ALTER TABLE public."ExchangeMessage"   SET SCHEMA app;
ALTER TABLE public."Notification"      SET SCHEMA app;
ALTER TABLE public."ExchangeReport"    SET SCHEMA app;
ALTER TABLE public."ClearanceLead"     SET SCHEMA app;
ALTER TABLE public."ThemePreset"       SET SCHEMA app;
ALTER TABLE public."PreLaunchApproval" SET SCHEMA app;

-- Admin tables ----------------------------------------------------------------
ALTER TABLE public."AdminUser"    SET SCHEMA admin;
ALTER TABLE public."SystemConfig" SET SCHEMA admin;
ALTER TABLE public."SystemLog"    SET SCHEMA admin;

-- Access ----------------------------------------------------------------------
REVOKE ALL ON SCHEMA admin FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kovert_app') THEN
    GRANT USAGE ON SCHEMA app TO kovert_app;
    REVOKE ALL ON SCHEMA admin FROM kovert_app;
    -- Future tables created in app by the migrating (owner) role are granted
    -- automatically. Existing tighter per-table grants are left as they are.
    ALTER DEFAULT PRIVILEGES IN SCHEMA app
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kovert_app;
  END IF;
END
$$;

COMMIT;
