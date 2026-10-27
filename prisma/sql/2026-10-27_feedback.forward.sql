-- =============================================================================
-- In-app feedback (run BEFORE deploying the new build)
--
-- What: table app."Feedback". Signed-in agents submit Bug / Idea / Other
-- reports from the floating Feedback button; admins triage them in the North
-- Pole. See src/lib/feedback.ts.
--
-- Safety:
--   * New table only: the running (old) build never reads it.
--   * App schema: the app role inserts rows. Default privileges grant it on
--     tables the owner creates; the explicit GRANT below covers a database
--     where they were set by another role. Run as the owner.
--   * Rerunning is a no-op (IF NOT EXISTS, guarded constraint).
--
-- Rollback: 2026-10-27_feedback.rollback.sql
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS app."Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "message" TEXT NOT NULL,
    "pagePath" TEXT,
    "appVersion" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Feedback_status_createdAt_idx" ON app."Feedback"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Feedback_userId_createdAt_idx" ON app."Feedback"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Feedback_userId_fkey') THEN
    ALTER TABLE app."Feedback"
      ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES app."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kovert_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app."Feedback" TO kovert_app;
  END IF;
END
$$;

COMMIT;
