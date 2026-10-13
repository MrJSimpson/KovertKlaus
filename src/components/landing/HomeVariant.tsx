'use client';

/**
 * @file HomeVariant.tsx
 * @description Renders the landing page variant chosen in North Pole config, live.
 *
 * Tier 1 (what): Starts with the variant resolved on the server (or at static-export build time)
 * and switches to the live `altHome` setting once `/api/config` has loaded.
 * Tier 2 (why): The SaaS edition is a static export, so the server-side choice is frozen at build
 * time. Without this, changing "Alt Home" in North Pole had no effect until the next deploy.
 * Tier 3 (how): Reads `systemConfig.altHome` / `edition` from `ThemeContext` (fetched on every page).
 * `locked` keeps the initial variant when an ALT_HOME environment override is set.
 * Signed-in operatives always get the app home (they are already cleared).
 */
import { useMemo, useSyncExternalStore } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { AppHomeLanding } from './AppHomeLanding';
import { ComingSoonLanding } from './ComingSoonLanding';
import { resolveHomeVariant, type HomeVariantKey } from '@/lib/config/homeVariant';
import { USER_ID_KEY } from '@/lib/constants/auth';

/** Subscribes to cross-tab localStorage changes. */
function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/** True when an operative session marker is stored. Storage may be blocked (privacy mode). */
function readSignedIn(): boolean {
  try {
    return Boolean(localStorage.getItem(USER_ID_KEY));
  } catch {
    return false;
  }
}

export default function HomeVariant({ initialKey, locked = false }: { initialKey: HomeVariantKey; locked?: boolean }) {
  const { systemConfig } = useTheme();
  const liveLoaded = systemConfig.altHome !== undefined && systemConfig.edition !== undefined;
  // A signed-in operative (approved during pre-launch) gets the app, not the waitlist page.
  // useSyncExternalStore reads localStorage on the client only (server/static render: signed out)
  // and follows sign-in/out from other tabs via the storage event.
  const signedIn = useSyncExternalStore(subscribeToStorage, readSignedIn, () => false);

  const variant = useMemo<HomeVariantKey>(() => {
    if (locked) return initialKey;
    if (signedIn) return 'app_home';
    if (!liveLoaded) return initialKey;
    return resolveHomeVariant(systemConfig.altHome, systemConfig.edition === 'saas');
  }, [locked, signedIn, liveLoaded, initialKey, systemConfig.altHome, systemConfig.edition]);

  return variant === 'coming_soon' ? <ComingSoonLanding /> : <AppHomeLanding />;
}
