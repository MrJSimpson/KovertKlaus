/**
 * KovertKlaus Centralized Theme Design System
 * Single source of truth for color tokens, card variants, buttons, badges, and alerts across Light & Dark (Icy) modes.
 */

export function getThemeClasses(isDarkMode: boolean) {
  return {
    // Page & Structural Layout
    pageBg: isDarkMode
      ? 'bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950'
      : 'bg-stone-50 text-slate-900 selection:bg-red-600 selection:text-white',

    headerBg: isDarkMode
      ? 'bg-slate-950/90 border-slate-800'
      : 'bg-white/90 border-stone-200 shadow-sm',

    footerBg: isDarkMode
      ? 'bg-slate-950 border-slate-800 text-slate-500'
      : 'bg-white border-stone-200 text-slate-500 shadow-inner',

    // Cards & Containers
    cardBg: isDarkMode
      ? 'bg-slate-900 border-slate-800'
      : 'bg-white border-stone-200',

    cardInnerBg: isDarkMode
      ? 'bg-slate-950 border-slate-800'
      : 'bg-stone-50 border-stone-200',

    modalBg: isDarkMode
      ? 'bg-slate-900 border-slate-800 text-white'
      : 'bg-white border-stone-200 text-slate-900',

    // Buttons
    btnPrimary: isDarkMode
      ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-950/60'
      : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30',

    btnSecondary: isDarkMode
      ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white shadow-md'
      : 'bg-emerald-800 text-white border-emerald-900 hover:bg-emerald-900 shadow-md',

    btnToggle: isDarkMode
      ? 'bg-slate-900 border-slate-700 text-sky-300 hover:bg-slate-800'
      : 'bg-stone-100 border-stone-300 text-slate-700 hover:bg-stone-200',

    btnNeutral: isDarkMode
      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
      : 'bg-stone-100 text-slate-700 hover:bg-stone-200',

    btnEmerald: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md',
    btnAmber: 'bg-amber-600 hover:bg-amber-700 text-white shadow-md',

    // Input Controls
    inputBg: isDarkMode
      ? 'bg-slate-950 border-slate-800 text-slate-100 focus:ring-sky-400'
      : 'bg-stone-50 border-stone-300 text-slate-900 focus:ring-red-600',

    inputModalBg: isDarkMode
      ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400'
      : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600',

    // Badges & Status Pills
    badgeCode: isDarkMode
      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
      : 'bg-emerald-100 text-emerald-900',

    badgeSecretSanta: isDarkMode
      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
      : 'bg-emerald-100 text-emerald-900',

    badgeWhiteElephant: isDarkMode
      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
      : 'bg-purple-100 text-purple-900',

    badgeAmber: isDarkMode
      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
      : 'bg-amber-100 text-amber-900',

    // Alerts & Notifications
    alertError: isDarkMode
      ? 'bg-red-950/60 border-red-800 text-red-300'
      : 'bg-red-100 border-red-300 text-red-700',

    alertWarning: isDarkMode
      ? 'bg-amber-950/60 border-amber-800 text-amber-300'
      : 'bg-amber-100 border-amber-300 text-amber-900',

    alertSuccess: isDarkMode
      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
      : 'bg-emerald-100 border-emerald-300 text-emerald-800',

    // Text Color Utilities
    textAccent: isDarkMode ? 'text-sky-400' : 'text-red-600',
    textBrand: isDarkMode ? 'text-sky-400' : 'text-emerald-800',
    textHeading: isDarkMode ? 'text-white' : 'text-slate-900',
    textMuted: isDarkMode ? 'text-slate-400' : 'text-slate-500',
    textDate: isDarkMode ? 'text-sky-300' : 'text-slate-950',
  };
}
