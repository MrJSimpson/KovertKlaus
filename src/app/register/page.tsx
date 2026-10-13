import { AppHomeLanding } from '@/components/landing';

/**
 * @file page.tsx (/register)
 * @description Landing target for Alpha Clearance approval emails.
 *
 * Tier 1 (what): Always renders the app landing with its sign-up form, whatever the North Pole
 * "Alt Home" setting is.
 * Tier 2 (why): Approval emails link to `/register?code=ALPHA-…&email=…`. With Alt Home set to
 * `coming_soon`, `/` shows the pre-launch page (no sign-up form), so approved operatives had no
 * way to register; before this route existed the link returned 404.
 * Tier 3 (how): `AppHomeLanding` reads `?code=` / `?email=` on mount, pre-fills the activation
 * code and email, and opens the sign-up form. Static-export safe (query params are read client-side).
 */
export default function RegisterPage() {
  return <AppHomeLanding />;
}
