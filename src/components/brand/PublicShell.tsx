'use client';

/**
 * @file PublicShell.tsx
 * @description Header, footer and page frame for the public pages (features, policies, how-to guides).
 *
 * Tier 1 (what): `PublicShell` wraps a public page in the visual-refresh header (wordmark, a plain
 * link to the features page, the Klaus/Kovert toggle, Sign in) and footer (public links, version,
 * GitHub).
 * Tier 2 (why): The public pages each drew their own header; one shell gives them the new look at
 * once (2.0.0-beta) and one footer list, so every public page links to every other and search
 * engines can reach them all (owner decision 2026-11-10: how-to pages linked from the footer).
 * Tier 3 (how): Signed-out headers use plain links, not folder tabs (Design System `Header`). The
 * `kk-ui` class turns on the new link colours inside the shell only. Icons are inline stand-ins
 * drawn in Lucide's style (24px grid, 2px round strokes) until an icon library is added.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { APP_VERSION_LABEL } from '@/lib/version';
import { Wordmark } from './Wordmark';

/** Public pages linked from every footer. Add new public routes here (and to `SITEMAP_PATHS`). */
export const PUBLIC_FOOTER_LINKS: { href: string; label: string }[] = [
  { href: '/features', label: 'Features' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

const SOURCE_URL = 'https://github.com/MrJSimpson/KovertKlaus';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
    </svg>
  );
}

/** The signed-out header: wordmark home, features link, mode toggle, Sign in. */
export function PublicHeader() {
  const { isDarkMode, toggleTheme } = useTheme();
  return (
    <header className="kk-header kk-header--public">
      <Wordmark href="/" onHeader size="md" />
      <nav aria-label="Site" className="kk-header__nav items-center">
        <Link href="/features" className="kk-header__link hidden sm:inline-flex">
          Features
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDarkMode ? 'Switch to Klaus mode (light)' : 'Switch to Kovert mode (dark)'}
          title={isDarkMode ? 'Klaus mode' : 'Kovert mode'}
          className="kk-header__link inline-flex items-center justify-center min-h-11 min-w-11 cursor-pointer bg-transparent border-0"
        >
          {isDarkMode ? <SunIcon /> : <MoonIcon />}
        </button>
        <Link href="/signin" className="kk-btn kk-btn--sm kk-btn--ghost ml-1">
          Sign in
        </Link>
      </nav>
    </header>
  );
}

/** The public footer: links to every public page, the version, and the source code. */
export function PublicFooter() {
  return (
    <footer className="bg-kk-header text-kk-on-header pb-safe">
      <div className="mx-auto max-w-[1120px] px-4 md:px-6 py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm">
        <nav aria-label="Public pages" className="flex flex-wrap gap-x-5 gap-y-1">
          {PUBLIC_FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex items-center min-h-11 font-semibold text-kk-on-header hover:text-kk-on-header hover:underline underline-offset-4">
              {l.label}
            </Link>
          ))}
          <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-11 font-semibold text-kk-on-header hover:text-kk-on-header hover:underline underline-offset-4">
            GitHub
          </a>
        </nav>
        <p className="flex flex-wrap items-center gap-2 opacity-90">
          <span>© 2026 KovertKlaus by Joshua Simpson.</span>
          <span className="font-mono text-xs border border-current rounded-[var(--kk-radius-sm)] px-1.5 py-0.5">{APP_VERSION_LABEL}</span>
        </p>
      </div>
    </footer>
  );
}

/** A public page: header, `kk-ui` main area and footer on the season's page colour. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="kk-ui min-h-dvh flex flex-col bg-kk-page text-kk-ink font-body">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 kk-btn kk-btn--primary">
        Skip to content
      </a>
      <PublicHeader />
      <main id="main" className="flex-1 w-full mx-auto max-w-[1120px] px-4 md:px-6 py-8 md:py-12">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
