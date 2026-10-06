import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';

const canonicalThemes = [
  {
    id: 'winter_holiday',
    name: 'Winter Holiday (Klaus & Kovert)',
    season: 'winter',
    isDefault: true,
    altHomeKey: 'app_home',
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

async function main() {
  console.log('🌱 Starting Tidy Production Database Seed (Themes, SystemConfig, Santa)...');

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
    console.log(`🎨 Seeded Theme Preset: "${theme.name}" (${theme.id})`);
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
  // 3. Seed Initial Super Admin (Santa Claus)
  // ---------------------------------------------------------------------------
  const initialAdminPassHash = await hashPassword('G!v!nGSp1r1t');
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
    console.log('🎅 Seeded Super Admin: santa <admin@kovertklaus.com> (requiresPasswordReset: true)');
  } else {
    await db.adminUser.update({
      where: { id: existingAdmin.id },
      data: {
        passwordHash: initialAdminPassHash,
        isActive: true,
      },
    });
    console.log('🔄 Updated Super Admin: santa <admin@kovertklaus.com>');
  }

  // ---------------------------------------------------------------------------
  // 4. Production Cleanliness: Purge Obsolete Test & Dummy Records
  // ---------------------------------------------------------------------------
  console.log('🧹 Purging obsolete mock exchanges, dummy wishlists, and test accounts...');

  // Delete mock exchanges (SIMPSON-2026, SIMPSON-ELEV, TEST-2026, TEST-ELEV, WQRE-JXHG)
  const mockCodes = ['SIMPSON-2026', 'SIMPSON-ELEV', 'TEST-2026', 'TEST-ELEV', 'WQRE-JXHG'];
  const deletedExchanges = await db.exchange.deleteMany({
    where: { code: { in: mockCodes } },
  });
  if (deletedExchanges.count > 0) {
    console.log(`🗑️ Removed ${deletedExchanges.count} mock exchanges.`);
  }

  // Delete dummy users ending with @example.com or old admin regular user
  const deletedUsers = await db.user.deleteMany({
    where: {
      OR: [
        { email: { endsWith: '@example.com' } },
        { email: 'admin@kovertklaus.com' },
      ],
    },
  });
  if (deletedUsers.count > 0) {
    console.log(`🗑️ Removed ${deletedUsers.count} dummy/test accounts.`);
  }

  console.log('\n✨ Database is clean, pristine, and ready for deployment!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
