import fs from 'fs';
import path from 'path';
import { db } from '../src/lib/db';
import bcrypt from 'bcryptjs';

/**
 * Migration & Ingestion Engine for Legacy KovertKlaus SQL Dumps
 *
 * Translates legacy pre-refactor database dumps (Mission, MissionAgent, demerits,
 * allowOperatorView*) into modern PostgreSQL Prisma schema (Exchange, ExchangeMember,
 * penaltyPoints, allowOrganizerView*).
 */

interface LegacyUser {
  id: string;
  email: string;
  name: string;
  codename: string | null;
  passwordHash: string;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  demerits: number;
  accountStatus: string;
  emailNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
  addressLine2: string | null;
  allergiesDiet: string | null;
  deliveryNotes: string | null;
  dislikes: string | null;
  favoriteColors: string | null;
  favoriteHobbies: string | null;
  shirtSize: string | null;
  shoeSize: string | null;
  allowOperatorViewFavorites: boolean;
  bottomHalfSize: string | null;
  topHalfSize: string | null;
  allowOperatorViewAllergies: boolean;
  allowOperatorViewMeasurements: boolean;
  allowOperatorViewSizes: boolean;
  chestBustMeasurement: string | null;
  inseamMeasurement: string | null;
  waistMeasurement: string | null;
}

interface LegacyMission {
  id: string;
  title: string;
  description: string | null;
  code: string;
  opsLeaderId: string;
  maxParticipants: number | null;
  giftingType: string;
  isLocalOnly: boolean;
  eventLocation: string | null;
  isWhiteElephant: boolean;
  budgetMin: number | null;
  budgetMax: number;
  currency: string;
  inviteCutoffDate: Date;
  assignmentDate: Date;
  shippingDate: Date | null;
  executionDate: Date;
  status: string;
  isFreeAnnualOp: boolean;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  drawVerifiedAt: Date | null;
  opsLeaderAssistedDraw: boolean;
}

interface LegacyWishlist {
  id: string;
  userId: string;
  name: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

function parseSqlCopyTable(content: string, tableName: string): { cols: string[]; rows: string[][] } | null {
  const regex = new RegExp(`COPY public\\."${tableName}" \\(([^)]+)\\) FROM stdin;\\n([\\s\\S]*?)\\n\\\\\\.`);
  const match = content.match(regex);
  if (!match) return null;

  const cols = match[1].split(', ').map((c) => c.replace(/"/g, '').trim());
  const lines = match[2].split('\n').filter((l) => l.trim().length > 0);
  const rows = lines.map((l) => l.split('\t'));
  return { cols, rows };
}

function cleanVal(v: string | undefined): string | null {
  if (v === undefined || v === '\\N' || v === '') return null;
  return v;
}

function parseBool(v: string | undefined, defaultVal = false): boolean {
  if (v === undefined || v === '\\N') return defaultVal;
  return v === 't' || v === 'true' || v === '1';
}

export async function migrateLegacySqlDump(sqlFilePath: string) {
  console.log(`\n🚀 Starting Legacy Database Migration from: ${sqlFilePath}`);

  if (!fs.existsSync(sqlFilePath)) {
    throw new Error(`SQL file not found at path: ${sqlFilePath}`);
  }

  const content = fs.readFileSync(sqlFilePath, 'utf8');

  // 1. Extract Users
  const userData = parseSqlCopyTable(content, 'User');
  if (!userData) {
    throw new Error('No public."User" table found in SQL dump.');
  }

  const legacyUsers: LegacyUser[] = userData.rows.map((row) => {
    const obj: any = {};
    userData.cols.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      id: obj.id,
      email: obj.email,
      name: obj.name,
      codename: cleanVal(obj.codename),
      passwordHash: obj.passwordHash,
      streetAddress: cleanVal(obj.streetAddress),
      city: cleanVal(obj.city),
      state: cleanVal(obj.state),
      zipCode: cleanVal(obj.zipCode),
      country: cleanVal(obj.country) || 'US',
      demerits: parseInt(obj.demerits || '0', 10),
      accountStatus: obj.accountStatus || 'ACTIVE',
      emailNotifications: parseBool(obj.emailNotifications, true),
      createdAt: new Date(obj.createdAt || Date.now()),
      updatedAt: new Date(obj.updatedAt || Date.now()),
      addressLine2: cleanVal(obj.addressLine2),
      allergiesDiet: cleanVal(obj.allergiesDiet),
      deliveryNotes: cleanVal(obj.deliveryNotes),
      dislikes: cleanVal(obj.dislikes),
      favoriteColors: cleanVal(obj.favoriteColors),
      favoriteHobbies: cleanVal(obj.favoriteHobbies),
      shirtSize: cleanVal(obj.shirtSize),
      shoeSize: cleanVal(obj.shoeSize),
      allowOperatorViewFavorites: parseBool(obj.allowOperatorViewFavorites, false),
      bottomHalfSize: cleanVal(obj.bottomHalfSize),
      topHalfSize: cleanVal(obj.topHalfSize),
      allowOperatorViewAllergies: parseBool(obj.allowOperatorViewAllergies, true),
      allowOperatorViewMeasurements: parseBool(obj.allowOperatorViewMeasurements, false),
      allowOperatorViewSizes: parseBool(obj.allowOperatorViewSizes, true),
      chestBustMeasurement: cleanVal(obj.chestBustMeasurement),
      inseamMeasurement: cleanVal(obj.inseamMeasurement),
      waistMeasurement: cleanVal(obj.waistMeasurement),
    };
  });

  console.log(`📋 Found ${legacyUsers.length} legacy users to migrate.`);

  // Upsert Users into modern schema
  let usersCreated = 0;
  let usersUpdated = 0;
  for (const u of legacyUsers) {
    const existing = await db.user.findFirst({
      where: { OR: [{ id: u.id }, { email: u.email }] },
    });

    const modernUserData = {
      name: u.name,
      email: u.email,
      codename: u.codename,
      passwordHash: u.passwordHash,
      streetAddress: u.streetAddress,
      addressLine2: u.addressLine2,
      city: u.city,
      state: u.state,
      zipCode: u.zipCode,
      country: u.country || 'US',
      deliveryNotes: u.deliveryNotes,
      shirtSize: u.shirtSize,
      topHalfSize: u.topHalfSize,
      bottomHalfSize: u.bottomHalfSize,
      shoeSize: u.shoeSize,
      chestBustMeasurement: u.chestBustMeasurement,
      waistMeasurement: u.waistMeasurement,
      inseamMeasurement: u.inseamMeasurement,
      favoriteColors: u.favoriteColors,
      allergiesDiet: u.allergiesDiet,
      dislikes: u.dislikes,
      favoriteHobbies: u.favoriteHobbies,
      allowOrganizerViewSizes: u.allowOperatorViewSizes,
      allowOrganizerViewMeasurements: u.allowOperatorViewMeasurements,
      allowOrganizerViewAllergies: u.allowOperatorViewAllergies,
      allowOrganizerViewFavorites: u.allowOperatorViewFavorites,
      penaltyPoints: u.demerits,
      accountStatus: (u.accountStatus as any) || 'ACTIVE',
      emailNotifications: u.emailNotifications,
    };

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: modernUserData,
      });
      usersUpdated++;
    } else {
      await db.user.create({
        data: {
          id: u.id,
          ...modernUserData,
        },
      });
      usersCreated++;
    }
  }
  console.log(`✅ Users Processed: ${usersCreated} created, ${usersUpdated} updated.`);

  // 2. Extract Wishlists
  const wishlistData = parseSqlCopyTable(content, 'Wishlist');
  let wishlistsCreated = 0;
  let wishlistsUpdated = 0;
  if (wishlistData) {
    const legacyWishlists: LegacyWishlist[] = wishlistData.rows.map((row) => {
      const obj: any = {};
      wishlistData.cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: obj.id,
        userId: obj.userId,
        name: obj.name,
        type: obj.type === 'WHITE_ELEPHANT' ? 'WHITE_ELEPHANT' : 'STANDARD',
        createdAt: new Date(obj.createdAt || Date.now()),
        updatedAt: new Date(obj.updatedAt || Date.now()),
      };
    });

    console.log(`📋 Found ${legacyWishlists.length} legacy wishlists to migrate.`);
    for (const w of legacyWishlists) {
      const existing = await db.wishlist.findUnique({ where: { id: w.id } });
      if (existing) {
        await db.wishlist.update({
          where: { id: w.id },
          data: {
            name: w.name,
            type: w.type as any,
          },
        });
        wishlistsUpdated++;
      } else {
        await db.wishlist.create({
          data: {
            id: w.id,
            userId: w.userId,
            name: w.name,
            type: w.type as any,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
          },
        });
        wishlistsCreated++;
      }
    }
    console.log(`✅ Wishlists Processed: ${wishlistsCreated} created, ${wishlistsUpdated} updated.`);
  }

  // 3. Extract Missions -> Modern Exchanges
  const missionData = parseSqlCopyTable(content, 'Mission');
  let exchangesCreated = 0;
  let exchangesUpdated = 0;
  if (missionData) {
    const legacyMissions: LegacyMission[] = missionData.rows.map((row) => {
      const obj: any = {};
      missionData.cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: obj.id,
        title: obj.title,
        description: cleanVal(obj.description),
        code: obj.code,
        opsLeaderId: obj.opsLeaderId,
        maxParticipants: obj.maxParticipants ? parseInt(obj.maxParticipants, 10) : null,
        giftingType: obj.giftingType || 'SINGLE',
        isLocalOnly: parseBool(obj.isLocalOnly, false),
        eventLocation: cleanVal(obj.eventLocation),
        isWhiteElephant: parseBool(obj.isWhiteElephant, false),
        budgetMin: obj.budgetMin ? parseFloat(obj.budgetMin) : null,
        budgetMax: parseFloat(obj.budgetMax || '50.00'),
        currency: obj.currency || 'USD',
        inviteCutoffDate: new Date(obj.inviteCutoffDate),
        assignmentDate: new Date(obj.assignmentDate),
        shippingDate: obj.shippingDate ? new Date(obj.shippingDate) : null,
        executionDate: new Date(obj.executionDate),
        status: obj.status || 'RECRUITING',
        isFreeAnnualOp: parseBool(obj.isFreeAnnualOp, false),
        paymentStatus: obj.paymentStatus || 'FREE_ANNUAL',
        createdAt: new Date(obj.createdAt || Date.now()),
        updatedAt: new Date(obj.updatedAt || Date.now()),
        drawVerifiedAt: obj.drawVerifiedAt ? new Date(obj.drawVerifiedAt) : null,
        opsLeaderAssistedDraw: parseBool(obj.opsLeaderAssistedDraw, true),
      };
    });

    console.log(`📋 Found ${legacyMissions.length} legacy missions to migrate as Exchanges.`);
    for (const m of legacyMissions) {
      const existing = await db.exchange.findUnique({ where: { code: m.code } });
      const modernExchangeData = {
        title: m.title,
        description: m.description,
        organizerId: m.opsLeaderId,
        maxParticipants: m.maxParticipants,
        giftingType: (m.giftingType as any) || 'SINGLE',
        isLocalOnly: m.isLocalOnly,
        eventLocation: m.eventLocation,
        isWhiteElephant: m.isWhiteElephant,
        organizerAssistedDraw: m.opsLeaderAssistedDraw,
        drawVerifiedAt: m.drawVerifiedAt,
        budgetMin: m.budgetMin,
        budgetMax: m.budgetMax,
        currency: m.currency,
        inviteCutoffDate: m.inviteCutoffDate,
        assignmentDate: m.assignmentDate,
        shippingDate: m.shippingDate,
        executionDate: m.executionDate,
        status: (m.status as any) || 'RECRUITING',
        isFreeAnnualExchange: m.isFreeAnnualOp,
        paymentStatus: (m.paymentStatus as any) || 'FREE_ANNUAL',
      };

      let exchangeId = m.id;
      if (existing) {
        await db.exchange.update({
          where: { id: existing.id },
          data: modernExchangeData,
        });
        exchangeId = existing.id;
        exchangesUpdated++;
      } else {
        const created = await db.exchange.create({
          data: {
            id: m.id,
            code: m.code,
            ...modernExchangeData,
          },
        });
        exchangeId = created.id;
        exchangesCreated++;
      }

      // Auto-enroll all family members into the primary SIMPSON-2026 exchange
      if (m.code === 'SIMPSON-2026') {
        console.log(`👥 Enrolling all ${legacyUsers.length} family members into "${m.title}" (${m.code})...`);
        for (const user of legacyUsers) {
          // Find standard wishlist for user
          const userWishlist = await db.wishlist.findFirst({
            where: { userId: user.id, type: 'STANDARD' },
          });

          await db.exchangeMember.upsert({
            where: {
              exchangeId_userId: {
                exchangeId,
                userId: user.id,
              },
            },
            update: {
              role: user.id === m.opsLeaderId ? 'ORGANIZER' : 'MEMBER',
              wishlistId: userWishlist?.id || null,
              codename: user.codename,
            },
            create: {
              exchangeId,
              userId: user.id,
              role: user.id === m.opsLeaderId ? 'ORGANIZER' : 'MEMBER',
              wishlistId: userWishlist?.id || null,
              codename: user.codename,
            },
          });
        }
      }
    }
    console.log(`✅ Exchanges Processed: ${exchangesCreated} created, ${exchangesUpdated} updated.`);
  }

  console.log(`\n🎉 Migration Complete! All legacy data migrated into modern Prisma schema.`);
}

// Direct CLI Invocation
if (require.main === module) {
  const targetFile = process.argv[2] || path.join(__dirname, '../prisma/kovertklaus_test_db.sql');
  migrateLegacySqlDump(targetFile)
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
