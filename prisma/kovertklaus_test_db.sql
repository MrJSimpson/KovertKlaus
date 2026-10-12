-- KovertKlaus Clean Production PostgreSQL Database Dump (v0.2.0-alpha)
-- Conforms strictly to prisma/schema.prisma (Zero Dummy Records)

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "admin";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateEnum
CREATE TYPE "app"."AccountStatus" AS ENUM ('ACTIVE', 'REMOTE_RESTRICTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "app"."ExchangeStatus" AS ENUM ('SETUP', 'RECRUITING', 'MATCHED', 'SHIPPED', 'EXECUTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "app"."GiftingType" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "app"."PaymentStatus" AS ENUM ('FREE_ANNUAL', 'PAID', 'EXEMPT_SELF_HOSTED');

-- CreateEnum
CREATE TYPE "app"."MemberRole" AS ENUM ('ORGANIZER', 'MEMBER');

-- CreateEnum
CREATE TYPE "app"."ShippingStatus" AS ENUM ('PENDING', 'LOCAL_DELIVERY', 'SHIPPED');

-- CreateEnum
CREATE TYPE "app"."WishlistType" AS ENUM ('STANDARD', 'WHITE_ELEPHANT');

-- CreateEnum
CREATE TYPE "admin"."LogLevel" AS ENUM ('ERROR', 'WARN', 'INFO', 'DEBUG');

-- CreateTable
CREATE TABLE "app"."User" (
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
    "accountStatus" "app"."AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isWorkshop" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Exchange" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "maxParticipants" INTEGER,
    "giftingType" "app"."GiftingType" NOT NULL DEFAULT 'SINGLE',
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
    "status" "app"."ExchangeStatus" NOT NULL DEFAULT 'RECRUITING',
    "isFreeAnnualExchange" BOOLEAN NOT NULL DEFAULT false,
    "enforcePenalties" BOOLEAN NOT NULL DEFAULT true,
    "isCovertDelivery" BOOLEAN NOT NULL DEFAULT false,
    "propertyWaiverText" TEXT,
    "paymentStatus" "app"."PaymentStatus" NOT NULL DEFAULT 'FREE_ANNUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ProductCatalog" (
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
CREATE TABLE "app"."Item" (
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
CREATE TABLE "app"."Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "app"."WishlistType" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."WishlistItem" (
    "id" TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ExchangeMember" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codename" TEXT,
    "wishlistId" TEXT,
    "role" "app"."MemberRole" NOT NULL DEFAULT 'MEMBER',
    "targetUserId" TEXT,
    "shippingStatus" "app"."ShippingStatus" NOT NULL DEFAULT 'PENDING',
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
CREATE TABLE "app"."CovertInviteToken" (
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
CREATE TABLE "app"."ExclusionRule" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "restrictedMemberId" TEXT NOT NULL,

    CONSTRAINT "ExclusionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ExchangeMessage" (
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
CREATE TABLE "app"."Notification" (
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
CREATE TABLE "app"."ExchangeReport" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "thankYouText" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ClearanceLead" (
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
CREATE TABLE "admin"."AdminUser" (
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
CREATE TABLE "app"."ThemePreset" (
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
CREATE TABLE "admin"."SystemConfig" (
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
CREATE TABLE "admin"."SystemLog" (
    "id" TEXT NOT NULL,
    "level" "admin"."LogLevel" NOT NULL DEFAULT 'INFO',
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

-- CreateTable
CREATE TABLE "app"."PreLaunchApproval" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreLaunchApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "app"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_code_key" ON "app"."Exchange"("code");

-- CreateIndex
CREATE INDEX "Exchange_organizerId_idx" ON "app"."Exchange"("organizerId");

-- CreateIndex
CREATE INDEX "Exchange_status_idx" ON "app"."Exchange"("status");

-- CreateIndex
CREATE INDEX "Exchange_code_idx" ON "app"."Exchange"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalog_url_key" ON "app"."ProductCatalog"("url");

-- CreateIndex
CREATE INDEX "Item_userId_idx" ON "app"."Item"("userId");

-- CreateIndex
CREATE INDEX "Item_catalogId_idx" ON "app"."Item"("catalogId");

-- CreateIndex
CREATE INDEX "Wishlist_userId_idx" ON "app"."Wishlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_wishlistId_itemId_key" ON "app"."WishlistItem"("wishlistId", "itemId");

-- CreateIndex
CREATE INDEX "ExchangeMember_exchangeId_codename_idx" ON "app"."ExchangeMember"("exchangeId", "codename");

-- CreateIndex
CREATE INDEX "ExchangeMember_exchangeId_idx" ON "app"."ExchangeMember"("exchangeId");

-- CreateIndex
CREATE INDEX "ExchangeMember_userId_idx" ON "app"."ExchangeMember"("userId");

-- CreateIndex
CREATE INDEX "ExchangeMember_targetUserId_idx" ON "app"."ExchangeMember"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeMember_exchangeId_userId_key" ON "app"."ExchangeMember"("exchangeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CovertInviteToken_token_key" ON "app"."CovertInviteToken"("token");

-- CreateIndex
CREATE INDEX "CovertInviteToken_exchangeId_idx" ON "app"."CovertInviteToken"("exchangeId");

-- CreateIndex
CREATE INDEX "CovertInviteToken_token_idx" ON "app"."CovertInviteToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ExclusionRule_exchangeId_memberId_restrictedMemberId_key" ON "app"."ExclusionRule"("exchangeId", "memberId", "restrictedMemberId");

-- CreateIndex
CREATE INDEX "ExchangeMessage_exchangeId_idx" ON "app"."ExchangeMessage"("exchangeId");

-- CreateIndex
CREATE INDEX "Notification_userId_isAcknowledged_idx" ON "app"."Notification"("userId", "isAcknowledged");

-- CreateIndex
CREATE INDEX "ExchangeReport_exchangeId_idx" ON "app"."ExchangeReport"("exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "ClearanceLead_email_key" ON "app"."ClearanceLead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "admin"."AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "admin"."AdminUser"("username");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "admin"."SystemLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_level_createdAt_idx" ON "admin"."SystemLog"("level", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_category_createdAt_idx" ON "admin"."SystemLog"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PreLaunchApproval_email_key" ON "app"."PreLaunchApproval"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PreLaunchApproval_inviteCode_key" ON "app"."PreLaunchApproval"("inviteCode");

-- AddForeignKey
ALTER TABLE "app"."Exchange" ADD CONSTRAINT "Exchange_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Item" ADD CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Item" ADD CONSTRAINT "Item_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "app"."ProductCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "app"."Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."WishlistItem" ADD CONSTRAINT "WishlistItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "app"."Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeMember" ADD CONSTRAINT "ExchangeMember_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "app"."Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeMember" ADD CONSTRAINT "ExchangeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeMember" ADD CONSTRAINT "ExchangeMember_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "app"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeMember" ADD CONSTRAINT "ExchangeMember_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "app"."Wishlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."CovertInviteToken" ADD CONSTRAINT "CovertInviteToken_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "app"."Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExclusionRule" ADD CONSTRAINT "ExclusionRule_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "app"."Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExclusionRule" ADD CONSTRAINT "ExclusionRule_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExclusionRule" ADD CONSTRAINT "ExclusionRule_restrictedMemberId_fkey" FOREIGN KEY ("restrictedMemberId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeMessage" ADD CONSTRAINT "ExchangeMessage_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "app"."Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeMessage" ADD CONSTRAINT "ExchangeMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeMessage" ADD CONSTRAINT "ExchangeMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeReport" ADD CONSTRAINT "ExchangeReport_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "app"."Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ExchangeReport" ADD CONSTRAINT "ExchangeReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."SystemConfig" ADD CONSTRAINT "SystemConfig_activeThemeId_fkey" FOREIGN KEY ("activeThemeId") REFERENCES "app"."ThemePreset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- -----------------------------------------------------------------------------
-- PRODUCTION CLEAN DATA SEED (SystemConfig, Super Admin)
-- -----------------------------------------------------------------------------

INSERT INTO admin."SystemConfig" ("id", "activeThemeId", "activeSeason", "announcementBannerActive", "freeAnnualHostAllowance", "freeAnnualJoinAllowance", "paidEventPriceUsd", "maxFreeParticipants", "maxWishlistItems", "updatedAt")
VALUES ('singleton', 'winter_holiday', 'auto', true, 1, 3, 5.00, 25, 50, NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO admin."AdminUser" ("id", "username", "email", "name", "passwordHash", "role", "isActive", "requiresPasswordReset", "createdAt", "updatedAt")
VALUES ('00000000-0000-4000-a000-000000000001', 'santa', 'admin@kovertklaus.com', 'Santa Claus', '$scrypt$1024$8$1$cb49ff797231d2983fe771d4dd768619$13cf44c8d92122956becee36ceb936c30c0b74ab2ad2835383f8e9a5894e1175', 'SUPER_ADMIN', true, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

