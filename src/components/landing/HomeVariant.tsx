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
 */
import { useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { AppHomeLanding } from './AppHomeLanding';
import { ComingSoonLanding } from './ComingSoonLanding';
import { resolveHomeVariant, type HomeVariantKey } from '@/lib/config/homeVariant';

export default function HomeVariant({ initialKey, locked = false }: { initialKey: HomeVariantKey; locked?: boolean }) {
  const { systemConfig } = useTheme();
  const liveLoaded = systemConfig.altHome !== undefined && systemConfig.edition !== undefined;

  const variant = useMemo<HomeVariantKey>(() => {
    if (locked || !liveLoaded) return initialKey;
    return resolveHomeVariant(systemConfig.altHome, systemConfig.edition === 'saas');
  }, [locked, liveLoaded, initialKey, systemConfig.altHome, systemConfig.edition]);

  return variant === 'coming_soon' ? <ComingSoonLanding /> : <AppHomeLanding />;
}
