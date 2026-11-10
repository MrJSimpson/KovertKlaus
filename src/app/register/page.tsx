import { AppHomeLanding } from '@/components/landing';
import type { Metadata } from 'next';

/** Same landing as `/`, so search engines are pointed at `/` (`src/lib/seo.ts`). */
export const metadata: Metadata = { alternates: { canonical: '/' } };

/**
 * @file page.tsx (/register)
 * @description Landing target for Alpha Clearance approval emails.
 *
 * Tier 1 (what): Always renders the app landing with its sign-up form, whatever the North Pole
 * "Alt Home" setting is.
 * Tier 2 (why): Invitation and approval emails link to `/register?code=…&email=…`. It is the same page
 * as `/` (one front page since 2026-11-01), opened to the sign-up form.
 * Tier 3 (how): `AppHomeLanding` reads `?code=` / `?email=` on mount, pre-fills the activation
 * code and email, and opens the sign-up form. Static-export safe (query params are read client-side).
 */
export default function RegisterPage() {
  return <AppHomeLanding />;
}
