import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-static';

export interface PublicSystemConfigResponse {
  activeThemeId: string;
  themeName: string;
  activeSeason: string;
  announcementBannerActive: boolean;
  bannerTextLight: string;
  bannerTextDark: string;
  lightsStrandType: string;
  lightTokens: Record<string, string>;
  darkTokens: Record<string, string>;
  freeAnnualHostAllowance: number;
  freeAnnualJoinAllowance: number;
  paidEventPriceUsd: number;
  maxFreeParticipants: number;
  maxWishlistItems: number;
  defaultBudgetMin: number;
  defaultBudgetMax: number;
  defaultCurrency: string;
}

const DEFAULT_CONFIG_FALLBACK: PublicSystemConfigResponse = {
  activeThemeId: 'winter_holiday',
  themeName: 'Winter Holiday (Klaus & Kovert)',
  activeSeason: 'winter',
  announcementBannerActive: true,
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
  freeAnnualHostAllowance: 1,
  freeAnnualJoinAllowance: 3,
  paidEventPriceUsd: 5.0,
  maxFreeParticipants: 25,
  maxWishlistItems: 50,
  defaultBudgetMin: 0.0,
  defaultBudgetMax: 50.0,
  defaultCurrency: 'USD',
};

export async function GET() {
  try {
    const config = await db.systemConfig.findUnique({
      where: { id: 'singleton' },
      include: { activeTheme: true },
    });

    if (!config) {
      return NextResponse.json(DEFAULT_CONFIG_FALLBACK);
    }

    const theme = config.activeTheme;

    const response: PublicSystemConfigResponse = {
      activeThemeId: config.activeThemeId,
      themeName: theme?.name || DEFAULT_CONFIG_FALLBACK.themeName,
      activeSeason: config.activeSeason === 'auto' ? (theme?.season || 'winter') : config.activeSeason,
      announcementBannerActive: config.announcementBannerActive,
      bannerTextLight: theme?.bannerTextLight || DEFAULT_CONFIG_FALLBACK.bannerTextLight,
      bannerTextDark: theme?.bannerTextDark || DEFAULT_CONFIG_FALLBACK.bannerTextDark,
      lightsStrandType: theme?.lightsStrandType || DEFAULT_CONFIG_FALLBACK.lightsStrandType,
      lightTokens: (theme?.lightTokens as Record<string, string>) || DEFAULT_CONFIG_FALLBACK.lightTokens,
      darkTokens: (theme?.darkTokens as Record<string, string>) || DEFAULT_CONFIG_FALLBACK.darkTokens,
      freeAnnualHostAllowance: config.freeAnnualHostAllowance,
      freeAnnualJoinAllowance: config.freeAnnualJoinAllowance,
      paidEventPriceUsd: Number(config.paidEventPriceUsd),
      maxFreeParticipants: config.maxFreeParticipants,
      maxWishlistItems: config.maxWishlistItems,
      defaultBudgetMin: Number(config.defaultBudgetMin),
      defaultBudgetMax: Number(config.defaultBudgetMax),
      defaultCurrency: config.defaultCurrency,
    };

    return NextResponse.json(response);
  } catch (error) {
    // Fallback gracefully if database is unavailable
    return NextResponse.json(DEFAULT_CONFIG_FALLBACK);
  }
}
