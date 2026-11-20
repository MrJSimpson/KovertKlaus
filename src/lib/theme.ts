/**
 * KovertKlaus Centralized Theme Design System
 *
 * Single source of truth for color tokens, card variants, buttons, badges, and alerts across Light & Dark modes.
 * Supports runtime overlaying with database-persisted `ThemePreset` tokens.
 *
 * Since the visual refresh (2.0.0-beta) the classes point at the Design System's roles (kk-btn,
 * cards, fields, banners, pills in `src/styles/kk-components.css`); colours come from the season
 * tokens in `src/styles/kk-tokens.css`.
 */

export type ThemeClasses = ReturnType<typeof getBaseThemeClasses>;

/**
 * Seasonal Light Strand Types for the 4-Season Rotation Calendar.
 */
export type LightsStrandType =
  | 'christmas_bulbs'   // Q1: Winter Holiday HQ (Nov 1 - Jan 31)
  | 'easter_eggs'       // Q2: Spring Egg Hunt (Feb 1 - Apr 30)
  | 'tropic_lanterns'   // Q3: Tropic Klaus / Christmas in July (May 1 - Jul 31)
  | 'spooky_pumpkins'   // Q4: Spooky Autumn / Haunted Workshop (Aug 1 - Oct 31)
  | 'none';

/**
 * Generates the complete baseline Tailwind CSS token mapping for a given visual mode.
 *
 * Colors use the `kk-*` palette utilities defined in `globals.css`. Those resolve to CSS
 * variables that switch with the `.dark` class on `<html>`, so a token is the same string in
 * both modes and always matches the active palette. `isDarkMode` only selects shadow depth.
 *
 * @param isDarkMode - `true` for Kovert Mode 🕶️; `false` for Klaus Mode 🎄
 * @returns Comprehensive dictionary of Tailwind utility class bindings
 */
function getBaseThemeClasses(isDarkMode: boolean) {
  // Visual refresh (2.0.0-beta): the class map now points at the Design System's roles, so every
  // screen not yet rebuilt (dialogs, North Pole, workshop) picks up the new cards, buttons, fields,
  // banners and pills at once. `isDarkMode` no longer changes anything: the tokens switch per theme.
  void isDarkMode;
  const card = 'bg-kk-surface border border-kk-border text-kk-ink shadow-kk-card';
  const pill = 'rounded-full font-semibold';

  return {
    // Page & Structural Layout
    pageBg: 'bg-kk-page text-kk-ink selection:bg-kk-primary selection:text-kk-on-primary',
    headerBg: 'bg-kk-header border-kk-border text-kk-on-header',
    footerBg: 'bg-kk-header border-kk-border text-kk-on-header',

    // Section Frames & Container Cards (Design System `Card`)
    sectionFrame: card,
    cardBg: card,
    cardInnerBg: 'bg-kk-inset border border-kk-border text-kk-ink',
    modalBg: 'bg-kk-surface border border-kk-border text-kk-ink shadow-kk-raised',
    // Section heading strip across the top of a p-6 card: a quiet inset band (the coloured header
    // band is replaced by folder tabs in rebuilt screens).
    sectionBand: '-mx-6 -mt-6 mb-5 px-6 py-3.5 rounded-t-[12px] bg-kk-inset text-kk-heading border-b border-kk-border font-display',
    infoPanel: 'bg-kk-inset text-kk-ink',

    // Head Elf Console
    consoleCard: `${card} border-kk-border-strong`,
    consoleHeading: 'font-display text-kk-heading font-bold text-lg',
    consoleText: 'text-kk-muted text-xs font-semibold mt-0.5',
    consoleBadge: `bg-kk-gold text-kk-on-gold border border-kk-border font-mono px-3 py-1 ${pill}`,

    // Buttons: the four Design System roles (primary, secondary, ghost, danger)
    btnPrimary: 'kk-btn kk-btn--primary',
    btnSecondary: 'kk-btn kk-btn--secondary',
    btnToggle: 'bg-transparent border border-kk-on-header text-kk-on-header hover:bg-white/10 font-semibold transition-all',
    btnNeutral: 'kk-btn kk-btn--ghost',
    btnEmerald: 'kk-btn kk-btn--secondary',
    btnAmber: 'kk-btn kk-btn--secondary',
    btnSky: 'kk-btn kk-btn--ghost',
    btnPurple: 'kk-btn kk-btn--ghost',

    // Input Controls (Design System `TextField`)
    inputBg: 'bg-kk-inset border-kk-border-control text-kk-ink placeholder:text-kk-muted focus:ring-kk-focus',
    inputModalBg: 'bg-kk-inset border-kk-border-control text-kk-ink placeholder:text-kk-muted focus:ring-kk-focus',
    inputDisabled: 'bg-kk-inset border-kk-border text-kk-muted font-mono cursor-not-allowed opacity-100',

    // Tab Navigation Bar Tokens
    tabBarBg: 'bg-kk-inset border-kk-border text-kk-muted',
    tabActive: 'border-b-2 border-kk-stamp text-kk-heading font-bold bg-kk-surface',
    tabInactive: 'border-b-2 border-transparent text-kk-muted hover:text-kk-ink font-semibold',

    // Badges & Status Pills (Design System `StatusPill`)
    badgeCode: `bg-kk-inset text-kk-ink border border-kk-border font-mono ${pill}`,
    badgeSecretSanta: `bg-kk-success text-kk-on-success ${pill}`,
    badgeWhiteElephant: `bg-kk-gold text-kk-on-gold ${pill}`,
    badgeAmber: `bg-kk-warning text-kk-on-warning ${pill}`,
    badgeRose: `bg-kk-danger-soft text-kk-on-danger-soft ${pill}`,

    // Countdown Badges
    badgeCountdown: 'bg-kk-inset text-kk-ink border border-kk-border font-mono font-semibold',
    badgeCountdownUrgent: 'bg-kk-warning text-kk-on-warning font-mono font-semibold',
    badgeCountdownToday: 'bg-kk-success text-kk-on-success font-mono font-semibold motion-safe:animate-pulse',

    // Alerts & Notifications (Design System `Banner`)
    alertError: 'bg-kk-danger-soft border border-kk-danger text-kk-on-danger-soft',
    alertWarning: 'bg-kk-warning border border-kk-border-control text-kk-on-warning',
    alertSuccess: 'bg-kk-success border border-kk-border text-kk-on-success',

    // Text Color Utilities
    headerNav: 'text-kk-on-header hover:underline font-semibold',
    heroSubtext: 'text-kk-muted',
    heroGradient: 'text-kk-stamp',
    textAccent: 'text-kk-accent font-semibold',
    textBrand: 'text-kk-heading font-semibold',
    textGoldOnDark: 'text-kk-on-header font-semibold',
    textHeading: 'text-kk-heading font-bold font-display',
    textLabel: 'text-kk-ink font-semibold',
    textSubLabel: 'text-kk-muted font-normal',
    textMuted: 'text-kk-muted',
    textDate: 'text-kk-heading font-semibold font-mono',
  };
}

/**
 * Resolves theme classes for the application, merging baseline tokens with any active
 * database-persisted `ThemePreset` token overrides.
 *
 * @param isDarkMode - Active dark mode toggle state
 * @param presetTokens - Optional JSON record of token overrides configured in North Pole Admin
 * @returns Fully merged ThemeClasses object ready for React component consumption
 */
export function getThemeClasses(isDarkMode: boolean, presetTokens?: Record<string, string>): ThemeClasses {
  const base = getBaseThemeClasses(isDarkMode);
  if (!presetTokens || typeof presetTokens !== 'object') {
    return base;
  }

  return {
    ...base,
    ...presetTokens,
  } as ThemeClasses;
}
