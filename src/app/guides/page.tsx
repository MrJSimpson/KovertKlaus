/**
 * @file page.tsx (/guides)
 * @description The guide index: one card per how-to guide.
 *
 * Tier 1 (what): Heading, lead and `GuideCards`.
 * Tier 2 (why): Owner decision 2026-11-19: the guides live under `/guides`, so the section has one
 * address to link from the footer and can grow later.
 * Tier 3 (how): Static server component; content from `src/lib/guides.ts`.
 */
import type { Metadata } from 'next';
import { PublicShell } from '@/components/brand/PublicShell';
import { GuideCards } from '@/components/guides/GuideArticle';
import { GUIDES_INDEX } from '@/lib/guides';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata(GUIDES_INDEX.path, GUIDES_INDEX.searchTitle, GUIDES_INDEX.description);

export default function GuidesPage() {
  return (
    <PublicShell>
      <div className="flex flex-col gap-8 md:gap-10">
        <div className="flex flex-col gap-3 max-w-[40em]">
          <p className="m-0 font-display text-xs leading-4 font-semibold tracking-[0.12em] uppercase text-kk-muted">Guides</p>
          <h1 className="m-0 font-display font-bold text-kk-heading text-balance text-[32px] leading-[38px] md:text-[44px] md:leading-[50px]">
            {GUIDES_INDEX.title}
          </h1>
          <p className="m-0 text-[17px] leading-[27px] text-kk-muted">{GUIDES_INDEX.lead}</p>
        </div>
        <GuideCards />
      </div>
    </PublicShell>
  );
}
