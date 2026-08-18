'use client';

import { ComingSoonLanding } from '@/components/landing/ComingSoonLanding';
import { AppHomeLanding } from '@/components/landing/AppHomeLanding';

/**
 * Dynamic Start Page Controller (Single-Codebase Open-Core Router)
 * 
 * - When `NEXT_PUBLIC_SHOW_COMING_SOON === 'true'` (Pre-Launch SaaS on kovertklaus.com):
 *   Renders the festive Coming Soon landing page with Charlie Brown lights, countdown HUD, and waitlist.
 * - When `NEXT_PUBLIC_SHOW_COMING_SOON === 'false'` (or undefined in dev/self-hosted/launch-day):
 *   Renders the full interactive web application with direct login, registration, and exchange creation.
 */
export default function Page() {
  const showComingSoon = process.env.NEXT_PUBLIC_SHOW_COMING_SOON === 'true';

  if (showComingSoon) {
    return <ComingSoonLanding />;
  }

  return <AppHomeLanding />;
}
