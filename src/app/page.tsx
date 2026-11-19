import { HomePage } from '@/components/home/HomePage';
import type { Metadata } from 'next';
import { buildStructuredData, jsonLdScript, searchIndexingEnabled, siteUrl } from '@/lib/seo';

/** The front page is the canonical address of the landing. */
export const metadata: Metadata = { alternates: { canonical: '/' } };

/**
 * @file page.tsx (/)
 * @description The front page: what KovertKlaus is, how a mission runs, and where to start.
 *
 * Tier 1 (what): Renders `HomePage` (visual refresh, 2.0.0-beta).
 * Tier 2 (why): Since 2026-11-18 Sign in and Create account have their own pages (`/signin`,
 * `/register`), so the front page explains the app to visitors and search engines (the 2026-11-01
 * one-front-page landing is retired). Structured data (JSON-LD, `buildStructuredData`) is added only
 * when search indexing is on.
 * Tier 3 (how): Static: no database lookup per visit; the live config (agent limit, banner) loads
 * client side.
 */
export default function Page() {
  return (
    <>
      {searchIndexingEnabled() && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(buildStructuredData(siteUrl())) }}
        />
      )}
      <HomePage />
    </>
  );
}
