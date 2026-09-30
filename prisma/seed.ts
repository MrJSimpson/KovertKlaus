import { db } from '../src/lib/db';
import bcrypt from 'bcryptjs';

const canonicalThemes = [
  {
    id: 'winter_holiday',
    name: 'Winter Holiday (Klaus & Kovert)',
    season: 'winter',
    isDefault: true,
    altHomeKey: 'coming_soon',
    bannerTextLight: '🎄 Welcome to KovertKlaus! Organize gift exchanges in under 60 seconds.',
    bannerTextDark: '❄️ Winter Night Ops Active — Covert Holiday Gifting',
    lightsStrandType: 'christmas_bulbs',
    lightTokens: {
      accentColor: '#dc2626',
      heroBadgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      btnPrimary: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-md shadow-red-900/20',
      btnSecondary: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm',
    },
    darkTokens: {
      accentColor: '#38bdf8',
      heroBadgeBg: 'bg-sky-950/70 text-sky-300 border-sky-800/80',
      btnPrimary: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-bold shadow-md shadow-sky-500/20',
      btnSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
    },
  },
  {
    id: 'spring_egg_hunt',
    name: 'Spring Egg Hunt (Meadow & Shadow)',
    season: 'spring',
    isDefault: false,
    altHomeKey: 'app_home',
    bannerTextLight: '🌸 Spring Egg Hunt Active! Secret Garden Gifting in Session.',
    bannerTextDark: '🐰 Shadow Warren Ops — Covert Spring Dispatches',
    lightsStrandType: 'easter_eggs',
    lightTokens: {
      accentColor: '#10b981',
      heroBadgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      btnPrimary: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-900/20',
      btnSecondary: 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm',
    },
    darkTokens: {
      accentColor: '#34d399',
      heroBadgeBg: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80',
      btnPrimary: 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20',
      btnSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
    },
  },
  {
    id: 'tropic_klaus',
    name: 'Tropic Klaus / Summer (Cabana & Luau)',
    season: 'summer',
    isDefault: false,
    altHomeKey: 'app_home',
    bannerTextLight: '🌴 Christmas in July / Tropic Klaus Active! Tropical Gifting Underway.',
    bannerTextDark: '🍹 Midnight Luau Ops — Stealth Tropical Gift Drops',
    lightsStrandType: 'tropic_lanterns',
    lightTokens: {
      accentColor: '#0ea5e9',
      heroBadgeBg: 'bg-amber-50 text-amber-900 border-amber-300',
      btnPrimary: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-md shadow-amber-900/20',
      btnSecondary: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm',
    },
    darkTokens: {
      accentColor: '#38bdf8',
      heroBadgeBg: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/80',
      btnPrimary: 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20',
      btnSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
    },
  },
  {
    id: 'spooky_autumn',
    name: 'Spooky Autumn (Harvest & Haunted)',
    season: 'autumn',
    isDefault: false,
    altHomeKey: 'app_home',
    bannerTextLight: '🍂 Autumn Harvest Exchange! Cozy seasonal gift sharing.',
    bannerTextDark: '🎃 Haunted Workshop Ops — Stealth Spooky Swaps',
    lightsStrandType: 'spooky_pumpkins',
    lightTokens: {
      accentColor: '#ea580c',
      heroBadgeBg: 'bg-orange-50 text-orange-900 border-orange-300',
      btnPrimary: 'bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-500 hover:to-amber-600 text-white shadow-md shadow-orange-900/20',
      btnSecondary: 'bg-stone-700 hover:bg-stone-800 text-white shadow-sm',
    },
    darkTokens: {
      accentColor: '#fb923c',
      heroBadgeBg: 'bg-orange-950/70 text-orange-300 border-orange-800/80',
      btnPrimary: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-bold shadow-md shadow-orange-500/20',
      btnSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
    },
  },
];

interface SeedFamilyMember {
  id?: string;
  name: string;
  email: string;
  codename: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  allowOrganizerViewSizes?: boolean;
  allowOrganizerViewAllergies?: boolean;
  allowOrganizerViewMeasurements?: boolean;
  allowOrganizerViewFavorites?: boolean;
}

const familyMembers: SeedFamilyMember[] = [
  {
    id: '2e65ae12-b926-4489-b220-8e704d983bda',
    name: 'Joshua Simpson',
    email: 'joshua@example.com',
    codename: 'Chewie',
    streetAddress: '6189 Pine Rd NE',
    city: 'Bremerton',
    state: 'WA',
    zipCode: '98311',
    country: 'US',
    allowOrganizerViewSizes: true,
    allowOrganizerViewAllergies: true,
    allowOrganizerViewMeasurements: false,
    allowOrganizerViewFavorites: false,
  },
  {
    id: '2b2852e9-5126-4b57-9158-dbaa1463eaca',
    name: 'Zachary Simpson',
    email: 'zachary@example.com',
    codename: 'Zachary',
  },
  {
    id: '271f7a54-689d-4a3d-9d40-74b5da8a5ac5',
    name: 'Shannon Jaelynn Simpson',
    email: 'shannon@example.com',
    codename: 'Shannon',
  },
  {
    id: 'af08be00-376c-4871-bd05-e7bf2ea83841',
    name: 'Matthew Simpson',
    email: 'matthew@example.com',
    codename: 'Matthew',
  },
  {
    id: 'd151148c-aef8-434e-a048-43781cdeeddf',
    name: 'Leslie Simpson-Crawford',
    email: 'leslie@example.com',
    codename: 'Leslie',
  },
  {
    id: '8532980e-3e08-4b53-82fd-4bd87284eb4e',
    name: 'Charles Crawford',
    email: 'charles@example.com',
    codename: 'Charles',
  },
  {
    id: '864d4a8e-249a-4aff-a630-a3c1ef5ff65a',
    name: 'David Simpson',
    email: 'david@example.com',
    codename: 'David',
  },
  {
    id: 'b9868ab1-79ea-430a-966d-fab5eadfed14',
    name: 'Debbie Kraemer',
    email: 'debbie@example.com',
    codename: 'Debbie',
  },
  {
    id: '7e6f8041-20e4-4f9c-95be-58462622b542',
    name: 'Michael Kelly',
    email: 'michael@example.com',
    codename: 'Michael',
  },
  {
    id: '08d55464-478a-4a36-b13a-2cd720c68587',
    name: 'Terry Kelly',
    email: 'terry@example.com',
    codename: 'Terry',
  },
  {
    id: 'c6512237-d6b4-4e01-ba3e-180ab7eff431',
    name: 'Sharon Goins',
    email: 'sharon@example.com',
    codename: 'Sharon',
  },
  {
    id: '30fb6940-c586-4a76-a1ab-b91d276835a1',
    name: 'Thomas Goins',
    email: 'thomas@example.com',
    codename: 'Thomas',
  },
  {
    id: '83ec991a-4379-47be-8c1a-47a95aecc053',
    name: 'Leonard Courier',
    email: 'leonard@example.com',
    codename: 'Leonard',
  },
  {
    id: 'af7c7907-22d4-4bb1-81cd-b347b999d75f',
    name: 'Cheryl Courier',
    email: 'cheryl@example.com',
    codename: 'Cheryl',
  },
  {
    id: '7122c6f3-1d14-4dea-9856-7950154aff51',
    name: 'Kristy Bonifer',
    email: 'kristy@example.com',
    codename: 'Kristy',
  },
  {
    id: '30c7b060-1ced-4165-8f18-dc157af689a1',
    name: 'Dayton Moses',
    email: 'dayton@example.com',
    codename: 'Dayton',
  },
  {
    id: '66b86c8b-1743-40d5-a8ad-7cd395350ed6',
    name: 'Kathy Moses',
    email: 'kathy@example.com',
    codename: 'Kathy',
  },
  {
    id: 'f9ffcf17-cf57-4951-9fdc-6699a3076abf',
    name: 'John Moses',
    email: 'john@example.com',
    codename: 'John',
  },
  {
    id: '1a909af5-cb98-4f38-a8fb-cfaaffdc8c7d',
    name: 'James Moses',
    email: 'james@example.com',
    codename: 'James',
  },
  {
    id: '66295104-5539-45d3-9cad-60a0c329ffaf',
    name: 'Julia Kelly',
    email: 'julia@example.com',
    codename: 'Julia',
  },
  {
    id: '6a43cd31-048d-44fa-81a9-87365a9b3c1f',
    name: 'Kimberly Piercy',
    email: 'kimberly@example.com',
    codename: 'Kimberly',
  },
  {
    id: '634555c4-12c1-452f-97ef-3301a2f6c49c',
    name: 'Rodney Piercy',
    email: 'rodney@example.com',
    codename: 'Rodney',
  },
];

async function main() {
  console.log('🌱 Seeding KovertKlaus database (Theme Presets, System Config, Family Users, Exchanges)...');

  // ---------------------------------------------------------------------------
  // 1. Seed Dual-Mode Seasonal Theme Presets
  // ---------------------------------------------------------------------------
  for (const theme of canonicalThemes) {
    await db.themePreset.upsert({
      where: { id: theme.id },
      update: {
        name: theme.name,
        season: theme.season,
        isDefault: theme.isDefault,
        altHomeKey: theme.altHomeKey,
        bannerTextLight: theme.bannerTextLight,
        bannerTextDark: theme.bannerTextDark,
        lightsStrandType: theme.lightsStrandType,
        lightTokens: theme.lightTokens,
        darkTokens: theme.darkTokens,
      },
      create: {
        id: theme.id,
        name: theme.name,
        season: theme.season,
        isDefault: theme.isDefault,
        altHomeKey: theme.altHomeKey,
        bannerTextLight: theme.bannerTextLight,
        bannerTextDark: theme.bannerTextDark,
        lightsStrandType: theme.lightsStrandType,
        lightTokens: theme.lightTokens,
        darkTokens: theme.darkTokens,
      },
    });
    console.log(`🎨 Seeded Seasonal Theme: "${theme.name}" (${theme.id})`);
  }

  // ---------------------------------------------------------------------------
  // 2. Seed SystemConfig Singleton
  // ---------------------------------------------------------------------------
  await db.systemConfig.upsert({
    where: { id: 'singleton' },
    update: {
      activeThemeId: 'winter_holiday',
      activeSeason: 'auto',
      announcementBannerActive: true,
      freeAnnualHostAllowance: 1,
      freeAnnualJoinAllowance: 3,
      paidEventPriceUsd: 5.0,
      maxFreeParticipants: 25,
      maxWishlistItems: 50,
    },
    create: {
      id: 'singleton',
      activeThemeId: 'winter_holiday',
      activeSeason: 'auto',
      announcementBannerActive: true,
      freeAnnualHostAllowance: 1,
      freeAnnualJoinAllowance: 3,
      paidEventPriceUsd: 5.0,
      maxFreeParticipants: 25,
      maxWishlistItems: 50,
    },
  });
  console.log('⚙️ Seeded SystemConfig singleton (activeThemeId: winter_holiday)');

  // ---------------------------------------------------------------------------
  // 2.5 Seed Initial Super Admin (if not exists)
  // ---------------------------------------------------------------------------
  const initialAdminPassHash = await bcrypt.hash('1sEcReTdEl!vErY', 12);
  const existingAdmin = await db.adminUser.findFirst({
    where: { OR: [{ username: 'santa' }, { email: 'admin@kovertklaus.com' }] },
  });
  if (!existingAdmin) {
    await db.adminUser.create({
      data: {
        username: 'santa',
        email: 'admin@kovertklaus.com',
        name: 'Santa Claus',
        passwordHash: initialAdminPassHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        requiresPasswordReset: false,
      },
    });
    console.log('🎅 Seeded initial Super Admin (username: santa, email: admin@kovertklaus.com)');
  } else {
    await db.adminUser.update({
      where: { id: existingAdmin.id },
      data: {
        passwordHash: initialAdminPassHash,
        isActive: true,
        requiresPasswordReset: false,
      },
    });
    console.log('🔄 Reset password for Super Admin: santa');
  }

  // ---------------------------------------------------------------------------
  // 3. Seed Family Test Accounts & Master Wishlists
  // ---------------------------------------------------------------------------
  const defaultPassword = 'Klaus2026!';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  const userMap = new Map<string, string>();
  const userWishlistMap = new Map<string, string>();

  for (const member of familyMembers) {
    const existing = await db.user.findFirst({
      where: { OR: member.id ? [{ id: member.id }, { email: member.email }] : [{ email: member.email }] },
    });

    const userData = {
      name: member.name,
      email: member.email,
      codename: member.codename,
      streetAddress: member.streetAddress || null,
      city: member.city || null,
      state: member.state || null,
      zipCode: member.zipCode || null,
      country: member.country || 'US',
      allowOrganizerViewSizes: member.allowOrganizerViewSizes ?? true,
      allowOrganizerViewAllergies: member.allowOrganizerViewAllergies ?? true,
      allowOrganizerViewMeasurements: member.allowOrganizerViewMeasurements ?? false,
      allowOrganizerViewFavorites: member.allowOrganizerViewFavorites ?? false,
      passwordHash,
    };

    let userId: string;
    if (!existing) {
      const created = await db.user.create({
        data: member.id ? { id: member.id, ...userData } : userData,
      });
      userId = created.id;
      console.log(`✅ Created user: ${member.name} (${member.codename}) <${member.email}>`);
    } else {
      await db.user.update({
        where: { id: existing.id },
        data: userData,
      });
      userId = existing.id;
      console.log(`🔄 Updated user: ${member.name} (${member.codename}) <${member.email}>`);
    }

    userMap.set(member.email, userId);

    // Standard Master Wishlist Manifest
    let masterWishlist = await db.wishlist.findFirst({
      where: { userId, type: 'STANDARD' },
    });

    if (!masterWishlist) {
      masterWishlist = await db.wishlist.create({
        data: {
          userId,
          name: 'Master Wishlist Manifest - Secret Santa',
          type: 'STANDARD',
        },
      });
    }
    userWishlistMap.set(userId, masterWishlist.id);
  }

  const joshuaId = userMap.get('joshua@example.com')!;
  const shannonId = userMap.get('shannon@example.com')!;

  // Additional Wishlists for Joshua
  const existingToolsKit = await db.wishlist.findFirst({
    where: { userId: joshuaId, name: 'Tools Kit' },
  });
  if (!existingToolsKit) {
    await db.wishlist.create({
      data: {
        userId: joshuaId,
        name: 'Tools Kit',
        type: 'STANDARD',
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Primary Exchange: SIMPSON-2026 (Simpson Family Secret Santa 2026)
  // ---------------------------------------------------------------------------
  const simpsonCode = 'SIMPSON-2026';
  let simpsonEx = await db.exchange.findUnique({ where: { code: simpsonCode } });

  const simpsonData = {
    title: 'Simpson Family Secret Santa 2026',
    description: 'Annual Simpson & Family Secret Santa Gift Exchange! Wishlists required.',
    code: simpsonCode,
    organizerId: joshuaId,
    maxParticipants: 25,
    giftingType: 'SINGLE' as const,
    isLocalOnly: false,
    isWhiteElephant: false,
    budgetMin: 25,
    budgetMax: 75,
    currency: 'USD',
    inviteCutoffDate: new Date('2026-11-20T23:59:59Z'),
    assignmentDate: new Date('2026-11-25T00:00:00Z'),
    shippingDate: new Date('2026-12-15T23:59:59Z'),
    executionDate: new Date('2026-12-25T18:00:00Z'),
    status: 'RECRUITING' as const,
    enforcePenalties: true,
    isFreeAnnualExchange: true,
  };

  if (!simpsonEx) {
    simpsonEx = await db.exchange.create({
      data: simpsonData,
    });
    console.log(`🎁 Created Primary Exchange: "${simpsonEx.title}" (Code: ${simpsonCode})`);
  } else {
    simpsonEx = await db.exchange.update({
      where: { id: simpsonEx.id },
      data: simpsonData,
    });
    console.log(`🔄 Refreshed Primary Exchange: "${simpsonEx.title}" (Code: ${simpsonCode})`);
  }

  // Enroll all 22 family members into SIMPSON-2026 with attached wishlist manifests
  console.log(`👥 Enrolling all ${familyMembers.length} family members into "${simpsonEx.title}"...`);
  for (const member of familyMembers) {
    const uid = userMap.get(member.email)!;
    const wid = userWishlistMap.get(uid);

    await db.exchangeMember.upsert({
      where: {
        exchangeId_userId: {
          exchangeId: simpsonEx.id,
          userId: uid,
        },
      },
      update: {
        role: uid === joshuaId ? 'ORGANIZER' : 'MEMBER',
        wishlistId: wid || null,
        codename: member.codename,
      },
      create: {
        exchangeId: simpsonEx.id,
        userId: uid,
        role: uid === joshuaId ? 'ORGANIZER' : 'MEMBER',
        wishlistId: wid || null,
        codename: member.codename,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 5. White Elephant Exchange: SIMPSON-ELEV (Family White Elephant Party 2026)
  // ---------------------------------------------------------------------------
  const elevCode = 'SIMPSON-ELEV';
  let elevEx = await db.exchange.findUnique({ where: { code: elevCode } });

  const elevData = {
    title: 'Simpson Family White Elephant Party 2026',
    description: 'In-person local White Elephant gift stealing party! Bring 1 wrapped funny or cool gift under $30.',
    code: elevCode,
    organizerId: shannonId,
    maxParticipants: 20,
    giftingType: 'SINGLE' as const,
    isLocalOnly: true,
    eventLocation: '6189 Pine Rd NE, Bremerton, WA 98311',
    isWhiteElephant: true,
    budgetMin: 10,
    budgetMax: 30,
    currency: 'USD',
    inviteCutoffDate: new Date('2026-12-10T23:59:59Z'),
    assignmentDate: new Date('2026-12-15T00:00:00Z'),
    shippingDate: new Date('2026-12-20T23:59:59Z'),
    executionDate: new Date('2026-12-24T17:00:00Z'),
    status: 'RECRUITING' as const,
    enforcePenalties: false,
    isFreeAnnualExchange: false,
  };

  if (!elevEx) {
    elevEx = await db.exchange.create({ data: elevData });
    console.log(`🐘 Created White Elephant Exchange: "${elevEx.title}" (Code: ${elevCode})`);
  } else {
    elevEx = await db.exchange.update({
      where: { id: elevEx.id },
      data: elevData,
    });
    console.log(`🔄 Refreshed White Elephant Exchange: "${elevEx.title}" (Code: ${elevCode})`);
  }

  // Enroll local members into SIMPSON-ELEV
  const localMembers = familyMembers.slice(0, 10);
  for (const m of localMembers) {
    const uid = userMap.get(m.email)!;
    await db.exchangeMember.upsert({
      where: {
        exchangeId_userId: {
          exchangeId: elevEx.id,
          userId: uid,
        },
      },
      update: {
        role: uid === shannonId ? 'ORGANIZER' : 'MEMBER',
        codename: m.codename,
      },
      create: {
        exchangeId: elevEx.id,
        userId: uid,
        role: uid === shannonId ? 'ORGANIZER' : 'MEMBER',
        codename: m.codename,
      },
    });
  }

  // Backward compatibility alias: TEST-2026
  const testCode = 'TEST-2026';
  let testEx = await db.exchange.findUnique({ where: { code: testCode } });
  if (!testEx) {
    await db.exchange.create({
      data: {
        ...simpsonData,
        title: 'Family Holiday Secret Santa (Test Alias)',
        code: testCode,
      },
    });
    console.log(`🔗 Created test alias exchange (Code: ${testCode})`);
  }

  console.log('\n🎉 Turnkey database seeding and family migration complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
