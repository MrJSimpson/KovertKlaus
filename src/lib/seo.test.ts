import test from 'node:test';
import assert from 'node:assert';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  LANDING_ALIASES,
  PRIVATE_PATHS,
  SAAS_SITE_URL,
  SHARE_IMAGE,
  SITEMAP_PATHS,
  publicPageMetadata,
  buildRobots,
  buildSitemap,
  buildStructuredData,
  jsonLdScript,
  searchIndexingEnabled,
  siteUrl,
} from './seo';

const APP_DIR = join(process.cwd(), 'src', 'app');
const segment = (p: string) => p.replace(/^\//, '').replace(/\/$/, '');

test('SEO: SaaS is indexed by default, self-hosted is not, SEARCH_INDEXING overrides both', () => {
  assert.strictEqual(searchIndexingEnabled({}, true), true);
  assert.strictEqual(searchIndexingEnabled({}, false), false);
  assert.strictEqual(searchIndexingEnabled({ SEARCH_INDEXING: 'true' }, false), true);
  assert.strictEqual(searchIndexingEnabled({ SEARCH_INDEXING: ' FALSE ' }, true), false);
  assert.strictEqual(searchIndexingEnabled({ SEARCH_INDEXING: 'maybe' }, false), false);
});

test('SEO: site URL is kovertklaus.com for SaaS, the operator URL for self-hosted', () => {
  assert.strictEqual(siteUrl({ NEXT_PUBLIC_APP_URL: 'https://elves.example.org/' }, true), SAAS_SITE_URL);
  assert.strictEqual(siteUrl({ NEXT_PUBLIC_APP_URL: 'https://elves.example.org/' }, false), 'https://elves.example.org');
  assert.strictEqual(siteUrl({ NEXT_PUBLIC_APP_URL: 'not a url' }, false), SAAS_SITE_URL);
  assert.strictEqual(siteUrl({}, false), SAAS_SITE_URL);
});

test('SEO: robots.txt blocks everything when indexing is off', () => {
  const r = buildRobots(false, SAAS_SITE_URL);
  assert.deepStrictEqual(r.rules, { userAgent: '*', disallow: '/' });
  assert.strictEqual(r.sitemap, undefined);
});

test('SEO: robots.txt blocks every private segment and points at the sitemap', () => {
  const r = buildRobots(true, SAAS_SITE_URL);
  const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
  assert.strictEqual(rules.allow, '/');
  assert.deepStrictEqual(rules.disallow, [...PRIVATE_PATHS]);
  assert.strictEqual(r.sitemap, 'https://kovertklaus.com/sitemap.xml');
});

test('SEO: sitemap lists only public pages, as absolute URLs', () => {
  assert.deepStrictEqual(buildSitemap(false, SAAS_SITE_URL), []);
  const urls = buildSitemap(true, SAAS_SITE_URL).map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://kovertklaus.com', 'https://kovertklaus.com/features', 'https://kovertklaus.com/privacy', 'https://kovertklaus.com/terms']);
  for (const u of urls) {
    assert.ok(!PRIVATE_PATHS.some((p) => new URL(u).pathname.startsWith(p)), u);
  }
});

test('SEO: public page metadata always carries canonical, share image and description', () => {
  const m = publicPageMetadata('/features', 'Features | KovertKlaus', 'About it.');
  assert.strictEqual(m.alternates?.canonical, '/features');
  const og = m.openGraph as { url?: string; images?: unknown[]; description?: string; siteName?: string };
  assert.strictEqual(og.url, '/features');
  assert.deepStrictEqual(og.images, [SHARE_IMAGE]);
  assert.strictEqual(og.description, 'About it.');
  assert.strictEqual(og.siteName, 'KovertKlaus');
  assert.ok(existsSync(join(process.cwd(), 'public', SHARE_IMAGE.url)), 'share image file missing from public/');
});

test('SEO: every top-level route is classified as public or private', () => {
  const known = new Set([...SITEMAP_PATHS, ...LANDING_ALIASES, ...PRIVATE_PATHS].map(segment));
  const routes = readdirSync(APP_DIR).filter((n) => statSync(join(APP_DIR, n)).isDirectory() && !n.startsWith('(') && !n.startsWith('_'));
  for (const r of routes) {
    assert.ok(known.has(r), `New route /${r}: add it to SITEMAP_PATHS, LANDING_ALIASES or PRIVATE_PATHS in src/lib/seo.ts`);
  }
});

test('SEO: every private page segment exports NOINDEX from a server layout', () => {
  for (const p of PRIVATE_PATHS) {
    const name = segment(p);
    // /api has no pages; SaaS physically excludes /workshop (sync syncignore).
    if (name === 'api' || !existsSync(join(APP_DIR, name))) continue;
    const layout = join(APP_DIR, name, 'layout.tsx');
    assert.ok(existsSync(layout), `${layout} missing`);
    const src = readFileSync(layout, 'utf8');
    assert.ok(!src.includes("'use client'"), `${name}/layout.tsx must be a server component`);
    assert.ok(src.includes('export const metadata = NOINDEX'), `${name}/layout.tsx must export NOINDEX`);
  }
});

test('SEO: structured data describes a free web app at the site origin', () => {
  const data = buildStructuredData('https://elves.example.org') as { '@graph': Array<Record<string, unknown>> };
  const app = data['@graph'].find((n) => n['@type'] === 'WebApplication');
  const site = data['@graph'].find((n) => n['@type'] === 'WebSite');
  assert.ok(app && site);
  assert.strictEqual(app.url, 'https://elves.example.org/');
  assert.strictEqual(site.url, 'https://elves.example.org/');
  assert.deepStrictEqual(app.offers, { '@type': 'Offer', price: '0', priceCurrency: 'USD' });
  assert.strictEqual(app.image, `https://elves.example.org${SHARE_IMAGE.url}`);
});

test('SEO: JSON-LD serialization cannot close its script tag', () => {
  const out = jsonLdScript({ name: '</script><script>alert(1)</script>' });
  assert.ok(!out.includes('<'));
  assert.deepStrictEqual(JSON.parse(out), { name: '</script><script>alert(1)</script>' });
});

test('SEO: nothing in public/ besides site assets (public/ is served to anyone and can be indexed)', () => {
  const allowed = new Set(['_headers', 'opengraph-image.png']);
  const PUBLIC_DIR = join(process.cwd(), 'public');
  for (const n of readdirSync(PUBLIC_DIR)) {
    const isArt = statSync(join(PUBLIC_DIR, n)).isDirectory() || /\.(png|svg|webp|jpg|ico)$/.test(n);
    assert.ok(allowed.has(n) || isArt, `public/${n}: documents and internal files do not belong in public/`);
  }
});
