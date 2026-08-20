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

const familyMembers = [
  { name: 'Joshua Simpson', email: 'joshua@example.com', codename: 'Joshua' },
  { name: 'Zachary Simpson', email: 'zachary@example.com', codename: 'Zachary' },
  { name: 'Shannon Jaelynn Simpson', email: 'shannon@example.com', codename: 'Shannon' },
  { name: 'Matthew Simpson', email: 'matthew@example.com', codename: 'Matthew' },
  { name: 'Leslie Simpson-Crawford', email: 'leslie@example.com', codename: 'Leslie' },
  { name: 'Charles Crawford', email: 'charles@example.com', codename: 'Charles' },
  { name: 'David Simpson', email: 'david@example.com', codename: 'David' },
  { name: 'Debbie Kraemer', email: 'debbie@example.com', codename: 'Debbie' },
  { name: 'Michael Kelly', email: 'michael@example.com', codename: 'Michael' },
  { name: 'Terry Kelly', email: 'terry@example.com', codename: 'Terry' },
  { name: 'Sharon Goins', email: 'sharon@example.com', codename: 'Sharon' },
  { name: 'Thomas Goins', email: 'thomas@example.com', codename: 'Thomas' },
  { name: 'Leonard Courier', email: 'leonard@example.com', codename: 'Leonard' },
  { name: 'Cheryl Courier', email: 'cheryl@example.com', codename: 'Cheryl' },
  { name: 'Kristy Bonifer', email: 'kristy@example.com', codename: 'Kristy' },
  { name: 'Dayton Moses', email: 'dayton@example.com', codename: 'Dayton' },
  { name: 'Kathy Moses', email: 'kathy@example.com', codename: 'Kathy' },
  { name: 'John Moses', email: 'john@example.com', codename: 'John' },
  { name: 'James Moses', email: 'james@example.com', codename: 'James' },
  { name: 'Julia Kelly', email: 'julia@example.com', codename: 'Julia' },
  { name: 'Kimberly Piercy', email: 'kimberly@example.com', codename: 'Kimberly' },
  { name: 'Rodney Piercy', email: 'rodney@example.com', codename: 'Rodney' },
];

async function main() {
  console.log('🌱 Seeding KovertKlaus database (Theme Presets, System Config, Test Users)...');

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
        requiresPasswordReset: true,
      },
    });
    console.log('🎅 Seeded initial Super Admin (username: santa, email: admin@kovertklaus.com)');
  }

  // ---------------------------------------------------------------------------
  // 3. Seed Family Test Accounts & Wishlists
  // ---------------------------------------------------------------------------
  const defaultPassword = 'Klaus2026!';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  const userMap = new Map<string, string>();

  for (const member of familyMembers) {
    let userRecord = await db.user.findUnique({
      where: { email: member.email },
    });

    if (!userRecord) {
      userRecord = await db.user.create({
        data: {
          name: member.name,
          email: member.email,
          codename: member.codename,
          passwordHash,
        },
      });

      await db.wishlist.create({
        data: {
          userId: userRecord.id,
          name: 'Master Wishlist - Secret Santa',
          type: 'STANDARD',
        },
      });

      console.log(`✅ Created test user: ${member.name} <${member.email}>`);
    } else {
      userRecord = await db.user.update({
        where: { id: userRecord.id },
        data: { passwordHash },
      });
      console.log(`🔄 Reset password for test user: ${member.name} <${member.email}>`);
    }

    userMap.set(member.email, userRecord.id);
  }

  const joshuaId = userMap.get('joshua@example.com')!;
  const shannonId = userMap.get('shannon@example.com')!;

  // ---------------------------------------------------------------------------
  // Test Exchange 1: TEST-2026 (Family Holiday Secret Santa 2026)
  // ---------------------------------------------------------------------------
  const testCode1 = 'TEST-2026';
  let ex1 = await db.exchange.findUnique({ where: { code: testCode1 } });

  if (!ex1) {
    ex1 = await db.exchange.create({
      data: {
        title: 'Family Holiday Secret Santa 2026',
        description: 'Annual Simpson & Family Secret Santa Gift Exchange! Wishlists required.',
        code: testCode1,
        organizerId: joshuaId,
        maxParticipants: 25,
        giftingType: 'SINGLE',
        isLocalOnly: false,
        isWhiteElephant: false,
        budgetMin: 25,
        budgetMax: 75,
        currency: 'USD',
        inviteCutoffDate: new Date('2026-11-20T23:59:59Z'),
        assignmentDate: new Date('2026-11-25T00:00:00Z'),
        shippingDate: new Date('2026-12-15T23:59:59Z'),
        executionDate: new Date('2026-12-25T18:00:00Z'),
        status: 'RECRUITING',
        enforcePenalties: true,
        members: {
          create: familyMembers.slice(0, 12).map((m, idx) => ({
            userId: userMap.get(m.email)!,
            role: idx === 0 ? 'ORGANIZER' : 'MEMBER',
          })),
        },
      },
    });
    console.log(`🎁 Created Test Exchange 1: "${ex1.title}" (Code: ${testCode1})`);
  }

  // ---------------------------------------------------------------------------
  // Test Exchange 2: TEST-ELEV (Family White Elephant Party 2026)
  // ---------------------------------------------------------------------------
  const testCode2 = 'TEST-ELEV';
  let ex2 = await db.exchange.findUnique({ where: { code: testCode2 } });

  if (!ex2) {
    ex2 = await db.exchange.create({
      data: {
        title: 'Family White Elephant Party 2026',
        description: 'In-person local White Elephant gift stealing party! Bring 1 wrapped funny or cool gift under $30.',
        code: testCode2,
        organizerId: shannonId,
        maxParticipants: 20,
        giftingType: 'SINGLE',
        isLocalOnly: true,
        eventLocation: '123 North Pole Way, Bremerton, WA 98312',
        isWhiteElephant: true,
        budgetMin: 10,
        budgetMax: 30,
        currency: 'USD',
        inviteCutoffDate: new Date('2026-12-10T23:59:59Z'),
        assignmentDate: new Date('2026-12-15T00:00:00Z'),
        shippingDate: new Date('2026-12-20T23:59:59Z'),
        executionDate: new Date('2026-12-24T17:00:00Z'),
        status: 'RECRUITING',
        enforcePenalties: false,
        members: {
          create: familyMembers.slice(0, 8).map((m) => ({
            userId: userMap.get(m.email)!,
            role: m.email === 'shannon@example.com' ? 'ORGANIZER' : 'MEMBER',
          })),
        },
      },
    });
    console.log(`🐘 Created Test Exchange 2: "${ex2.title}" (Code: ${testCode2})`);
  }

  console.log('\n🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
