-- KovertKlaus Clean PostgreSQL Database Dump (v0.2.0-alpha)
-- Conforms strictly to prisma/schema.prisma

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'REMOTE_RESTRICTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ExchangeStatus" AS ENUM ('SETUP', 'RECRUITING', 'MATCHED', 'SHIPPED', 'EXECUTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GiftingType" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('FREE_ANNUAL', 'PAID', 'EXEMPT_SELF_HOSTED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('ORGANIZER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ShippingStatus" AS ENUM ('PENDING', 'LOCAL_DELIVERY', 'SHIPPED');

-- CreateEnum
CREATE TYPE "WishlistType" AS ENUM ('STANDARD', 'WHITE_ELEPHANT');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('ERROR', 'WARN', 'INFO', 'DEBUG');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "codename" TEXT,
    "preferredCodename" TEXT,
    "autoRandomizeCodename" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT NOT NULL,
    "streetAddress" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT DEFAULT 'US',
    "deliveryNotes" TEXT,
    "shirtSize" TEXT,
    "topHalfSize" TEXT,
    "bottomHalfSize" TEXT,
    "shoeSize" TEXT,
    "chestBustMeasurement" TEXT,
    "waistMeasurement" TEXT,
    "inseamMeasurement" TEXT,
    "favoriteColors" TEXT,
    "allergiesDiet" TEXT,
    "dislikes" TEXT,
    "favoriteHobbies" TEXT,
    "allowOrganizerViewSizes" BOOLEAN NOT NULL DEFAULT true,
    "allowOrganizerViewMeasurements" BOOLEAN NOT NULL DEFAULT false,
    "allowOrganizerViewAllergies" BOOLEAN NOT NULL DEFAULT true,
    "allowOrganizerViewFavorites" BOOLEAN NOT NULL DEFAULT false,
    "penaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isWorkshop" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exchange" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "maxParticipants" INTEGER,
    "giftingType" "GiftingType" NOT NULL DEFAULT 'SINGLE',
    "isLocalOnly" BOOLEAN NOT NULL DEFAULT false,
    "eventLocation" TEXT,
    "isWhiteElephant" BOOLEAN NOT NULL DEFAULT false,
    "organizerAssistedDraw" BOOLEAN NOT NULL DEFAULT true,
    "drawVerifiedAt" TIMESTAMP(3),
    "budgetMin" DECIMAL(10,2),
    "budgetMax" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "inviteCutoffDate" TIMESTAMP(3) NOT NULL,
    "assignmentDate" TIMESTAMP(3) NOT NULL,
    "shippingDate" TIMESTAMP(3),
    "executionDate" TIMESTAMP(3) NOT NULL,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'RECRUITING',
    "isFreeAnnualExchange" BOOLEAN NOT NULL DEFAULT false,
    "enforcePenalties" BOOLEAN NOT NULL DEFAULT true,
    "isCovertDelivery" BOOLEAN NOT NULL DEFAULT false,
    "propertyWaiverText" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'FREE_ANNUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCatalog" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "domain" TEXT,
    "properties" JSONB,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "catalogId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WishlistType" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeMember" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codename" TEXT,
    "wishlistId" TEXT,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "targetUserId" TEXT,
    "shippingStatus" "ShippingStatus" NOT NULL DEFAULT 'PENDING',
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "propertyWaiverAgreedAt" TIMESTAMP(3),
    "dropProofPhotoUrl" TEXT,
    "dropProofNote" TEXT,
    "droppedAt" TIMESTAMP(3),
    "targetGuessName" TEXT,
    "targetGuessAttempted" BOOLEAN NOT NULL DEFAULT false,
    "targetGuessCorrect" BOOLEAN,
    "detectionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "bustedPhotoUrl" TEXT,
    "bustedReason" TEXT,
    "badgeAwarded" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CovertInviteToken" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedEmail" TEXT,
    "invitedName" TEXT,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CovertInviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExclusionRule" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "restrictedMemberId" TEXT NOT NULL,

    CONSTRAINT "ExclusionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeMessage" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "isFromSanta" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "exchangeId" TEXT,
    "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeReport" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "thankYouText" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClearanceLead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "ipHash" TEXT,
    "source" TEXT NOT NULL DEFAULT 'landing_waitlist',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClearanceLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresPasswordReset" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemePreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL DEFAULT 'winter',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "altHomeKey" TEXT DEFAULT 'coming_soon',
    "bannerTextLight" TEXT DEFAULT '🎄 Welcome to KovertKlaus! Organize gift exchanges in under 60 seconds.',
    "bannerTextDark" TEXT DEFAULT '❄️ Winter Night Ops Active — Covert Holiday Gifting',
    "lightsStrandType" TEXT NOT NULL DEFAULT 'christmas_bulbs',
    "lightTokens" JSONB,
    "darkTokens" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "activeThemeId" TEXT NOT NULL DEFAULT 'winter_holiday',
    "activeSeason" TEXT NOT NULL DEFAULT 'auto',
    "announcementBannerActive" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "altHome" TEXT DEFAULT '',
    "appMode" TEXT NOT NULL DEFAULT 'selfhosted',
    "emailProvider" TEXT NOT NULL DEFAULT 'auto',
    "emailFrom" TEXT NOT NULL DEFAULT 'admin@kovertklaus.com',
    "emailFromName" TEXT NOT NULL DEFAULT 'KovertKlaus HQ',
    "brevoApiKey" TEXT,
    "brevoSenderEmail" TEXT,
    "brevoSenderName" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER DEFAULT 587,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "smtpFrom" TEXT,
    "resendApiKey" TEXT,
    "freeAnnualHostAllowance" INTEGER NOT NULL DEFAULT 1,
    "freeAnnualJoinAllowance" INTEGER NOT NULL DEFAULT 3,
    "paidEventPriceUsd" DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    "maxFreeParticipants" INTEGER NOT NULL DEFAULT 25,
    "maxWishlistItems" INTEGER NOT NULL DEFAULT 50,
    "defaultBudgetMin" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "defaultBudgetMax" DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "lifecycleCronEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lifecycleCronIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastLifecycleRunAt" TIMESTAMP(3),
    "lastLifecycleTransitions" INTEGER DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByAdminId" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "path" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_code_key" ON "Exchange"("code");

-- CreateIndex
CREATE INDEX "Exchange_organizerId_idx" ON "Exchange"("organizerId");

-- CreateIndex
CREATE INDEX "Exchange_status_idx" ON "Exchange"("status");

-- CreateIndex
CREATE INDEX "Exchange_code_idx" ON "Exchange"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalog_url_key" ON "ProductCatalog"("url");

-- CreateIndex
CREATE INDEX "Item_userId_idx" ON "Item"("userId");

-- CreateIndex
CREATE INDEX "Item_catalogId_idx" ON "Item"("catalogId");

-- CreateIndex
CREATE INDEX "Wishlist_userId_idx" ON "Wishlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_wishlistId_itemId_key" ON "WishlistItem"("wishlistId", "itemId");

-- CreateIndex
CREATE INDEX "ExchangeMember_exchangeId_codename_idx" ON "ExchangeMember"("exchangeId", "codename");

-- CreateIndex
CREATE INDEX "ExchangeMember_exchangeId_idx" ON "ExchangeMember"("exchangeId");

-- CreateIndex
CREATE INDEX "ExchangeMember_userId_idx" ON "ExchangeMember"("userId");

-- CreateIndex
CREATE INDEX "ExchangeMember_targetUserId_idx" ON "ExchangeMember"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeMember_exchangeId_userId_key" ON "ExchangeMember"("exchangeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CovertInviteToken_token_key" ON "CovertInviteToken"("token");

-- CreateIndex
CREATE INDEX "CovertInviteToken_exchangeId_idx" ON "CovertInviteToken"("exchangeId");

-- CreateIndex
CREATE INDEX "CovertInviteToken_token_idx" ON "CovertInviteToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ExclusionRule_exchangeId_memberId_restrictedMemberId_key" ON "ExclusionRule"("exchangeId", "memberId", "restrictedMemberId");

-- CreateIndex
CREATE INDEX "ExchangeMessage_exchangeId_idx" ON "ExchangeMessage"("exchangeId");

-- CreateIndex
CREATE INDEX "Notification_userId_isAcknowledged_idx" ON "Notification"("userId", "isAcknowledged");

-- CreateIndex
CREATE INDEX "ExchangeReport_exchangeId_idx" ON "ExchangeReport"("exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "ClearanceLead_email_key" ON "ClearanceLead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_level_createdAt_idx" ON "SystemLog"("level", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_category_createdAt_idx" ON "SystemLog"("category", "createdAt");

-- AddForeignKey
ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "ProductCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeMember" ADD CONSTRAINT "ExchangeMember_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeMember" ADD CONSTRAINT "ExchangeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeMember" ADD CONSTRAINT "ExchangeMember_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeMember" ADD CONSTRAINT "ExchangeMember_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CovertInviteToken" ADD CONSTRAINT "CovertInviteToken_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExclusionRule" ADD CONSTRAINT "ExclusionRule_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExclusionRule" ADD CONSTRAINT "ExclusionRule_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExclusionRule" ADD CONSTRAINT "ExclusionRule_restrictedMemberId_fkey" FOREIGN KEY ("restrictedMemberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeMessage" ADD CONSTRAINT "ExchangeMessage_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeMessage" ADD CONSTRAINT "ExchangeMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeMessage" ADD CONSTRAINT "ExchangeMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeReport" ADD CONSTRAINT "ExchangeReport_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeReport" ADD CONSTRAINT "ExchangeReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_activeThemeId_fkey" FOREIGN KEY ("activeThemeId") REFERENCES "ThemePreset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- -----------------------------------------------------------------------------
-- DATA INGESTION & SEED RECORDS
-- -----------------------------------------------------------------------------

INSERT INTO "SystemConfig" ("id", "activeThemeId", "activeSeason", "announcementBannerActive", "freeAnnualHostAllowance", "freeAnnualJoinAllowance", "paidEventPriceUsd", "maxFreeParticipants", "maxWishlistItems", "updatedAt")
VALUES ('singleton', 'winter_holiday', 'auto', true, 1, 3, 5.00, 25, 50, NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AdminUser" ("id", "username", "email", "name", "passwordHash", "role", "isActive", "requiresPasswordReset", "createdAt", "updatedAt")
VALUES ('00000000-0000-4000-a000-000000000001', 'santa', 'admin@kovertklaus.com', 'Santa Claus', '$2b$12$vT/KpNmBcWJaxi7sedGS/elLWbn8pLslOJzn3745H8nH9.NM2IXRu', 'SUPER_ADMIN', true, false, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

COPY public."User" ("id", "email", "name", "codename", "passwordHash", "streetAddress", "city", "state", "zipCode", "country", "penaltyPoints", "accountStatus", "emailNotifications", "createdAt", "updatedAt", "allowOrganizerViewAllergies", "allowOrganizerViewSizes", "allowOrganizerViewMeasurements", "allowOrganizerViewFavorites") FROM stdin;
2e65ae12-b926-4489-b220-8e704d983bda	joshua@example.com	Joshua Simpson	Chewie	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	6189 Pine Rd NE	Bremerton	WA	98311	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
2b2852e9-5126-4b57-9158-dbaa1463eaca	zachary@example.com	Zachary Simpson	Zachary	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
271f7a54-689d-4a3d-9d40-74b5da8a5ac5	shannon@example.com	Shannon Jaelynn Simpson	Shannon	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
af08be00-376c-4871-bd05-e7bf2ea83841	matthew@example.com	Matthew Simpson	Matthew	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
d151148c-aef8-434e-a048-43781cdeeddf	leslie@example.com	Leslie Simpson-Crawford	Leslie	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
8532980e-3e08-4b53-82fd-4bd87284eb4e	charles@example.com	Charles Crawford	Charles	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
864d4a8e-249a-4aff-a630-a3c1ef5ff65a	david@example.com	David Simpson	David	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
b9868ab1-79ea-430a-966d-fab5eadfed14	debbie@example.com	Debbie Kraemer	Debbie	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
7e6f8041-20e4-4f9c-95be-58462622b542	michael@example.com	Michael Kelly	Michael	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
08d55464-478a-4a36-b13a-2cd720c68587	terry@example.com	Terry Kelly	Terry	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
c6512237-d6b4-4e01-ba3e-180ab7eff431	sharon@example.com	Sharon Goins	Sharon	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
30fb6940-c586-4a76-a1ab-b91d276835a1	thomas@example.com	Thomas Goins	Thomas	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
83ec991a-4379-47be-8c1a-47a95aecc053	leonard@example.com	Leonard Courier	Leonard	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
af7c7907-22d4-4bb1-81cd-b347b999d75f	cheryl@example.com	Cheryl Courier	Cheryl	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
7122c6f3-1d14-4dea-9856-7950154aff51	kristy@example.com	Kristy Bonifer	Kristy	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
30c7b060-1ced-4165-8f18-dc157af689a1	dayton@example.com	Dayton Moses	Dayton	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
66b86c8b-1743-40d5-a8ad-7cd395350ed6	kathy@example.com	Kathy Moses	Kathy	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
f9ffcf17-cf57-4951-9fdc-6699a3076abf	john@example.com	John Moses	John	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
1a909af5-cb98-4f38-a8fb-cfaaffdc8c7d	james@example.com	James Moses	James	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
66295104-5539-45d3-9cad-60a0c329ffaf	julia@example.com	Julia Kelly	Julia	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
6a43cd31-048d-44fa-81a9-87365a9b3c1f	kimberly@example.com	Kimberly Piercy	Kimberly	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
634555c4-12c1-452f-97ef-3301a2f6c49c	rodney@example.com	Rodney Piercy	Rodney	$2b$12$BOv5hMFqlRoVYs/S0fDUD..bQJdmzLSirDLDCdxHTNs/CkM3BPZo6	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 00:00:00	2026-08-06 00:00:00	t	t	f	f
\.

COPY public."Wishlist" ("id", "userId", "name", "type", "createdAt", "updatedAt") FROM stdin;
w-65ae12-b926-4489-b220-8e704d983bda	2e65ae12-b926-4489-b220-8e704d983bda	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-2852e9-5126-4b57-9158-dbaa1463eaca	2b2852e9-5126-4b57-9158-dbaa1463eaca	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-1f7a54-689d-4a3d-9d40-74b5da8a5ac5	271f7a54-689d-4a3d-9d40-74b5da8a5ac5	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-08be00-376c-4871-bd05-e7bf2ea83841	af08be00-376c-4871-bd05-e7bf2ea83841	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-51148c-aef8-434e-a048-43781cdeeddf	d151148c-aef8-434e-a048-43781cdeeddf	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-32980e-3e08-4b53-82fd-4bd87284eb4e	8532980e-3e08-4b53-82fd-4bd87284eb4e	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-4d4a8e-249a-4aff-a630-a3c1ef5ff65a	864d4a8e-249a-4aff-a630-a3c1ef5ff65a	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-868ab1-79ea-430a-966d-fab5eadfed14	b9868ab1-79ea-430a-966d-fab5eadfed14	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-6f8041-20e4-4f9c-95be-58462622b542	7e6f8041-20e4-4f9c-95be-58462622b542	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-d55464-478a-4a36-b13a-2cd720c68587	08d55464-478a-4a36-b13a-2cd720c68587	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-512237-d6b4-4e01-ba3e-180ab7eff431	c6512237-d6b4-4e01-ba3e-180ab7eff431	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-fb6940-c586-4a76-a1ab-b91d276835a1	30fb6940-c586-4a76-a1ab-b91d276835a1	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-ec991a-4379-47be-8c1a-47a95aecc053	83ec991a-4379-47be-8c1a-47a95aecc053	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-7c7907-22d4-4bb1-81cd-b347b999d75f	af7c7907-22d4-4bb1-81cd-b347b999d75f	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-22c6f3-1d14-4dea-9856-7950154aff51	7122c6f3-1d14-4dea-9856-7950154aff51	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-c7b060-1ced-4165-8f18-dc157af689a1	30c7b060-1ced-4165-8f18-dc157af689a1	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-b86c8b-1743-40d5-a8ad-7cd395350ed6	66b86c8b-1743-40d5-a8ad-7cd395350ed6	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-ffcf17-cf57-4951-9fdc-6699a3076abf	f9ffcf17-cf57-4951-9fdc-6699a3076abf	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-909af5-cb98-4f38-a8fb-cfaaffdc8c7d	1a909af5-cb98-4f38-a8fb-cfaaffdc8c7d	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-295104-5539-45d3-9cad-60a0c329ffaf	66295104-5539-45d3-9cad-60a0c329ffaf	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-43cd31-048d-44fa-81a9-87365a9b3c1f	6a43cd31-048d-44fa-81a9-87365a9b3c1f	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
w-4555c4-12c1-452f-97ef-3301a2f6c49c	634555c4-12c1-452f-97ef-3301a2f6c49c	Master Wishlist Manifest - Secret Santa	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
f7251af7-d292-4c35-9d80-ef14ad4ac05e	2e65ae12-b926-4489-b220-8e704d983bda	Tools Kit	STANDARD	2026-08-06 00:00:00	2026-08-06 00:00:00
9607a2ab-72b0-4aeb-85f7-dcab467d6413	2e65ae12-b926-4489-b220-8e704d983bda	OC White Elephant	WHITE_ELEPHANT	2026-08-06 00:00:00	2026-08-06 00:00:00
\.

COPY public."Exchange" ("id", "title", "description", "code", "organizerId", "maxParticipants", "giftingType", "isLocalOnly", "eventLocation", "isWhiteElephant", "budgetMin", "budgetMax", "currency", "inviteCutoffDate", "assignmentDate", "shippingDate", "executionDate", "status", "isFreeAnnualExchange", "enforcePenalties", "paymentStatus", "createdAt", "updatedAt", "organizerAssistedDraw") FROM stdin;
5e0c8528-04c6-42fe-b95c-cffcb637a8b4	Simpson Family Secret Santa 2026	Annual Simpson & Family Secret Santa Gift Exchange! Wishlists required.	SIMPSON-2026	2e65ae12-b926-4489-b220-8e704d983bda	25	SINGLE	f	\N	f	25.00	75.00	USD	2026-11-20 23:59:59	2026-11-25 00:00:00	2026-12-15 23:59:59	2026-12-25 18:00:00	RECRUITING	t	t	FREE_ANNUAL	2026-08-06 00:00:00	2026-08-06 00:00:00	t
120d0188-9510-4132-af05-c3711d12f6ec	Simpson Family White Elephant Party 2026	In-person local White Elephant gift stealing party! Bring 1 wrapped funny or cool gift under $30.	SIMPSON-ELEV	271f7a54-689d-4a3d-9d40-74b5da8a5ac5	20	SINGLE	t	6189 Pine Rd NE, Bremerton, WA 98311	t	10.00	30.00	USD	2026-12-10 23:59:59	2026-12-15 00:00:00	2026-12-20 23:59:59	2026-12-24 17:00:00	RECRUITING	f	f	FREE_ANNUAL	2026-08-06 00:00:00	2026-08-06 00:00:00	t
\.

COPY public."ExchangeMember" ("id", "exchangeId", "userId", "codename", "wishlistId", "role", "shippingStatus", "deliveredConfirmed", "joinedAt") FROM stdin;
em-5ae12-b926-4489-b220-8e704d983bda	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	2e65ae12-b926-4489-b220-8e704d983bda	Chewie	w-65ae12-b926-4489-b220-8e704d983bda	ORGANIZER	PENDING	f	2026-08-06 00:00:00
em-852e9-5126-4b57-9158-dbaa1463eaca	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	2b2852e9-5126-4b57-9158-dbaa1463eaca	Zachary	w-2852e9-5126-4b57-9158-dbaa1463eaca	MEMBER	PENDING	f	2026-08-06 00:00:00
em-f7a54-689d-4a3d-9d40-74b5da8a5ac5	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	271f7a54-689d-4a3d-9d40-74b5da8a5ac5	Shannon	w-1f7a54-689d-4a3d-9d40-74b5da8a5ac5	MEMBER	PENDING	f	2026-08-06 00:00:00
em-8be00-376c-4871-bd05-e7bf2ea83841	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	af08be00-376c-4871-bd05-e7bf2ea83841	Matthew	w-08be00-376c-4871-bd05-e7bf2ea83841	MEMBER	PENDING	f	2026-08-06 00:00:00
em-1148c-aef8-434e-a048-43781cdeeddf	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	d151148c-aef8-434e-a048-43781cdeeddf	Leslie	w-51148c-aef8-434e-a048-43781cdeeddf	MEMBER	PENDING	f	2026-08-06 00:00:00
em-2980e-3e08-4b53-82fd-4bd87284eb4e	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	8532980e-3e08-4b53-82fd-4bd87284eb4e	Charles	w-32980e-3e08-4b53-82fd-4bd87284eb4e	MEMBER	PENDING	f	2026-08-06 00:00:00
em-d4a8e-249a-4aff-a630-a3c1ef5ff65a	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	864d4a8e-249a-4aff-a630-a3c1ef5ff65a	David	w-4d4a8e-249a-4aff-a630-a3c1ef5ff65a	MEMBER	PENDING	f	2026-08-06 00:00:00
em-68ab1-79ea-430a-966d-fab5eadfed14	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	b9868ab1-79ea-430a-966d-fab5eadfed14	Debbie	w-868ab1-79ea-430a-966d-fab5eadfed14	MEMBER	PENDING	f	2026-08-06 00:00:00
em-f8041-20e4-4f9c-95be-58462622b542	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	7e6f8041-20e4-4f9c-95be-58462622b542	Michael	w-6f8041-20e4-4f9c-95be-58462622b542	MEMBER	PENDING	f	2026-08-06 00:00:00
em-55464-478a-4a36-b13a-2cd720c68587	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	08d55464-478a-4a36-b13a-2cd720c68587	Terry	w-d55464-478a-4a36-b13a-2cd720c68587	MEMBER	PENDING	f	2026-08-06 00:00:00
em-12237-d6b4-4e01-ba3e-180ab7eff431	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	c6512237-d6b4-4e01-ba3e-180ab7eff431	Sharon	w-512237-d6b4-4e01-ba3e-180ab7eff431	MEMBER	PENDING	f	2026-08-06 00:00:00
em-b6940-c586-4a76-a1ab-b91d276835a1	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	30fb6940-c586-4a76-a1ab-b91d276835a1	Thomas	w-fb6940-c586-4a76-a1ab-b91d276835a1	MEMBER	PENDING	f	2026-08-06 00:00:00
em-c991a-4379-47be-8c1a-47a95aecc053	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	83ec991a-4379-47be-8c1a-47a95aecc053	Leonard	w-ec991a-4379-47be-8c1a-47a95aecc053	MEMBER	PENDING	f	2026-08-06 00:00:00
em-c7907-22d4-4bb1-81cd-b347b999d75f	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	af7c7907-22d4-4bb1-81cd-b347b999d75f	Cheryl	w-7c7907-22d4-4bb1-81cd-b347b999d75f	MEMBER	PENDING	f	2026-08-06 00:00:00
em-2c6f3-1d14-4dea-9856-7950154aff51	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	7122c6f3-1d14-4dea-9856-7950154aff51	Kristy	w-22c6f3-1d14-4dea-9856-7950154aff51	MEMBER	PENDING	f	2026-08-06 00:00:00
em-7b060-1ced-4165-8f18-dc157af689a1	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	30c7b060-1ced-4165-8f18-dc157af689a1	Dayton	w-c7b060-1ced-4165-8f18-dc157af689a1	MEMBER	PENDING	f	2026-08-06 00:00:00
em-86c8b-1743-40d5-a8ad-7cd395350ed6	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	66b86c8b-1743-40d5-a8ad-7cd395350ed6	Kathy	w-b86c8b-1743-40d5-a8ad-7cd395350ed6	MEMBER	PENDING	f	2026-08-06 00:00:00
em-fcf17-cf57-4951-9fdc-6699a3076abf	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	f9ffcf17-cf57-4951-9fdc-6699a3076abf	John	w-ffcf17-cf57-4951-9fdc-6699a3076abf	MEMBER	PENDING	f	2026-08-06 00:00:00
em-09af5-cb98-4f38-a8fb-cfaaffdc8c7d	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	1a909af5-cb98-4f38-a8fb-cfaaffdc8c7d	James	w-909af5-cb98-4f38-a8fb-cfaaffdc8c7d	MEMBER	PENDING	f	2026-08-06 00:00:00
em-95104-5539-45d3-9cad-60a0c329ffaf	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	66295104-5539-45d3-9cad-60a0c329ffaf	Julia	w-295104-5539-45d3-9cad-60a0c329ffaf	MEMBER	PENDING	f	2026-08-06 00:00:00
em-3cd31-048d-44fa-81a9-87365a9b3c1f	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	6a43cd31-048d-44fa-81a9-87365a9b3c1f	Kimberly	w-43cd31-048d-44fa-81a9-87365a9b3c1f	MEMBER	PENDING	f	2026-08-06 00:00:00
em-555c4-12c1-452f-97ef-3301a2f6c49c	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	634555c4-12c1-452f-97ef-3301a2f6c49c	Rodney	w-4555c4-12c1-452f-97ef-3301a2f6c49c	MEMBER	PENDING	f	2026-08-06 00:00:00
elev-e12-b926-4489-b220-8e704d983bda	120d0188-9510-4132-af05-c3711d12f6ec	2e65ae12-b926-4489-b220-8e704d983bda	Chewie	\N	MEMBER	PENDING	f	2026-08-06 00:00:00
elev-2e9-5126-4b57-9158-dbaa1463eaca	120d0188-9510-4132-af05-c3711d12f6ec	2b2852e9-5126-4b57-9158-dbaa1463eaca	Zachary	\N	MEMBER	PENDING	f	2026-08-06 00:00:00
elev-a54-689d-4a3d-9d40-74b5da8a5ac5	120d0188-9510-4132-af05-c3711d12f6ec	271f7a54-689d-4a3d-9d40-74b5da8a5ac5	Shannon	\N	ORGANIZER	PENDING	f	2026-08-06 00:00:00
elev-e00-376c-4871-bd05-e7bf2ea83841	120d0188-9510-4132-af05-c3711d12f6ec	af08be00-376c-4871-bd05-e7bf2ea83841	Matthew	\N	MEMBER	PENDING	f	2026-08-06 00:00:00
elev-48c-aef8-434e-a048-43781cdeeddf	120d0188-9510-4132-af05-c3711d12f6ec	d151148c-aef8-434e-a048-43781cdeeddf	Leslie	\N	MEMBER	PENDING	f	2026-08-06 00:00:00
elev-80e-3e08-4b53-82fd-4bd87284eb4e	120d0188-9510-4132-af05-c3711d12f6ec	8532980e-3e08-4b53-82fd-4bd87284eb4e	Charles	\N	MEMBER	PENDING	f	2026-08-06 00:00:00
elev-a8e-249a-4aff-a630-a3c1ef5ff65a	120d0188-9510-4132-af05-c3711d12f6ec	864d4a8e-249a-4aff-a630-a3c1ef5ff65a	David	\N	MEMBER	PENDING	f	2026-08-06 00:00:00
elev-ab1-79ea-430a-966d-fab5eadfed14	120d0188-9510-4132-af05-c3711d12f6ec	b9868ab1-79ea-430a-966d-fab5eadfed14	Debbie	\N	MEMBER	PENDING	f	2026-08-06 00:00:00
elev-041-20e4-4f9c-95be-58462622b542	120d0188-9510-4132-af05-c3711d12f6ec	7e6f8041-20e4-4f9c-95be-58462622b542	Michael	\N	MEMBER	PENDING	f	2026-08-06 00:00:00
elev-464-478a-4a36-b13a-2cd720c68587	120d0188-9510-4132-af05-c3711d12f6ec	08d55464-478a-4a36-b13a-2cd720c68587	Terry	\N	MEMBER	PENDING	f	2026-08-06 00:00:00
\.

