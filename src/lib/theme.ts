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
      ? 'bg-slate-950/90 border-slate-800 text-white'
      : 'bg-white/90 border-stone-200 shadow-sm text-slate-900',

    footerBg: isDarkMode
      ? 'bg-slate-950 border-slate-800 text-slate-400'
      : 'bg-white border-stone-200 text-slate-600 shadow-inner',

    // Cards & Containers
    cardBg: isDarkMode
      ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl'
      : 'bg-white border-stone-200 text-slate-900 shadow-md',

    cardInnerBg: isDarkMode
      ? 'bg-slate-950 border-slate-800 text-slate-100'
      : 'bg-stone-50 border-stone-200 text-slate-900',

    modalBg: isDarkMode
      ? 'bg-slate-900 border-slate-800 text-white shadow-2xl'
      : 'bg-white border-stone-200 text-slate-900 shadow-2xl',

    // OpsLeader Console Special Card Styling (High Contrast, No Clashing Text)
    consoleCard: isDarkMode
      ? 'bg-slate-900/90 border-2 border-amber-500/40 text-slate-100 shadow-xl'
      : 'bg-amber-500/10 border-2 border-amber-500/30 text-slate-900 shadow-md',

    consoleHeading: isDarkMode
      ? 'text-amber-300 font-black tracking-wider uppercase'
      : 'text-amber-900 font-black tracking-wider uppercase',

    consoleText: isDarkMode
      ? 'text-slate-300 text-xs'
      : 'text-slate-700 text-xs font-medium',

    consoleBadge: isDarkMode
      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold'
      : 'bg-amber-200 text-amber-950 border border-amber-300 font-mono font-bold',

    // Buttons
    btnPrimary: isDarkMode
      ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-950/60 font-bold'
      : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30 font-bold',

    btnSecondary: isDarkMode
      ? 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700 font-bold'
      : 'bg-stone-200 text-slate-900 hover:bg-stone-300 font-bold',

    btnToggle: isDarkMode
      ? 'bg-slate-900 border-slate-700 text-sky-300 hover:bg-slate-800 font-semibold'
      : 'bg-stone-100 border-stone-300 text-slate-700 hover:bg-stone-200 font-semibold',

    btnNeutral: isDarkMode
      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold'
      : 'bg-stone-100 text-slate-700 hover:bg-stone-200 font-semibold',

    btnEmerald: isDarkMode
      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md'
      : 'bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-md',

    btnAmber: isDarkMode
      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md'
      : 'bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md',

    // Input Controls
    inputBg: isDarkMode
      ? 'bg-slate-950 border-slate-800 text-slate-100 focus:ring-sky-400 font-medium'
      : 'bg-stone-50 border-stone-300 text-slate-900 focus:ring-red-600 font-medium',

    inputModalBg: isDarkMode
      ? 'bg-slate-950 border-slate-800 text-white focus:ring-sky-400 font-medium'
      : 'bg-stone-50 border-stone-300 text-slate-900 focus:ring-red-600 font-medium',

    // Badges & Status Pills
    badgeCode: isDarkMode
      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono font-bold'
      : 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-bold',

    badgeSecretSanta: isDarkMode
      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold'
      : 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold',

    badgeWhiteElephant: isDarkMode
      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold'
      : 'bg-purple-100 text-purple-900 border border-purple-300 font-bold',

    badgeAmber: isDarkMode
      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
      : 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',

    // Alerts & Notifications
    alertError: isDarkMode
      ? 'bg-red-950/80 border-2 border-red-800 text-red-200'
      : 'bg-red-50 border-2 border-red-300 text-red-900',

    alertWarning: isDarkMode
      ? 'bg-amber-950/80 border-2 border-amber-800 text-amber-200'
      : 'bg-amber-50 border-2 border-amber-300 text-amber-900',

    alertSuccess: isDarkMode
      ? 'bg-emerald-950/80 border-2 border-emerald-800 text-emerald-200'
      : 'bg-emerald-50 border-2 border-emerald-300 text-emerald-900',

    // Text Color Utilities
    textAccent: isDarkMode ? 'text-sky-400 font-bold' : 'text-red-600 font-bold',
    textBrand: isDarkMode ? 'text-sky-400 font-bold' : 'text-emerald-800 font-bold',
    textHeading: isDarkMode ? 'text-white font-black' : 'text-slate-900 font-black',
    textMuted: isDarkMode ? 'text-slate-400' : 'text-slate-600',
    textDate: isDarkMode ? 'text-sky-300 font-black' : 'text-slate-950 font-black',
  };
}
