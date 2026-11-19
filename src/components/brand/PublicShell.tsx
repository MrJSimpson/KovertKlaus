'use client';

/**
 * @file PublicShell.tsx
 * @description Header, decor band, footer and page frame for the public pages.
 *
 * Tier 1 (what): `PublicShell` wraps Home, Sign in, Create account, Features, the policies and the
 * how-to guides. Header: wordmark home, "How it works", "Join with a code", "Sign in" (desktop) and
 * the Klaus/Kovert toggle. Footer: public links, version, source code.
 * Tier 2 (why): One shell gives every public page the visual refresh header (2.0.0-beta) and one
 * footer list, so every public page links to every other and search engines can reach them all
 * (owner decision 2026-11-10: how-to pages linked from the footer).
 * Tier 3 (how): Signed-out headers use plain links, not folder tabs (Design System `Header`). On
 * phones the header keeps the wordmark, a Sign in link and the toggle (the phone mockup had no way
 * back in for returning agents). `kk-ui` turns on the new link colours inside the shell only.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { APP_VERSION_LABEL } from '@/lib/version';
import { Icon } from './Icon';
import { JoinCodeButton } from './JoinCodeDialog';
import { Wordmark } from './Wordmark';

/** Public pages linked from every footer. Add new public routes here (and to `SITEMAP_PATHS`). */
export const PUBLIC_FOOTER_LINKS: { href: string; label: string }[] = [
  { href: '/features', label: 'Features' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

const SOURCE_URL = 'https://github.com/MrJSimpson/KovertKlaus';

/** The Klaus (light) / Kovert (dark) toggle, outlined on the header. */
function ModeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDarkMode ? 'Switch to Klaus mode (light)' : 'Switch to Kovert mode (dark)'}
      title={isDarkMode ? 'Klaus mode' : 'Kovert mode'}
      className="kk-mode-toggle"
    >
      <Icon name={isDarkMode ? 'sun' : 'moon'} />
    </button>
  );
}

/** The signed-out header. `active` marks the current page's link (`aria-current`). */
export function PublicHeader({ active }: { active?: 'signin' }) {
  return (
    <header className="kk-header kk-header--public">
      <Wordmark href="/" onHeader size="md" />
      <nav aria-label="Main" className="kk-header__nav items-center">
        <Link href="/#how-it-works" className="kk-header__link hidden md:inline-flex">
          How it works
        </Link>
        <JoinCodeButton className="kk-header__link hidden md:inline-flex cursor-pointer bg-transparent border-0 font-[inherit]">Join with a code</JoinCodeButton>
        <Link href="/signin" className="kk-header__link inline-flex" aria-current={active === 'signin' ? 'page' : undefined}>
          Sign in
        </Link>
        <ModeToggle />
      </nav>
    </header>
  );
}

/** The public footer: links to every public page, the version, and the source code. */
export function PublicFooter() {
  const link = 'inline-flex items-center min-h-11 font-semibold text-kk-on-header hover:text-kk-on-header hover:underline underline-offset-4';
  return (
    <footer className="bg-kk-header text-kk-on-header pb-safe">
      <div className="mx-auto max-w-[1200px] px-4 md:px-8 py-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <span>© 2026 KovertKlaus by Joshua Simpson</span>
          <span className="font-mono text-xs border border-current rounded-[var(--kk-radius-sm)] px-1.5 py-0.5">{APP_VERSION_LABEL}</span>
        </p>
        <nav aria-label="Public pages" className="flex flex-wrap gap-x-5 gap-y-0">
          {PUBLIC_FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={link}>
              {l.label}
            </Link>
          ))}
          <a href={SOURCE_URL} target="_blank" rel="noreferrer" className={link}>
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}

/**
 * A public page: header, seasonal decor band, `kk-ui` main area and footer on the season's page colour.
 *
 * @param bare - The page lays out its own `<main>` width (Home, Sign in); otherwise a 1120px column.
 * @param banner - Optional announcement from the North Pole, shown under the decor band.
 */
export function PublicShell({ children, bare = false, active, banner }: { children: ReactNode; bare?: boolean; active?: 'signin'; banner?: string | null }) {
  return (
    <div className="kk-ui min-h-dvh flex flex-col bg-kk-page text-kk-ink font-body text-[15px] leading-6">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 kk-btn kk-btn--primary">
        Skip to content
      </a>
      <PublicHeader active={active} />
      <div className="kk-decor kk-decor--band" role="presentation" />
      {banner && (
        <p role="status" className="m-0 px-4 py-2 text-center text-sm font-semibold bg-kk-warning text-kk-on-warning border-b border-kk-border">
          {banner}
        </p>
      )}
      {bare ? (
        <div id="main" className="flex-1 w-full">
          {children}
        </div>
      ) : (
        <main id="main" className="flex-1 w-full mx-auto max-w-[1120px] px-4 md:px-6 py-8 md:py-12">
          {children}
        </main>
      )}
      <PublicFooter />
    </div>
  );
}
