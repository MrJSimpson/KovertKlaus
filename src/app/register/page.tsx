import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/AuthPage';

/** Sign-up is not a search result of its own: canonical points at `/` (`src/lib/seo.ts`). */
export const metadata: Metadata = { alternates: { canonical: '/' }, title: 'Create account | KovertKlaus' };

/**
 * @file page.tsx (/register)
 * @description Create account.
 *
 * Tier 1 (what): Renders `AuthPage` on its Create account tab.
 * Tier 2 (why): Invitation and approval emails link to `/register?code=…&email=…[&invite=…]`; since
 * the visual refresh (owner decision 2026-11-18) this is its own page instead of a form on `/`.
 * Tier 3 (how): `AuthPage` reads the query on mount (static-export safe), pre-fills the email,
 * sends the code and invite token with the sign-up, and shows the mission briefing for invitations.
 */
export default function RegisterPage() {
  return <AuthPage mode="register" />;
}
