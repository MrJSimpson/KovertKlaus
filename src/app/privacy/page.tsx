/**
 * @file page.tsx (/privacy)
 * @description The KovertKlaus Privacy Policy.
 *
 * Tier 1 (what): Renders `PRIVACY_POLICY` with `LegalPage`.
 * Tier 2 (why): Public beta sign-up collects addresses, sizes and allergies; people must be able to
 * read what happens to them before signing up (owner decision 2026-10-31).
 * Tier 3 (how): Static, no data fetching; the text lives in `src/lib/legal.ts`.
 */

import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { PRIVACY_POLICY } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy Policy | KovertKlaus' };

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY_POLICY} other={{ href: '/terms', label: 'Terms of Service' }} />;
}
