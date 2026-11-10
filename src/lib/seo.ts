/**
 * @file seo.ts
 * @description Search-engine rules: which pages may be indexed, the sitemap, and the noindex metadata.
 *
 * Tier 1 (what): `buildRobots` and `buildSitemap` feed `src/app/robots.ts` and `src/app/sitemap.ts`;
 * `NOINDEX` is the metadata every private route segment exports from its `layout.tsx`.
 * Tier 2 (why): Owner decision (2026-11-09): kovertklaus.com should be found by search engines, but
 * only its public pages. Account, mission, invite and admin pages stay out of search results, and a
 * self-hosted install (a family's or club's private instance) is never indexed unless its operator
 * opts in with `SEARCH_INDEXING=true`.
 * Tier 3 (how): Pure functions taking `indexing` and `siteUrl`, so tests cover both editions. The SaaS
 * build is a static export, so the values are read once at build time (`MODE=SAAS` in CI).
 */

import type { Metadata, MetadataRoute } from 'next';
import { IS_SAAS } from '@/lib/config/mode';

/** The hosted service's address, used for canonical links and the sitemap. */
export const SAAS_SITE_URL = 'https://kovertklaus.com';

/**
 * Public pages listed in the sitemap. `/signin` and `/register` show the same landing as `/`, so they
 * stay crawlable but point their canonical link at `/` instead of being listed.
 */
export const SITEMAP_PATHS = ['/', '/features', '/privacy', '/terms'] as const;

/** Crawlable pages that are not in the sitemap (canonical points at `/`). */
export const LANDING_ALIASES = ['/signin', '/register'] as const;

/**
 * Route segments that hold accounts, missions, invites or admin tools. Each one is blocked in
 * robots.txt and exports `NOINDEX` from its layout (robots.txt stops crawling, not indexing).
 */
export const PRIVATE_PATHS = [
  '/api/',
  '/dashboard',
  '/delete-account',
  '/exchange/',
  '/northpole',
  '/operations',
  '/opkits',
  '/reset-password',
  '/verify-email',
  '/workshop',
] as const;

/**
 * Whether search engines may index this build. SaaS: yes unless `SEARCH_INDEXING=false`.
 * Self-hosted: no unless `SEARCH_INDEXING=true`.
 */
export function searchIndexingEnabled(env: Record<string, string | undefined> = process.env, isSaas = IS_SAAS): boolean {
  const flag = env.SEARCH_INDEXING?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return isSaas;
}

/** The site's own origin: the self-hosted `NEXT_PUBLIC_APP_URL` when set, else kovertklaus.com. */
export function siteUrl(env: Record<string, string | undefined> = process.env, isSaas = IS_SAAS): string {
  const own = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (!isSaas && own && /^https?:\/\//.test(own)) return own;
  return SAAS_SITE_URL;
}

/** robots.txt: public pages allowed and private segments blocked, or everything blocked. */
export function buildRobots(indexing: boolean, origin: string): MetadataRoute.Robots {
  if (!indexing) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: [...PRIVATE_PATHS] },
    sitemap: `${origin}/sitemap.xml`,
  };
}

/** sitemap.xml: the public pages, or nothing when indexing is off. */
export function buildSitemap(indexing: boolean, origin: string): MetadataRoute.Sitemap {
  if (!indexing) return [];
  return SITEMAP_PATHS.map((path) => ({
    url: `${origin}${path === '/' ? '' : path}`,
    changeFrequency: 'monthly' as const,
    priority: path === '/' ? 1 : path === '/features' ? 0.8 : 0.3,
  }));
}

export const SITE_NAME = 'KovertKlaus';
export const SITE_TITLE = 'KovertKlaus | Simple & Fun Secret Santa & Gift Exchanges';
export const SITE_DESCRIPTION =
  'Organize Secret Santa, Yankee Swaps, and Holiday Gift Exchanges in 60 seconds with universal wishlists and guaranteed 1-to-1 fair matching.';
/** The share card (`public/opengraph-image.png`, 1200x630). */
export const SHARE_IMAGE = {
  url: '/opengraph-image.png',
  width: 1200,
  height: 630,
  alt: 'KovertKlaus: simple, fun Secret Santa and gift exchanges',
} as const;

/**
 * Full metadata for a public page. Next replaces (does not merge) a parent's `openGraph`, so every
 * page that sets one must repeat the site name, description and share image; this builds it.
 */
export function publicPageMetadata(path: string, title = SITE_TITLE, description = SITE_DESCRIPTION): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_US', title, description, url: path, images: [SHARE_IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [SHARE_IMAGE] },
  };
}

/**
 * JSON-LD for the front page: the app (free, runs in a browser) and the site that publishes it.
 *
 * Tier 1 (what): A schema.org `@graph` with one `WebApplication` and one `WebSite`.
 * Tier 2 (why): Lets search engines show KovertKlaus as a free web app instead of guessing from page
 * text (owner decision 2026-11-10). Only facts the site already states: name, address, description,
 * price 0.
 * Tier 3 (how): Pure, so tests cover both editions; the front page renders it only when indexing is on.
 */
export function buildStructuredData(origin: string): Record<string, unknown> {
  const url = `${origin}/`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${url}#app`,
        name: SITE_NAME,
        url,
        description: SITE_DESCRIPTION,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Any (web browser)',
        browserRequirements: 'Requires JavaScript.',
        image: `${origin}${SHARE_IMAGE.url}`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      { '@type': 'WebSite', '@id': `${url}#site`, name: SITE_NAME, url, inLanguage: 'en-US' },
    ],
  };
}

/** Serializes JSON-LD for an inline `<script>`: `<` is escaped so the data can never close the tag. */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Metadata for private route segments: never indexed, links not followed. */
export const NOINDEX: Metadata = { robots: { index: false, follow: false } };
