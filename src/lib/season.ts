/**
 * @file season.ts
 * @description Maps the configured season to the visual theme's season (`<html data-season>`).
 *
 * Tier 1 (what): `toThemeSeason` turns a `SystemConfig.activeSeason` / `ThemePreset.season` value
 * into one of the four Design System seasons; `SEASON_STORAGE_KEY` is where the browser caches it.
 * Tier 2 (why): The database names seasons `winter | spring | summer | autumn | universal`; the
 * visual refresh (2.0.0-beta) names its token sets `winter | spring | tropic | spooky`. One mapping
 * keeps every caller in step, and unknown values fall back to winter instead of an unstyled page.
 * Tier 3 (how): Pure. `ThemeContext` applies the result after `/api/config` loads and caches it;
 * the boot script in `layout.tsx` reads the cache before first paint, so a returning visitor never
 * sees the winter colours flash during another season.
 */

/** The four seasons with a full token set in `src/styles/kk-tokens.css`. */
export const THEME_SEASONS = ['winter', 'spring', 'tropic', 'spooky'] as const;
export type ThemeSeason = (typeof THEME_SEASONS)[number];

/** Season used when nothing (or something unknown) is configured. */
export const DEFAULT_THEME_SEASON: ThemeSeason = 'winter';

/** localStorage key holding the last applied season (read by the boot script in `layout.tsx`). */
export const SEASON_STORAGE_KEY = 'kovertklaus_season';

/** Database season names that differ from the theme's names. */
const ALIASES: Record<string, ThemeSeason> = {
  summer: 'tropic',
  autumn: 'spooky',
  fall: 'spooky',
  universal: 'winter',
};

/**
 * Resolves a configured season to a theme season.
 *
 * @param season - `activeSeason` from the public config (already resolved from `'auto'`), any case
 * @returns One of `THEME_SEASONS`; winter when the value is missing or unknown
 */
export function toThemeSeason(season: string | null | undefined): ThemeSeason {
  const key = (season ?? '').trim().toLowerCase();
  if ((THEME_SEASONS as readonly string[]).includes(key)) return key as ThemeSeason;
  return ALIASES[key] ?? DEFAULT_THEME_SEASON;
}
