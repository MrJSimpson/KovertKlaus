/**
 * @file publicConfig.ts
 * @description The single, allowlist-only source for the public `/api/config` response.
 *
 * Tier 1 (what): Maps the `SystemConfig` singleton plus its active `ThemePreset` to the public
 * configuration every visitor's browser loads (theme, season, banner, alt home, limits).
 * Tier 2 (why): `SystemConfig` also stores SMTP passwords and provider API keys. Copying named
 * public fields, never spreading the row, means a new column can never leak by accident. The
 * Next.js route (self-hosted) and the edge worker (SaaS) both use this builder, so their
 * responses are identical.
 * Tier 3 (how): `toPublicConfig(config, theme, edition)` is pure and unit-tested; pass `null`
 * for `config` to get the defaults (database empty or unreachable).
 */

/** Deployment edition reported to clients. */
export type Edition = 'saas' | 'selfhosted';

/** The public configuration contract consumed by `ThemeContext` and the landing page. */
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
  /** Landing page variant chosen in North Pole config ('' = edition default). */
  altHome?: string;
  /** Deployment edition. Clients use it to show edition-specific UI (e.g. the self-hosted Workshop link). */
  edition?: Edition;
}

/** Minimal shape of the `SystemConfig` fields this builder reads (secrets intentionally absent). */
export interface PublicConfigSource {
  activeThemeId: string;
  activeSeason: string;
  announcementBannerActive: boolean;
  altHome?: string | null;
  freeAnnualHostAllowance: number;
  freeAnnualJoinAllowance: number;
  paidEventPriceUsd: number | { toString(): string };
  maxFreeParticipants: number;
  maxWishlistItems: number;
  defaultBudgetMin: number | { toString(): string };
  defaultBudgetMax: number | { toString(): string };
  defaultCurrency: string;
}

/** Minimal shape of the `ThemePreset` fields this builder reads. */
export interface PublicThemeSource {
  name: string;
  season: string;
  bannerTextLight?: string | null;
  bannerTextDark?: string | null;
  lightsStrandType: string;
  lightTokens?: unknown;
  darkTokens?: unknown;
}

/** Defaults used when the database is empty or unavailable. */
export const DEFAULT_PUBLIC_CONFIG: Omit<PublicSystemConfigResponse, 'edition'> = {
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
  altHome: '',
};

/**
 * Builds the public configuration from the database rows.
 *
 * Tier 1: Returns only allowlisted public fields, filling gaps from `DEFAULT_PUBLIC_CONFIG`.
 * Tier 2: Never spreads `config`: secrets on `SystemConfig` cannot reach the response.
 * Tier 3: `activeSeason: 'auto'` resolves to the active theme's season (or 'winter').
 */
export function toPublicConfig(
  config: PublicConfigSource | null | undefined,
  theme: PublicThemeSource | null | undefined,
  edition: Edition
): PublicSystemConfigResponse {
  const d = DEFAULT_PUBLIC_CONFIG;
  if (!config) return { ...d, edition };
  return {
    activeThemeId: config.activeThemeId,
    themeName: theme?.name || d.themeName,
    activeSeason: config.activeSeason === 'auto' ? theme?.season || 'winter' : config.activeSeason,
    announcementBannerActive: config.announcementBannerActive,
    bannerTextLight: theme?.bannerTextLight || d.bannerTextLight,
    bannerTextDark: theme?.bannerTextDark || d.bannerTextDark,
    lightsStrandType: theme?.lightsStrandType || d.lightsStrandType,
    lightTokens: (theme?.lightTokens as Record<string, string>) || d.lightTokens,
    darkTokens: (theme?.darkTokens as Record<string, string>) || d.darkTokens,
    freeAnnualHostAllowance: config.freeAnnualHostAllowance,
    freeAnnualJoinAllowance: config.freeAnnualJoinAllowance,
    paidEventPriceUsd: Number(config.paidEventPriceUsd),
    maxFreeParticipants: config.maxFreeParticipants,
    maxWishlistItems: config.maxWishlistItems,
    defaultBudgetMin: Number(config.defaultBudgetMin),
    defaultBudgetMax: Number(config.defaultBudgetMax),
    defaultCurrency: config.defaultCurrency,
    altHome: (config.altHome || '').trim().toLowerCase(),
    edition,
  };
}
