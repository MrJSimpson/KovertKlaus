-- =============================================================================
-- Head Elf approval for code joins (run BEFORE deploying the new build)
--
-- What: enum app."JoinRequestStatus" and table app."MissionJoinRequest". Joining
-- a mission by its code now creates a request that the Head Elf approves or
-- declines (src/lib/join-requests.ts); emailed invitations still join directly
-- through a signed per-invitation link.
--
-- Safety:
--   * Additive: new type and table only. The running (old) build never reads
--     them, so running this first is safe.
--   * Run it BEFORE the deploy: the new build's join route writes to this table.
--   * App schema: the app role gets access through the default privileges set
--     in 2026-10-12_schema-separation (run as the owner role). The backup role
--     reads it through pg_read_all_data.
--   * Rerunning fails harmlessly on the existing type (it is all one transaction).
--
-- Generated with `prisma migrate diff` from the release branch schema.
-- Rollback: 2026-11-01_join-requests.rollback.sql
-- =============================================================================

BEGIN;

CREATE TYPE "app"."JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'EXPIRED');

CREATE TABLE "app"."MissionJoinRequest" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "app"."JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "MissionJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MissionJoinRequest_exchangeId_status_idx" ON "app"."MissionJoinRequest"("exchangeId", "status");
CREATE INDEX "MissionJoinRequest_userId_status_idx" ON "app"."MissionJoinRequest"("userId", "status");
CREATE UNIQUE INDEX "MissionJoinRequest_exchangeId_userId_key" ON "app"."MissionJoinRequest"("exchangeId", "userId");

ALTER TABLE "app"."MissionJoinRequest" ADD CONSTRAINT "MissionJoinRequest_exchangeId_fkey"
    FOREIGN KEY ("exchangeId") REFERENCES "app"."Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app"."MissionJoinRequest" ADD CONSTRAINT "MissionJoinRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
