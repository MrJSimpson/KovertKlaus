/**
 * @file sitemap.ts (/sitemap.xml)
 * @description Lists the public pages for search engines. Paths live in `src/lib/seo.ts`.
 */
import type { MetadataRoute } from 'next';
import { buildSitemap, searchIndexingEnabled, siteUrl } from '@/lib/seo';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(searchIndexingEnabled(), siteUrl());
}
