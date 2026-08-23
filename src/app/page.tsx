import React from 'react';
import { AppHomeLanding, ComingSoonLanding } from '@/components/landing';
import { db } from '@/lib/db';
import { IS_SAAS } from '@/lib/config/mode';

export const dynamic = 'force-dynamic';

/**
 * Registry mapping ALT_HOME values to landing page components.
 */
const ALT_HOME_REGISTRY: Record<string, React.ComponentType> = {
  coming_soon: ComingSoonLanding,
  comingsoon: ComingSoonLanding,
  'coming-soon': ComingSoonLanding,
  comingsoonlanding: ComingSoonLanding,
  app_home: AppHomeLanding,
  apphome: AppHomeLanding,
  default: AppHomeLanding,
};

/**
 * Dynamic Start Page Controller
 * 
 * 1. Checks `process.env.ALT_HOME` or `process.env.NEXT_PUBLIC_ALT_HOME` if explicitly set.
 * 2. Otherwise queries `db.systemConfig.findFirst()` to check `altHome` setting saved by Admin.
 * 3. Default fallback:
 *    - In commercial SaaS mode (`IS_SAAS`), defaults to `coming_soon` pre-launch landing.
 *    - In self-hosted mode, defaults to `AppHomeLanding`.
 */
export default async function Page() {
  let resolvedAltHome = '';

  const rawEnvAltHome = process.env.ALT_HOME || process.env.NEXT_PUBLIC_ALT_HOME;
  if (rawEnvAltHome !== undefined && rawEnvAltHome !== '') {
    resolvedAltHome = rawEnvAltHome.trim().toLowerCase();
  } else {
    try {
      const config = await db.systemConfig.findFirst();
      if (config && config.altHome) {
        resolvedAltHome = config.altHome.trim().toLowerCase();
      }
    } catch {
      // Fall back if database is initializing
    }
  }

  // If still empty, apply mode-appropriate default
  if (!resolvedAltHome) {
    resolvedAltHome = IS_SAAS ? 'coming_soon' : 'app_home';
  }

  if (resolvedAltHome && ALT_HOME_REGISTRY[resolvedAltHome]) {
    const AltLandingPage = ALT_HOME_REGISTRY[resolvedAltHome];
    return <AltLandingPage />;
  }

  // Default: Load standard App Home
  return <AppHomeLanding />;
}
