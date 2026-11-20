import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/AuthPage';

/** Sign-in is not a search result of its own: canonical points at `/` (`src/lib/seo.ts`). */
export const metadata: Metadata = { alternates: { canonical: '/' }, title: 'Sign in | KovertKlaus' };

/**
 * @file page.tsx (/signin)
 * @description Sign in.
 *
 * Tier 1 (what): Renders `AuthPage` on its Sign in tab.
 * Tier 2 (why): Sign in has its own page in the visual refresh (owner decision 2026-11-18); links
 * and bookmarks to /signin keep working.
 * Tier 3 (how): A signed-in visitor is sent straight to the dashboard (or `?next=` target).
 */
export default function SignInPage() {
  return <AuthPage mode="login" />;
}
