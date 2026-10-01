-- KovertKlaus Clean Production PostgreSQL Database Dump (v0.2.0-alpha)
-- Conforms strictly to prisma/schema.prisma (Zero Dummy Records)

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
-- PRODUCTION CLEAN DATA SEED (Themes, SystemConfig, Super Admin)
-- -----------------------------------------------------------------------------

INSERT INTO "SystemConfig" ("id", "activeThemeId", "activeSeason", "announcementBannerActive", "freeAnnualHostAllowance", "freeAnnualJoinAllowance", "paidEventPriceUsd", "maxFreeParticipants", "maxWishlistItems", "updatedAt")
VALUES ('singleton', 'winter_holiday', 'auto', true, 1, 3, 5.00, 25, 50, NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AdminUser" ("id", "username", "email", "name", "passwordHash", "role", "isActive", "requiresPasswordReset", "createdAt", "updatedAt")
VALUES ('00000000-0000-4000-a000-000000000001', 'santa', 'admin@kovertklaus.com', 'Santa Claus', '$scrypt$1024$8$1$943ec7b7ced616c1e7c9208d9229c344$0d926b01cf819bfcf413a4e81bab177d688ad342f6836b78bbd0f033590e4b4f', 'SUPER_ADMIN', true, false, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "User" ("id", "email", "name", "codename", "passwordHash", "country", "penaltyPoints", "accountStatus", "emailNotifications", "createdAt", "updatedAt")
VALUES ('00000000-0000-4000-b000-000000000001', 'admin@kovertklaus.com', 'Santa Claus', 'Santa', '$scrypt$1024$8$1$943ec7b7ced616c1e7c9208d9229c344$0d926b01cf819bfcf413a4e81bab177d688ad342f6836b78bbd0f033590e4b4f', 'US', 0, 'ACTIVE', true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Wishlist" ("id", "userId", "name", "type", "createdAt", "updatedAt")
VALUES ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'Master Wishlist Manifest', 'STANDARD', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

