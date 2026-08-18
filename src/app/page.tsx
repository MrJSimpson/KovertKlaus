import React from 'react';
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
};

/**
 * Dynamic Start Page Controller (Single-Codebase Open-Core Router)
 * 
 * - Reads `ALT_HOME` (or `NEXT_PUBLIC_ALT_HOME`) from environment variables.
 * - If `ALT_HOME` matches a registered alternate page (e.g. `ALT_HOME=coming_soon`),
 *   renders that specific alternate landing page.
 * - If `ALT_HOME` is blank, empty, or undefined, it automatically defaults to
 *   loading the standard interactive web application (`AppHomeLanding`).
 */
export default function Page() {
  const altHome = (
    process.env.ALT_HOME ||
    process.env.NEXT_PUBLIC_ALT_HOME ||
    ''
  ).trim().toLowerCase();

  if (altHome && ALT_HOME_REGISTRY[altHome]) {
    const AltLandingPage = ALT_HOME_REGISTRY[altHome];
    return <AltLandingPage />;
  }

  // Default: Load standard App Home
  return <AppHomeLanding />;
}
