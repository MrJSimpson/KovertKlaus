'use client';

/**
 * @file page.tsx
 * @description `/announcements`: friendly release notes for Elf Agents and Head Elves.
 *
 * Tier 1 (what): Lists every release from `src/lib/announcements.ts`, newest first.
 * Tier 2 (why): People using the app need a plain-language "what changed for me" page; the
 * technical history stays in `CHANGELOG.md`.
 * Tier 3 (how): Static content, so it prerenders for the SaaS static export. Opening the page records
 * the newest version in browser storage, which clears the What's New dot (`WhatsNewLink`).
 */

import Link from 'next/link';
import { useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { ANNOUNCEMENTS, ANNOUNCEMENT_SEEN_KEY, LATEST_ANNOUNCEMENT_VERSION } from '@/lib/announcements';

/** `2026-10-15` → `October 15, 2026` (date-only, no time zone shift). */
function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export default function AnnouncementsPage() {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    try {
      window.localStorage.setItem(ANNOUNCEMENT_SEEN_KEY, LATEST_ANNOUNCEMENT_VERSION);
    } catch {
      // Storage unavailable: nothing to remember
    }
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${theme.pageBg}`}>
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md ${theme.headerBg}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-extrabold text-white text-lg shadow-md ${
              isDarkMode ? 'bg-gradient-to-br from-sky-400 to-slate-700' : 'bg-gradient-to-br from-red-600 to-emerald-800'
            }`}>
              🎁
            </div>
            <div>
              <span className="text-lg font-black tracking-tight block">KovertKlaus</span>
              <span className={`text-[10px] sm:text-xs font-bold ${theme.textBrand}`}>What&apos;s New</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-2 min-h-[44px] min-w-[44px] rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center ${theme.btnToggle}`}
              title={isDarkMode ? 'Switch to Klaus Mode' : 'Switch to Kovert Mode'}
            >
              {isDarkMode ? '🎅' : '🕶️'}
            </button>
            <Link href="/dashboard" className={`text-xs font-bold px-3 sm:px-4 py-2 min-h-[44px] flex items-center rounded-xl shadow-sm ${theme.btnNeutral}`}>
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
        <div>
          <h1 className={`text-3xl sm:text-4xl font-black ${theme.textHeading}`}>📣 What&apos;s New</h1>
          <p className={`mt-2 text-sm ${theme.textSubLabel}`}>Updates to KovertKlaus, newest first.</p>
        </div>

        {ANNOUNCEMENTS.map((a, i) => (
          <article key={a.version} className={`p-5 sm:p-7 rounded-3xl border shadow-md ${theme.cardBg}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${theme.badgeCode}`}>v{a.version}</span>
              <span className={`text-xs font-semibold ${theme.textSubLabel}`}>{formatDate(a.date)}</span>
              {i === 0 && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30">Latest</span>}
            </div>
            <h2 className={`mt-3 text-xl sm:text-2xl font-black ${theme.textHeading}`}>{a.title}</h2>
            <p className={`mt-2 text-sm ${theme.textSubLabel}`}>{a.summary}</p>
            <ul className="mt-5 space-y-3">
              {a.highlights.map((h) => (
                <li key={h.title} className={`p-3.5 rounded-2xl border text-sm ${theme.cardInnerBg}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span aria-hidden>{h.emoji}</span>
                    <span className={`font-bold ${theme.textLabel}`}>{h.title}</span>
                    {h.selfHostedOnly && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-slate-500/30 text-slate-500">Self-hosted</span>
                    )}
                  </div>
                  <p className={`mt-1 ${theme.textSubLabel}`}>{h.text}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </main>
    </div>
  );
}
