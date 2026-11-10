/**
 * @file robots.ts (/robots.txt)
 * @description Tells crawlers which pages they may visit. Rules live in `src/lib/seo.ts`.
 */
import type { MetadataRoute } from 'next';
import { buildRobots, searchIndexingEnabled, siteUrl } from '@/lib/seo';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return buildRobots(searchIndexingEnabled(), siteUrl());
}
