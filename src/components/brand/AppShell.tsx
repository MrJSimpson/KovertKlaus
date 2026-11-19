'use client';

/**
 * @file AppShell.tsx
 * @description The signed-in frame: header with Missions / Alerts / Profile, and the phone tab bar.
 *
 * Tier 1 (what): Desktop (768px and up): wordmark, the three destinations as folder tabs, What's New,
 * Sign out and the mode toggle. Phones: wordmark, Sign out and toggle on top, a fixed bottom tab bar
 * with the same three destinations (Design System `Header` and `BottomTabBar`).
 * Tier 2 (why): Visual refresh (2.0.0-beta, owner decisions 2026-10-31: no Wishlists destination,
 * bottom tab bar on phones, folder tabs on desktop). Alerts (`/alerts`) and Profile (`/profile`) are
 * their own pages.
 * Tier 3 (how): The Alerts tab shows the open count from `GET /api/notifications?summary=1`, on every
 * page with header tabs (owner decision 2026-11-19: no separate dashboard Alerts card). The Alerts
 * page fires `ALERTS_CHANGED_EVENT` after removing alerts so the badge updates without a reload. The
 * tab bar is `position: fixed`; the page reserves `--kk-tabbar-h` plus the safe area below its
 * content, and nothing else sits on the bottom edge.
 */

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { WhatsNewButton } from '@/components/WhatsNewButton';
import { Icon } from './Icon';
import { Wordmark } from './Wordmark';

export type AppSection = 'missions' | 'alerts' | 'profile';

export interface AppShellProps {
  active: AppSection;
  children: ReactNode;
  onSignOut: () => void;
  /**
   * An open mission: a folder tab with its code appears after Missions and is the current tab, as if
   * the mission's folder were pulled out (owner review 2026-11-19). Missions stays a link back.
   */
  openFile?: { label: string; title?: string };
}

/** Fired on `window` after alerts change on this page, so the Alerts badge reloads. */
export const ALERTS_CHANGED_EVENT = 'kk:alerts-changed';

/** Open alerts (pinned included) for the badge; reloads on `ALERTS_CHANGED_EVENT`. */
function useAlertCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch('/api/notifications?summary=1')
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (!cancelled && json) setCount((json.total ?? 0) + (json.pinnedCount ?? 0));
        })
        .catch(() => {});
    load();
    window.addEventListener(ALERTS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(ALERTS_CHANGED_EVENT, load);
    };
  }, []);
  return count;
}

const TABLET = '(min-width: 768px)';
const WIDE = '(min-width: 1024px)';

function subscribeViewport(cb: () => void) {
  const queries = [window.matchMedia(TABLET), window.matchMedia(WIDE)];
  queries.forEach((q) => q.addEventListener('change', cb));
  return () => queries.forEach((q) => q.removeEventListener('change', cb));
}

export type LayoutMode = 'phone' | 'tablet' | 'wide';

/** Phone (< 768px: tab bar), tablet (768–1023px: header tabs), wide (1024px+: room for a sidebar). */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(
    subscribeViewport,
    () => (window.matchMedia(WIDE).matches ? 'wide' : window.matchMedia(TABLET).matches ? 'tablet' : 'phone'),
    () => 'wide',
  );
}

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

export function AppShell({ active, children, onSignOut, openFile }: AppShellProps) {
  const mode = useLayoutMode();
  const desktop = mode !== 'phone';
  const alertCount = useAlertCount();
  const alertBadge = alertCount > 9 ? '9+' : String(alertCount);
  const alertsLabel = alertCount ? `Alerts (${alertCount})` : 'Alerts';

  return (
    <div className="kk-ui min-h-dvh flex flex-col bg-kk-page text-kk-ink font-body text-[15px] leading-6">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 kk-btn kk-btn--primary">
        Skip to content
      </a>
      <header className="kk-header kk-header--app">
        <Wordmark href="/dashboard" onHeader size="md" />
        {desktop && (
          <nav aria-label="Main" className="kk-header__nav kk-header__nav--tabs">
            <Link href="/dashboard" className="kk-header__link" aria-current={active === 'missions' && !openFile ? 'page' : undefined}>
              Missions
            </Link>
            {openFile && (
              <span className="kk-header__link kk-header__link--file" aria-current="page" title={openFile.title}>
                <Icon name="folder" size={16} />
                {openFile.label}
              </span>
            )}
            <Link href="/alerts" className="kk-header__link" aria-current={active === 'alerts' ? 'page' : undefined} aria-label={alertsLabel}>
              Alerts
              {alertCount > 0 && (
                <span className="kk-tab-badge" aria-hidden="true">
                  {alertBadge}
                </span>
              )}
            </Link>
            <Link href="/profile" className="kk-header__link" aria-current={active === 'profile' ? 'page' : undefined}>
              Profile
            </Link>
          </nav>
        )}
        <div className="flex items-center gap-1">
          {desktop && <WhatsNewButton compact className="kk-header__link" />}
          <button type="button" onClick={onSignOut} className="kk-header__link cursor-pointer bg-transparent border-0">
            Sign out
          </button>
          <ModeToggle />
        </div>
      </header>

      <div id="main" className="flex-1 w-full pb-[calc(var(--kk-tabbar-h)+env(safe-area-inset-bottom)+16px)] md:pb-0">
        {children}
      </div>

      {!desktop && (
        <nav aria-label="Main" className="kk-tabbar fixed inset-x-0 bottom-0 z-40">
          <Link href="/dashboard" className="kk-tabbar__item" aria-current={active === 'missions' ? 'page' : undefined}>
            <Icon name="folder" size={22} />
            Missions
          </Link>
          <Link href="/alerts" className="kk-tabbar__item" aria-current={active === 'alerts' ? 'page' : undefined} aria-label={alertsLabel}>
            <Icon name="bell" size={22} />
            Alerts
            {alertCount > 0 && (
              <span className="kk-tabbar__badge" aria-hidden="true">
                {alertBadge}
              </span>
            )}
          </Link>
          <Link href="/profile" className="kk-tabbar__item" aria-current={active === 'profile' ? 'page' : undefined}>
            <Icon name="user" size={22} />
            Profile
          </Link>
        </nav>
      )}
    </div>
  );
}
