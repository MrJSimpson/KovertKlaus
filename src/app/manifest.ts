/**
 * @file manifest.ts
 * @description The web app manifest (`/manifest.webmanifest`).
 *
 * Tier 1 (what): Name, colours and home-screen icons, so "Add to Home Screen" on Android and
 * desktop installs show the brand mark and open KovertKlaus in its own window.
 * Tier 2 (why): Release backlog for the visual refresh (owner 2026-11-10): icons and a manifest.
 * iOS uses `src/app/apple-icon.png` instead.
 * Tier 3 (how): A static metadata route, so it works in the SaaS static export. Icons come from
 * `npm run brand:icons` (`MANIFEST_ICONS`); colours are winter's page and header (`kk-tokens.css`,
 * the light `themeColor` in `layout.tsx`). Opens on the dashboard, which offers Sign in when signed out.
 */
import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f2ede3',
    theme_color: '#34502b',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
