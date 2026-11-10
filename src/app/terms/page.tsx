/**
 * @file page.tsx (/terms)
 * @description The KovertKlaus Terms of Service.
 *
 * Tier 1 (what): Renders `TERMS_OF_SERVICE` with `LegalPage`.
 * Tier 2 (why): Public beta sign-up needs plain terms people agree to when they create an account
 * (owner decision 2026-10-31).
 * Tier 3 (how): Static, no data fetching; the text lives in `src/lib/legal.ts`.
 */

import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';
import { LegalPage } from '@/components/LegalPage';
import { TERMS_OF_SERVICE } from '@/lib/legal';

export const metadata: Metadata = publicPageMetadata(
  '/terms',
  'Terms of Service | KovertKlaus',
  'The rules for using KovertKlaus, the hosted Secret Santa and gift exchange service.',
);

export default function TermsPage() {
  return <LegalPage doc={TERMS_OF_SERVICE} other={{ href: '/privacy', label: 'Privacy Policy' }} />;
}
