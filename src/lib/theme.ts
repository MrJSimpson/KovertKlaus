/**
 * KovertKlaus Centralized Theme Design System
 *
 * Single source of truth for color tokens, card variants, buttons, badges, and alerts across Light & Dark modes.
 * Supports runtime overlaying with database-persisted `ThemePreset` tokens.
 *
 * Aesthetic Matrix (palette values live in `src/app/globals.css`):
 * - Light Mode (Klaus Mode 🎄): classic Christmas. Pine headers, holly red buttons, gold accents, snow frames.
 * - Dark Mode (Kovert Mode ❄️): blue and gold. Indigo dye surfaces, Wheat buttons, Lion and Ecru accents.
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
  const shadow = isDarkMode ? 'shadow-lg shadow-black/30' : 'shadow-md';
  const btn = 'font-bold px-4 py-2.5 rounded-xl transition-all';

  return {
    // Page & Structural Layout
    pageBg: 'bg-kk-page text-kk-ink selection:bg-kk-primary selection:text-kk-on-primary',
    headerBg: 'bg-kk-header border-kk-border-strong/40 text-kk-on-header shadow-md',
    footerBg: 'bg-kk-header border-kk-border-strong/40 text-kk-on-header',

    // Section Frames & Container Cards
    sectionFrame: `bg-kk-surface border-2 border-kk-border text-kk-ink ${shadow}`,
    cardBg: `bg-kk-surface border-2 border-kk-border text-kk-ink ${shadow}`,
    cardInnerBg: 'bg-kk-inset border border-kk-border text-kk-ink',
    modalBg: 'bg-kk-surface border-2 border-kk-border-strong/60 text-kk-ink shadow-2xl',

    // Head Elf Console Special Card Styling
    consoleCard: `bg-kk-surface border-2 border-kk-border-strong text-kk-ink ${shadow}`,
    consoleHeading: 'text-kk-heading font-black tracking-wider uppercase text-lg',
    consoleText: 'text-kk-muted text-xs font-semibold mt-0.5',
    consoleBadge: 'bg-kk-gold text-kk-on-gold border border-kk-border-strong font-mono font-bold px-3 py-1 rounded-full shadow-sm',

    // Buttons
    btnPrimary: `bg-kk-primary hover:bg-kk-primary-hover text-kk-on-primary ${shadow} font-black transition-all`,
    btnSecondary: `bg-kk-secondary hover:bg-kk-secondary-hover text-kk-on-secondary border border-kk-border-strong/50 ${btn} ${shadow}`,
    btnToggle: 'bg-kk-header border border-kk-border-strong/60 text-kk-header-nav hover:brightness-110 font-semibold transition-all',
    btnNeutral: 'bg-kk-inset border border-kk-border text-kk-ink hover:border-kk-border-strong font-semibold transition-all',
    btnEmerald: `bg-kk-secondary hover:bg-kk-secondary-hover text-kk-on-secondary ${btn} ${shadow}`,
    btnAmber: `bg-kk-gold hover:brightness-95 text-kk-on-gold border border-kk-border-strong ${btn} ${shadow}`,
    btnSky: `bg-kk-surface hover:bg-kk-inset text-kk-brand border-2 border-kk-border-strong ${btn} ${shadow}`,
    btnPurple: `bg-kk-surface hover:bg-kk-inset text-kk-accent border-2 border-kk-accent/60 ${btn} ${shadow}`,

    // Input Controls
    inputBg: 'bg-kk-surface border-kk-border text-kk-ink placeholder:text-kk-muted/70 focus:ring-kk-focus font-medium',
    inputModalBg: 'bg-kk-inset border-kk-border text-kk-ink placeholder:text-kk-muted/70 focus:ring-kk-focus font-medium',
    inputDisabled: 'bg-kk-inset border-kk-border text-kk-muted font-mono font-bold cursor-not-allowed opacity-100',

    // Tab Navigation Bar Tokens
    tabBarBg: 'bg-kk-inset border-kk-border text-kk-muted',
    tabActive: 'border-b-2 border-kk-accent text-kk-accent font-extrabold bg-kk-surface shadow-sm',
    tabInactive: 'border-b-2 border-transparent text-kk-muted hover:text-kk-ink font-bold',

    // Badges & Status Pills
    badgeCode: 'bg-kk-inset text-kk-brand border border-kk-border-strong/60 font-mono font-bold',
    badgeSecretSanta: 'bg-kk-success text-kk-on-success border border-kk-on-success/30 font-bold',
    badgeWhiteElephant: 'bg-kk-gold text-kk-on-gold border border-kk-border-strong font-bold',
    badgeAmber: 'bg-kk-warning text-kk-on-warning border border-kk-border-strong font-bold',
    badgeRose: 'bg-kk-danger-soft text-kk-on-danger-soft border border-kk-danger/40 font-bold',

    // Themed Countdown Badges & Milestone Containers
    badgeCountdown: 'bg-kk-inset text-kk-accent border border-kk-border-strong/60 font-mono font-bold shadow-sm',
    badgeCountdownUrgent: 'bg-kk-warning text-kk-on-warning border border-kk-border-strong font-mono font-bold shadow-sm',
    badgeCountdownToday: 'bg-kk-success text-kk-on-success border border-kk-on-success/30 font-mono font-bold shadow-sm motion-safe:animate-pulse',

    // Alerts & Notifications
    alertError: 'bg-kk-danger-soft border-2 border-kk-danger/50 text-kk-on-danger-soft',
    alertWarning: 'bg-kk-warning border-2 border-kk-border-strong text-kk-on-warning',
    alertSuccess: 'bg-kk-success border-2 border-kk-on-success/30 text-kk-on-success',

    // Text Color Utilities
    headerNav: 'text-kk-header-nav hover:text-kk-on-header font-semibold',
    heroSubtext: 'text-kk-muted font-medium',
    heroGradient: 'text-kk-accent',
    textAccent: 'text-kk-accent font-bold',
    textBrand: 'text-kk-brand font-bold',
    textGoldOnDark: 'text-kk-header-nav font-bold',
    textHeading: 'text-kk-heading font-black',
    textLabel: 'text-kk-ink font-semibold',
    textSubLabel: 'text-kk-muted font-normal',
    textMuted: 'text-kk-muted',
    textDate: 'text-kk-heading font-black',
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
