'use client';

/**
 * @file page.tsx (/features)
 * @description Features & Specs: what KovertKlaus does, in plain language.
 *
 * Tier 1 (what): Renders `FEATURE_GROUPS` and `LICENSE_SUMMARY` from `src/lib/features.ts`.
 * Tier 2 (why): The old page quoted a license date that does not exist and missed most features
 * shipped since alpha (owner request 2026-10-31).
 * Tier 3 (how): The copy lives in `src/lib/features.ts`; its numbers are checked against the code by
 * `features.test.ts`. The header matches the other public pages until the visual refresh.
 */

import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { FEATURE_GROUPS, LICENSE_SUMMARY } from '@/lib/features';

export default function FeaturesPage() {
  const { isDarkMode, toggleTheme, theme } = useTheme();

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme.pageBg}`}>
      
      {/* Header Bar */}
      <header className={`border-b transition-colors ${theme.headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-5 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-extrabold text-xl shadow-md bg-kk-primary text-kk-on-primary border border-kk-border-strong">
              🎁
            </div>
            <div className="min-w-0">
              <span className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 text-kk-on-header">
                KOVERT KLAUS
              </span>
              <span className={`text-xs block font-bold ${theme.textGoldOnDark}`}>Features & Specs</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              onClick={toggleTheme}
              title="Toggle Theme Mode"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`min-h-11 min-w-11 p-2 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${theme.btnToggle}`}
            >
              <span aria-hidden>{isDarkMode ? '🎅' : '🕶️'}</span>
              <span className="hidden sm:inline">{isDarkMode ? 'Klaus Mode' : 'Kovert Mode'}</span>
            </button>

            <Link
              href="/"
              className={`min-h-11 flex items-center whitespace-nowrap text-xs font-bold px-3 sm:px-4 py-2 rounded-xl transition-colors ${theme.btnPrimary}`}
            >
              ← Home
            </Link>
          </div>
        </div>
      </header>


      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-16">

        {/* Page Hero */}
        <div className="max-w-3xl mb-10 sm:mb-14">
          <span className="text-xs font-mono font-bold uppercase tracking-widest block mb-2 text-kk-accent">
            FEATURES &amp; SPECS
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-kk-heading">
            How KovertKlaus runs your Secret Santa
          </h1>
          <p className="mt-4 text-lg text-kk-muted">
            A fair draw, names that stay secret, wishlists that ship, and the tools a Head Elf needs from the first invite to the last thank-you.
          </p>
        </div>

        {/* Feature Groups */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {FEATURE_GROUPS.map((group) => (
            <section
              key={group.id}
              id={group.id}
              aria-labelledby={`${group.id}-h`}
              className="p-6 sm:p-8 rounded-2xl border bg-kk-surface border-kk-border shadow-md"
            >
              <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl mb-5 bg-kk-inset border border-kk-border" aria-hidden>
                {group.icon}
              </div>
              <h2 id={`${group.id}-h`} className="text-2xl font-bold mb-2 text-kk-heading">
                {group.heading}
              </h2>
              <p className="text-sm leading-relaxed mb-4 text-kk-ink">{group.lead}</p>
              <ul className="text-sm space-y-2 text-kk-muted list-disc pl-5 leading-relaxed">
                {group.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* License */}
        <div className="mt-10 sm:mt-16 p-6 sm:p-8 rounded-2xl border-2 bg-kk-surface border-kk-border-strong">
          <span className="text-xs font-mono font-bold uppercase tracking-widest block mb-1 text-kk-accent">
            {LICENSE_SUMMARY.label}
          </span>
          <h2 className="text-xl font-bold text-kk-heading">{LICENSE_SUMMARY.heading}</h2>
          <p className="text-sm mt-2 max-w-3xl text-kk-muted leading-relaxed">{LICENSE_SUMMARY.text}</p>
          <a href={LICENSE_SUMMARY.licenseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-11 mt-2 text-sm font-semibold text-kk-accent underline underline-offset-2">
            Read the full license
          </a>
        </div>

        <p className="mt-8 text-sm text-kk-muted">
          What happens to your information: <Link href="/privacy" className="text-kk-accent underline underline-offset-2">Privacy Policy</Link>
          {' · '}
          The rules: <Link href="/terms" className="text-kk-accent underline underline-offset-2">Terms of Service</Link>
        </p>

      </main>

    </div>
  );
}
