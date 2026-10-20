'use client';

/**
 * @file WhatsNewButton.tsx
 * @description "What's New" button that opens release notes in a closable pop-up.
 *
 * Tier 1 (what): Renders a button with a small dot while the viewer has not opened the newest
 * announcement (`hasUnseenAnnouncement`); clicking it shows every release from
 * `src/lib/announcements.ts`, newest first, over the current page.
 * Tier 2 (why): Release notes are a quick read, so they open in place instead of sending the agent
 * to a separate page and back.
 * Tier 3 (how): Opening records the newest version in browser storage (a per-viewer convenience
 * only), which clears the dot. Storage can be unavailable (private windows), so every access is
 * guarded and the pop-up still works without the dot. Escape, ✕ or a click outside closes it. The
 * pop-up is portaled to `<body>` because headers use `backdrop-blur`, which would trap it.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/context/ThemeContext';
import { ANNOUNCEMENTS, ANNOUNCEMENT_SEEN_KEY, LATEST_ANNOUNCEMENT_VERSION, hasUnseenAnnouncement } from '@/lib/announcements';

interface WhatsNewButtonProps {
  className?: string;
  /** Hide the text label below the `sm` breakpoint (icon only). */
  compact?: boolean;
}

/** `2026-10-15` → `October 15, 2026` (date-only, no time zone shift). */
function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function WhatsNewButton({ className = '', compact = false }: WhatsNewButtonProps) {
  const { theme } = useTheme();
  const [unseen, setUnseen] = useState(false);
  const [open, setOpen] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function openNotes() {
    setOpen(true);
    setUnseen(false);
    try {
      window.localStorage.setItem(ANNOUNCEMENT_SEEN_KEY, LATEST_ANNOUNCEMENT_VERSION);
    } catch {
      // Storage unavailable: nothing to remember
    }
  }

  return (
    <>
      <button onClick={openNotes} className={`relative inline-flex items-center gap-1.5 cursor-pointer ${className}`} title="What's new in KovertKlaus">
        <span aria-hidden>📣</span>
        <span className={compact ? 'hidden sm:inline' : ''}>What&apos;s New</span>
        {unseen && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-kk-primary ring-2 ring-kk-surface" aria-label="New update" />
        )}
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex sm:items-center items-end justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="What's New"
            className={`w-full max-w-2xl max-h-[88dvh] rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col text-left font-normal ${theme.cardBg}`}
          >
            <div className="p-4 sm:p-5 border-b border-kk-border flex items-center justify-between shrink-0">
              <div>
                <h2 className={`text-xl sm:text-2xl font-black ${theme.textHeading}`}>📣 What&apos;s New</h2>
                <p className={`text-xs ${theme.textSubLabel}`}>Updates to KovertKlaus, newest first.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-kk-muted hover:text-kk-ink transition-all text-xl font-bold cursor-pointer"
                aria-label="Close What's New"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-5 space-y-6">
              {ANNOUNCEMENTS.map((a, i) => (
                <article key={a.version}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${theme.badgeCode}`}>v{a.version}</span>
                    <span className={`text-xs font-semibold ${theme.textSubLabel}`}>{formatDate(a.date)}</span>
                    {i === 0 && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-kk-danger-soft text-kk-on-danger-soft border border-kk-danger/40">Latest</span>}
                  </div>
                  <h3 className={`mt-2 text-lg sm:text-xl font-black ${theme.textHeading}`}>{a.title}</h3>
                  <p className={`mt-1 text-sm ${theme.textSubLabel}`}>{a.summary}</p>
                  <ul className="mt-3 space-y-2">
                    {a.highlights.map((h) => (
                      <li key={h.title} className={`p-3 rounded-2xl border text-sm ${theme.cardInnerBg}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span aria-hidden>{h.emoji}</span>
                          <span className={`font-bold ${theme.textLabel}`}>{h.title}</span>
                          {h.selfHostedOnly && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-kk-border text-kk-muted">Self-hosted</span>
                          )}
                        </div>
                        <p className={`mt-1 ${theme.textSubLabel}`}>{h.text}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
