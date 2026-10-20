'use client';

/**
 * @file page.tsx
 * @description `/opkits`: retired Wishlist Manifest library; forwards to the dashboard.
 *
 * Tier 1 (what): Replaces the page with a redirect to `/dashboard`.
 * Tier 2 (why): Wishlist Manifests belong to one mission and are edited on that mission's page
 * (alpha feedback, 2026-10-20), so the standalone library is gone. Old bookmarks still land somewhere useful.
 * Tier 3 (how): A client-side `router.replace`, which works in both the self-hosted build and the
 * SaaS static export (where `next.config` redirects do not apply).
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RetiredOpKitsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return (
    <p className="p-8 text-center text-sm text-kk-muted">
      Wishlists now live on each mission&apos;s page. Taking you to your dashboard…
    </p>
  );
}
