import React from 'react';
import fs from 'fs';
import path from 'path';
import { AppHomeLanding, ComingSoonLanding } from '@/components/landing';

/**
 * Registry mapping ALT_HOME environment values to landing page components.
 * To add a new alternate homepage, register its key and component here.
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
 * Dynamic Start Page Controller (Single-Codebase Open-Core Router)
 * 
 * - Reads `ALT_HOME` (or `NEXT_PUBLIC_ALT_HOME`) from environment variables.
 * - For Cloudflare SaaS pre-launch distribution (`wrangler.json` present), defaults to `coming_soon`
 *   unless explicitly overridden.
 * - For self-hosted/dev distribution, defaults to `AppHomeLanding`.
 */
export default function Page() {
  const isCloudflareSaaS = typeof process !== 'undefined' && fs.existsSync(path.join(process.cwd(), 'wrangler.json'));
  
  const rawAltHome = process.env.ALT_HOME || process.env.NEXT_PUBLIC_ALT_HOME;
  const altHome = (
    rawAltHome !== undefined ? rawAltHome : (isCloudflareSaaS ? 'coming_soon' : '')
  ).trim().toLowerCase();

  if (altHome && ALT_HOME_REGISTRY[altHome]) {
    const AltLandingPage = ALT_HOME_REGISTRY[altHome];
    return <AltLandingPage />;
  }

  // Default: Load standard App Home
  return <AppHomeLanding />;
}
