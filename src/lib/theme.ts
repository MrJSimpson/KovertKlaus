/**
 * KovertKlaus Centralized Theme Design System
 * Single source of truth for color tokens, card variants, buttons, badges, and alerts across Light & Dark (Icy) modes.
 */

export type ThemeClasses = ReturnType<typeof getThemeClasses>;

export function getThemeClasses(isDarkMode: boolean) {
  return {
    // Page & Structural Layout
    pageBg: isDarkMode
      ? 'bg-slate-950 text-slate-100 selection:bg-sky-400 selection:text-slate-950'
      : 'bg-stone-100 text-slate-900 selection:bg-red-700 selection:text-white',

    headerBg: isDarkMode
      ? 'bg-slate-950/90 border-slate-800/80 text-white backdrop-blur-md'
      : 'bg-emerald-950 border-emerald-900 text-white shadow-md',

    footerBg: isDarkMode
      ? 'bg-slate-950 border-slate-800 text-slate-400'
      : 'bg-emerald-950 border-emerald-900 text-emerald-200/80 shadow-inner',

    // Section Frames & Container Cards
    sectionFrame: isDarkMode
      ? 'bg-slate-900/90 border-2 border-slate-800 text-slate-100 shadow-2xl'
      : 'bg-white border-2 border-emerald-900/15 text-slate-900 shadow-md',

    cardBg: isDarkMode
      ? 'bg-slate-900/90 border-2 border-slate-800 text-slate-100 shadow-xl'
      : 'bg-white border-2 border-stone-200 text-slate-900 shadow-sm',

    cardInnerBg: isDarkMode
      ? 'bg-slate-950 border border-slate-800/80 text-slate-100'
      : 'bg-[#F0F0F0] border border-stone-300/70 text-slate-800',

    modalBg: isDarkMode
      ? 'bg-slate-900 border-2 border-slate-800 text-white shadow-2xl'
      : 'bg-white border-2 border-stone-300 text-slate-900 shadow-2xl',

    // OpsLeader Console Special Card Styling (Christmas Tree Light vs Winter Nights Dark)
    consoleCard: isDarkMode
      ? 'bg-slate-900/95 border-2 border-amber-500/40 text-slate-100 shadow-2xl shadow-sky-950/40'
      : 'bg-amber-500/10 border-2 border-amber-500/30 text-slate-900 shadow-md',

    consoleHeading: isDarkMode
      ? 'text-amber-300 font-black tracking-wider uppercase text-lg'
      : 'text-amber-950 font-black tracking-wider uppercase text-lg',

    consoleText: isDarkMode
      ? 'text-slate-300 text-xs mt-0.5'
      : 'text-slate-700 text-xs font-semibold mt-0.5',

    consoleBadge: isDarkMode
      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-mono font-bold px-3 py-1 rounded-full'
      : 'bg-amber-200 text-amber-950 border border-amber-400 font-mono font-bold px-3 py-1 rounded-full shadow-sm',

    // Buttons
    btnPrimary: isDarkMode
      ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-lg shadow-sky-950/60 font-black transition-all'
      : 'bg-red-700 hover:bg-red-800 text-white shadow-md font-black transition-all',

    btnSecondary: isDarkMode
      ? 'bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-md transition-all'
      : 'bg-stone-200 border border-stone-300 text-slate-900 hover:bg-stone-300 font-bold px-4 py-2.5 rounded-xl shadow-md transition-all',

    btnToggle: isDarkMode
      ? 'bg-slate-900 border border-slate-700 text-sky-300 hover:bg-slate-800 font-semibold transition-all'
      : 'bg-emerald-900 border border-emerald-700 text-amber-300 hover:bg-emerald-850 font-semibold transition-all',

    btnNeutral: isDarkMode
      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold transition-all'
      : 'bg-stone-100 text-slate-700 hover:bg-stone-200 font-semibold transition-all',

    btnEmerald: isDarkMode
      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-950/50 transition-all'
      : 'bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition-all',

    btnAmber: isDarkMode
      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-amber-950/50 transition-all'
      : 'bg-red-700 hover:bg-red-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition-all',

    btnSky: isDarkMode
      ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-sky-950/50 transition-all'
      : 'bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition-all',

    btnPurple: isDarkMode
      ? 'bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-purple-950/50 transition-all'
      : 'bg-purple-800 hover:bg-purple-900 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition-all',

    // Input Controls
    inputBg: isDarkMode
      ? 'bg-slate-950 border-slate-800 text-slate-100 focus:ring-sky-400 font-medium'
      : 'bg-white border-stone-300 text-slate-900 focus:ring-emerald-700 font-medium',

    inputModalBg: isDarkMode
      ? 'bg-slate-950 border-slate-800 text-white focus:ring-sky-400 font-medium'
      : 'bg-stone-50 border-stone-300 text-slate-900 focus:ring-emerald-700 font-medium',

    inputDisabled: isDarkMode
      ? 'bg-slate-950 border-slate-800 text-slate-300 font-mono font-bold cursor-not-allowed opacity-100'
      : 'bg-stone-200/90 border-stone-300 text-slate-900 font-mono font-bold cursor-not-allowed opacity-100',

    // Tab Navigation Bar Tokens
    tabBarBg: isDarkMode
      ? 'bg-slate-950/80 border-slate-800 text-slate-300'
      : 'bg-stone-100 border-stone-200 text-slate-700',

    tabActive: isDarkMode
      ? 'border-b-2 border-sky-400 text-sky-300 font-extrabold bg-slate-900/60'
      : 'border-b-2 border-red-700 text-red-700 font-extrabold bg-white shadow-sm',

    tabInactive: isDarkMode
      ? 'border-b-2 border-transparent text-slate-400 hover:text-white font-bold'
      : 'border-b-2 border-transparent text-slate-600 hover:text-slate-900 font-bold',

    // Badges & Status Pills
    badgeCode: isDarkMode
      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono font-bold'
      : 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-mono font-bold',

    badgeSecretSanta: isDarkMode
      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold'
      : 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold',

    badgeWhiteElephant: isDarkMode
      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold'
      : 'bg-purple-100 text-purple-950 border border-purple-300 font-bold',

    badgeAmber: isDarkMode
      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
      : 'bg-amber-100 text-amber-950 border border-amber-300 font-bold',

    badgeRose: isDarkMode
      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
      : 'bg-rose-100 text-rose-950 border border-rose-300 font-bold',

    // Themed Countdown Badges & Milestone Containers
    badgeCountdown: isDarkMode
      ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40 font-mono font-bold shadow-sm'
      : 'bg-red-50 text-red-700 border border-red-200 font-mono font-bold shadow-sm',

    badgeCountdownUrgent: isDarkMode
      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold shadow-sm'
      : 'bg-amber-50 text-amber-900 border border-amber-300 font-mono font-bold shadow-sm',

    badgeCountdownToday: isDarkMode
      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold shadow-sm animate-pulse'
      : 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-mono font-bold shadow-sm animate-pulse',

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
    headerNav: isDarkMode ? 'text-slate-300 hover:text-sky-400 font-semibold' : 'text-emerald-100 hover:text-amber-300 font-semibold',
    heroSubtext: isDarkMode ? 'text-slate-300 font-medium' : 'text-slate-700 font-medium',
    heroGradient: isDarkMode
      ? 'bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-100 bg-clip-text text-transparent'
      : 'bg-gradient-to-r from-red-600 via-red-700 to-rose-700 bg-clip-text text-transparent',
    textAccent: isDarkMode ? 'text-sky-400 font-bold' : 'text-red-700 font-bold',
    textBrand: isDarkMode ? 'text-sky-300 font-bold' : 'text-emerald-800 font-bold',
    textGoldOnDark: 'text-amber-300 font-bold',
    textHeading: isDarkMode ? 'text-white font-black' : 'text-slate-900 font-black',
    textLabel: isDarkMode ? 'text-slate-200 font-semibold' : 'text-slate-700 font-semibold',
    textSubLabel: isDarkMode ? 'text-slate-400 font-normal' : 'text-slate-600 font-normal',
    textMuted: isDarkMode ? 'text-slate-400' : 'text-slate-700',
    textDate: isDarkMode ? 'text-sky-300 font-black' : 'text-slate-950 font-black',
  };
}
