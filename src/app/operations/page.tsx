'use client';

/**
 * @file operations/page.tsx
 * @description Redirect from the retired Operations Center to the dashboard.
 *
 * Tier 1 (what): Sends `/operations` to `/dashboard`.
 * Tier 2 (why): The Operations Center was folded into the dashboard (2026-10-26), which now lists
 * every mission with the same filters. Old bookmarks and links keep working.
 * Tier 3 (how): A client redirect, because the SaaS edition is a static export with no server
 * redirects.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OperationsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return null;
}
