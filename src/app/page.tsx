import { AppHomeLanding } from '@/components/landing';
import type { Metadata } from 'next';

/** The front page is the canonical address of the landing. */
export const metadata: Metadata = { alternates: { canonical: '/' } };

/**
 * @file page.tsx (/)
 * @description The front page: the app landing with open sign-up and sign-in.
 *
 * Tier 1 (what): Always renders `AppHomeLanding`, the same component as `/signin` and `/register`.
 * Tier 2 (why): Owner decision (2026-11-01): one front page that looks like the sign-in page and lets
 * people sign up without approval. The coming-soon waitlist page (and the North Pole "Alt Home" switch
 * that chose it) is retired: in BETA it showed an expired countdown and a manual clearance request.
 * Tier 3 (how): Static: no database lookup per visit (the self-hosted page used to read SystemConfig on
 * every request to pick a variant). The release stage still decides, client side, whether sign-up
 * needs an alpha code (`isAlphaStage` in the landing).
 */
export default function Page() {
  return <AppHomeLanding />;
}
