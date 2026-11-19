'use client';

/**
 * @file AppShell.tsx
 * @description The signed-in frame: header with Missions / Alerts / Profile, and the phone tab bar.
 *
 * Tier 1 (what): Desktop (768px and up): wordmark, the three destinations as folder tabs, What's New,
 * Sign out and the mode toggle. Phones: wordmark, Sign out and toggle on top, a fixed bottom tab bar
 * with the same three destinations (Design System `Header` and `BottomTabBar`).
 * Tier 2 (why): Visual refresh (2.0.0-beta, owner decisions 2026-10-31: no Wishlists destination,
 * bottom tab bar on phones, folder tabs on desktop). Alerts and Profile get their own pages in later
 * refresh PRs; until then Alerts opens the notification panel and Profile opens Account Preferences.
 * Tier 3 (how): Exactly one `NotificationBell` is mounted (tab or tab bar, by viewport), so the
 * alert list loads once. The tab bar is `position: fixed`; the page reserves `--kk-tabbar-h` plus
 * the safe area below its content, and nothing else sits on the bottom edge.
 */

import Link from 'next/link';
import { useSyncExternalStore, type ReactNode } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { NotificationBell, type PinnedNotice } from '@/components/NotificationBell';
import { WhatsNewButton } from '@/components/WhatsNewButton';
import type { NotificationView } from '@/lib/notifications';
import { Icon } from './Icon';
import { Wordmark } from './Wordmark';

export type AppSection = 'missions' | 'alerts' | 'profile';

export interface AppShellProps {
  active: AppSection;
  children: ReactNode;
  /** Opens the profile (Account Preferences until the Profile page exists). */
  onProfile: () => void;
  onSignOut: () => void;
  alerts?: {
    pinned?: PinnedNotice[];
    actionsFor?: (n: NotificationView, dismiss: () => void) => ReactNode;
    reloadKey?: number;
  };
}

const DESKTOP = '(min-width: 768px)';

function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** Whether the desktop header (not the phone tab bar) is showing. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => true);
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

export function AppShell({ active, children, onProfile, onSignOut, alerts }: AppShellProps) {
  const desktop = useIsDesktop();
  const bell = (variant: 'tab' | 'tabbar') => (
    <NotificationBell variant={variant} pinned={alerts?.pinned} actionsFor={alerts?.actionsFor} reloadKey={alerts?.reloadKey} />
  );

  return (
    <div className="kk-ui min-h-dvh flex flex-col bg-kk-page text-kk-ink font-body text-[15px] leading-6">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 kk-btn kk-btn--primary">
        Skip to content
      </a>
      <header className="kk-header kk-header--app">
        <Wordmark href="/dashboard" onHeader size="md" />
        {desktop && (
          <nav aria-label="Main" className="kk-header__nav kk-header__nav--tabs">
            <Link href="/dashboard" className="kk-header__link" aria-current={active === 'missions' ? 'page' : undefined}>
              Missions
            </Link>
            {bell('tab')}
            <button type="button" onClick={onProfile} className="kk-header__link cursor-pointer" aria-current={active === 'profile' ? 'page' : undefined}>
              Profile
            </button>
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
          {bell('tabbar')}
          <button type="button" onClick={onProfile} className="kk-tabbar__item cursor-pointer" aria-current={active === 'profile' ? 'page' : undefined}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
            Profile
          </button>
        </nav>
      )}
    </div>
  );
}
