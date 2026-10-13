import { AppHomeLanding } from '@/components/landing';

/**
 * @file page.tsx (/signin)
 * @description Operative sign-in entry point.
 *
 * Tier 1 (what): Renders the app landing with the sign-in form opened.
 * Tier 2 (why): While Alt Home is `coming_soon`, `/` shows the pre-launch page, which has no sign-in.
 * Approved operatives who signed out had no way back in; the pre-launch header now links here.
 * Tier 3 (how): `AppHomeLanding` opens the login form when the path is `/signin` (or `?signin` is set).
 */
export default function SignInPage() {
  return <AppHomeLanding />;
}
