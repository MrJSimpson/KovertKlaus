'use client';

/**
 * @file NotificationBell.tsx
 * @description Header bell with an unread count that opens the notification panel.
 *
 * Tier 1 (what): Lists the agent's notifications from `GET /api/notifications` ten at a time, each
 * with an Open link to the page that needs attention and a ✕ to remove it; "Remove these" clears
 * the page shown. `pinned` notices (e.g. a missing shipping address) sit on top and cannot be
 * removed: they go away when the agent fixes what they point to.
 * Tier 2 (why): Notifications used to stack under the welcome card, so a troubled mission could
 * push the rest of the dashboard off screen. A bell keeps them one tap away without crowding it.
 * Tier 3 (how): Removing calls `PATCH /api/notifications` and drops the rows locally first, then
 * reloads on failure. `actionsFor` lets the page add buttons to a notification (Accept/Decline for
 * an invitation); it receives a `dismiss` callback to clear that notification once handled. The
 * panel is portaled to `<body>` and anchored under the bell, because headers use `backdrop-blur`,
 * which would trap a fixed-position child.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/context/ThemeContext';
import { NOTIFICATION_PAGE_SIZE, pageNotifications, type NotificationView } from '@/lib/notifications';
import { relativeTime, stripLeadingEmoji } from '@/lib/display-format';
import { Icon } from '@/components/brand/Icon';

/** A notice the page derives from the agent's state rather than a stored notification. */
export interface PinnedNotice {
  id: string;
  emoji: string;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

interface NotificationBellProps {
  pinned?: PinnedNotice[];
  /** Extra buttons for one notification; call `dismiss` to remove it once handled. */
  actionsFor?: (notification: NotificationView, dismiss: () => void) => ReactNode;
  /** Change to reload the list (e.g. after accepting an invitation). */
  reloadKey?: number;
  className?: string;
  /**
   * `button` (default): the old header bell. `tab`: the "Alerts" folder tab of the signed-in desktop
   * header. `tabbar`: the "Alerts" item of the phone tab bar; its panel opens upward, above the bar
   * (visual refresh, 2.0.0-beta, until Alerts gets its own page). `card`: the dashboard's Alerts
   * card on wide screens: needs-action notices and the latest alerts, with "See all" opening the
   * panel (owner request 2026-11-18: alerts in a tab *or* a card, never both).
   */
  variant?: 'button' | 'tab' | 'tabbar' | 'card';
}

/** `2026-11-03T…` → `Nov 3, 4:05 PM` in the viewer's time zone. */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function NotificationBell({ pinned = [], actionsFor, reloadKey = 0, className = '', variant = 'button' }: NotificationBellProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationView[]>([]);
  const [page, setPage] = useState(0);
  // Open notifications beyond the newest batch the server sent (it caps each list request).
  const [unloaded, setUnloaded] = useState(0);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [anchor, setAnchor] = useState({ top: 72, right: 8 });
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) {
          const list: NotificationView[] = json.notifications || [];
          setNotifications(list);
          setUnloaded(Math.max(0, (json.total ?? list.length) - list.length));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey, reload]);

  // While open: close on Escape or a click outside the bell and panel, and keep the panel anchored
  // under the bell when the window resizes.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      // The card opens the panel over itself; the header bell and tab open it underneath.
      if (rect) setAnchor({ top: variant === 'card' ? Math.max(8, rect.top) : rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    };
    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!containerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', place);
    };
  }, [open, variant]);

  const remove = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setError('');
    setNotifications((list) => list.filter((n) => !ids.includes(n.id)));
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      // Pull the next batch in once removals make room.
      if (unloaded > 0) setReload((n) => n + 1);
    } catch {
      setError('Could not remove that. Try again.');
      setReload((n) => n + 1);
    }
  }, [unloaded]);

  const shown = pageNotifications(notifications, page);
  const count = notifications.length + unloaded + pinned.length;
  const countLabel = count > 9 ? '9+' : String(count);

  return (
    <div ref={containerRef} className="relative">
      {variant === 'button' ? (
        <button
          onClick={() => setOpen((v) => !v)}
          className={`relative inline-flex items-center gap-1.5 cursor-pointer ${className}`}
          title="Notifications"
          aria-label={count ? `Notifications (${count})` : 'Notifications'}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span aria-hidden>🔔</span>
          <span className="hidden sm:inline">Notifications</span>
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-kk-primary text-kk-on-primary text-[10px] font-black flex items-center justify-center ring-2 ring-kk-surface">
              {countLabel}
            </span>
          )}
        </button>
      ) : variant === 'card' ? (
        <section className="kk-card px-5 pt-5 pb-1.5" aria-labelledby="alerts-card-h">
          <div className="flex justify-between items-center gap-3 mb-1.5">
            <h2 id="alerts-card-h" className="m-0 font-display text-lg leading-6 font-semibold text-kk-heading">
              Alerts
            </h2>
            {count > 0 && (
              <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog" className="text-[13px] font-semibold text-kk-accent hover:text-kk-primary-hover underline-offset-[3px] hover:underline cursor-pointer bg-transparent border-0 p-0 min-h-11">
                See all ({countLabel})
              </button>
            )}
          </div>
          {count === 0 ? (
            <p className="m-0 py-3.5 border-t border-kk-border text-sm text-kk-muted">All clear. Nothing needs you right now.</p>
          ) : (
            <ul className="list-none m-0 p-0">
              {pinned.map((p) => (
                <li key={p.id} className="flex gap-3 py-3.5 border-t border-kk-border">
                  <span className="text-kk-danger shrink-0 mt-0.5">
                    <Icon name="alert" size={18} />
                  </span>
                  <div className="flex flex-col gap-1 min-w-0 items-start">
                    <span className="font-semibold break-words">{stripLeadingEmoji(p.title.replace(/^Action Required:\s*/i, ''))}</span>
                    <span className="text-[13px] leading-5 text-kk-muted break-words">{p.message}</span>
                    <button type="button" onClick={p.onAction} className="kk-btn kk-btn--ghost kk-btn--sm mt-1">
                      {p.actionLabel}
                    </button>
                  </div>
                </li>
              ))}
              {notifications.slice(0, Math.max(0, 3 - pinned.length)).map((n) => (
                <li key={n.id} className="flex gap-3 py-3.5 border-t border-kk-border">
                  <span className="w-2.5 h-2.5 mt-[7px] rounded-full shrink-0 bg-kk-stamp" aria-hidden="true" />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-semibold break-words">{stripLeadingEmoji(n.title)}</span>
                    <span className="text-[13px] leading-5 text-kk-muted break-words">{n.message}</span>
                    <span className="font-mono text-xs text-kk-muted">{relativeTime(n.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${variant === 'tab' ? 'kk-header__link' : 'kk-tabbar__item w-full'} cursor-pointer ${className}`}
          aria-label={count ? `Alerts (${count})` : 'Alerts'}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          {variant === 'tabbar' && (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" />
              <path d="M10 21h4" />
            </svg>
          )}
          Alerts
          {count > 0 && (
            <span className={variant === 'tab' ? 'kk-tab-badge' : 'kk-tabbar__badge'} aria-hidden="true">
              {countLabel}
            </span>
          )}
        </button>
      )}

      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          style={
            variant === 'tabbar'
              ? { bottom: 'calc(var(--kk-tabbar-h) + env(safe-area-inset-bottom) + 8px)' }
              : { top: anchor.top, ['--kk-bell-right' as string]: `${anchor.right}px` }
          }
          className={`fixed left-2 right-2 sm:left-auto sm:right-[var(--kk-bell-right)] sm:w-[26rem] max-h-[75dvh] flex flex-col rounded-3xl border shadow-2xl z-50 overflow-hidden ${theme.cardBg}`}
        >
          <div className="px-4 py-3 border-b border-kk-border flex items-center justify-between gap-2 shrink-0">
            <h2 className={`text-base font-black ${theme.textHeading}`}>🔔 Notifications</h2>
            <button
              onClick={() => setOpen(false)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-kk-muted hover:text-kk-ink transition-all text-lg font-bold cursor-pointer"
              aria-label="Close notifications"
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto p-3 space-y-2">
            {error && <p className="text-xs font-bold text-kk-danger px-1">⚠️ {error}</p>}

            {pinned.map((p) => (
              <div key={p.id} className={`p-3 rounded-2xl border text-xs ${theme.alertWarning}`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg" aria-hidden>{p.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm">{p.title}</p>
                    <p className="mt-0.5 opacity-90">{p.message}</p>
                    <button
                      onClick={() => {
                        setOpen(false);
                        p.onAction();
                      }}
                      className="mt-2 font-bold underline cursor-pointer"
                    >
                      {p.actionLabel} →
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {count === 0 && <p className={`text-center text-sm py-8 ${theme.textSubLabel}`}>You&apos;re all caught up.</p>}

            {shown.items.map((n) => (
              <div key={n.id} className={`p-3 rounded-2xl border text-xs ${theme.cardInnerBg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`font-extrabold text-sm break-words ${theme.textLabel}`}>{n.title}</p>
                    <p className={`mt-0.5 break-words ${theme.textSubLabel}`}>{n.message}</p>
                    <p className="mt-1 text-[10px] font-mono text-kk-muted">{formatWhen(n.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => remove([n.id])}
                    className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-kk-muted hover:text-kk-ink cursor-pointer shrink-0"
                    aria-label={`Remove notification: ${n.title}`}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {actionsFor?.(n, () => remove([n.id]))}
                  {n.href && (
                    <Link href={n.href} onClick={() => setOpen(false)} className="font-bold underline">
                      Open mission →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {notifications.length > 0 && (
            <div className="px-3 py-2 border-t border-kk-border flex items-center justify-between gap-2 text-xs shrink-0">
              <button
                onClick={() => remove(shown.items.map((n) => n.id))}
                className={`px-3 py-2 min-h-[40px] rounded-xl font-bold border cursor-pointer ${theme.btnToggle}`}
              >
                Remove {shown.items.length === 1 ? 'this' : `these ${shown.items.length}`}
              </button>
              {shown.pageCount > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(shown.page - 1)}
                    disabled={shown.page === 0}
                    className="px-2 py-2 min-h-[40px] min-w-[40px] rounded-xl font-bold cursor-pointer disabled:opacity-40 disabled:cursor-default"
                    aria-label="Newer notifications"
                  >
                    ‹
                  </button>
                  <span className="font-mono text-kk-muted">
                    {shown.page * NOTIFICATION_PAGE_SIZE + 1}–{shown.page * NOTIFICATION_PAGE_SIZE + shown.items.length} of {notifications.length + unloaded}
                  </span>
                  <button
                    onClick={() => setPage(shown.page + 1)}
                    disabled={shown.page >= shown.pageCount - 1}
                    className="px-2 py-2 min-h-[40px] min-w-[40px] rounded-xl font-bold cursor-pointer disabled:opacity-40 disabled:cursor-default"
                    aria-label="Older notifications"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
