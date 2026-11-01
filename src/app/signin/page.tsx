import { AppHomeLanding } from '@/components/landing';

/**
 * @file page.tsx (/signin)
 * @description Operative sign-in entry point.
 *
 * Tier 1 (what): Renders the app landing with the sign-in form opened.
 * Tier 2 (why): The same page as `/` (owner decision 2026-11-01: one front page), opened straight to
 * the sign-in form, so links and bookmarks to /signin keep working.
 * Tier 3 (how): `AppHomeLanding` opens the login form when the path is `/signin` (or `?signin` is set).
 */
export default function SignInPage() {
  return <AppHomeLanding />;
}
