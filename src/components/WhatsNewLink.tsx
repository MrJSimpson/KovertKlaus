'use client';

/**
 * @file WhatsNewLink.tsx
 * @description "What's New" link to `/announcements`, with a dot until the newest one is opened.
 *
 * Tier 1 (what): Renders a link to the announcements page and a small dot when the viewer has not
 * opened the newest announcement (`hasUnseenAnnouncement`).
 * Tier 2 (why): Updates should be noticed without emailing everyone or interrupting with a modal.
 * Tier 3 (how): The last-seen version lives in browser storage (a per-viewer convenience only); the
 * announcements page records it on open. Storage can be unavailable (private windows), so every
 * access is guarded and the link still works without the dot.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ANNOUNCEMENT_SEEN_KEY, hasUnseenAnnouncement } from '@/lib/announcements';

interface WhatsNewLinkProps {
  className?: string;
  /** Hide the text label below the `sm` breakpoint (icon only). */
  compact?: boolean;
}

export function WhatsNewLink({ className = '', compact = false }: WhatsNewLinkProps) {
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    let lastSeen: string | null = null;
    try {
      lastSeen = window.localStorage.getItem(ANNOUNCEMENT_SEEN_KEY);
    } catch {
      // Storage unavailable: show no dot
      return;
    }
    const timer = window.setTimeout(() => setUnseen(hasUnseenAnnouncement(lastSeen)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Link href="/announcements" className={`relative inline-flex items-center gap-1.5 ${className}`} title="What's new in KovertKlaus">
      <span aria-hidden>📣</span>
      <span className={compact ? 'hidden sm:inline' : ''}>What&apos;s New</span>
      {unseen && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" aria-label="New update" />
      )}
    </Link>
  );
}
