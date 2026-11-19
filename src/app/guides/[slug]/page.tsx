/**
 * @file page.tsx (/guides/[slug])
 * @description One how-to guide, prerendered for each entry in `GUIDES`.
 *
 * Tier 1 (what): Search metadata per guide and `GuideArticle` inside `PublicShell`.
 * Tier 2 (why): Public, crawlable guides shipped with the visual refresh (owner decisions 2026-11-10
 * and 2026-11-19).
 * Tier 3 (how): `generateStaticParams` lists the guides and `dynamicParams = false`, so the SaaS
 * static export builds each page once and any other slug is a 404.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/brand/PublicShell';
import { GuideArticle } from '@/components/guides/GuideArticle';
import { GUIDES, guideBySlug } from '@/lib/guides';
import { publicPageMetadata } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  return guide ? publicPageMetadata(guide.path, guide.searchTitle, guide.description) : {};
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  return (
    <PublicShell>
      <GuideArticle guide={guide} />
    </PublicShell>
  );
}
