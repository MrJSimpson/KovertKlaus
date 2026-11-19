'use client';

/**
 * @file page.tsx (/alerts)
 * @description The Alerts page: pinned notices that need action, then the rest by day.
 *
 * Tier 1 (what): Signed-in agents see "Needs action · pinned" (a missing shipping address, a paused
 * draw), then Today / This week / Earlier with an icon, mission name, message and link per alert.
 * Each alert can be removed; Clear all removes every alert except the pinned ones, after a
 * confirmation. Invitations carry Accept / Decline. With nothing open: "All clear".
 * Tier 2 (why): Visual refresh (2.0.0-beta, design canvas "Alerts" desktop + phone). Replaces the
 * header bell's dropdown, which showed different notices depending on the page it was opened from.
 * Tier 3 (how): `GET /api/notifications` returns `pinned`, `notifications` (newest 100) and `total`;
 * removing uses `PATCH /api/notifications` (`{ ids }` or `{ all: true }`; the server never removes
 * pinned notices) and drops rows locally first, reloading on failure. Day groups and time labels
 * are local to the viewer (`src/lib/alerts.ts`). "Add my address" opens the address section of the
 * Profile page (`/profile#address`).
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, ALERTS_CHANGED_EVENT } from '@/components/brand/AppShell';
import { Icon } from '@/components/brand/Icon';
import { Illustration } from '@/components/art/Illustration';
import { EMAIL_UNVERIFIED_CODE, USER_ID_KEY } from '@/lib/constants/auth';
import { fetchJsonWithRetry } from '@/lib/load-retry';
import { ALERT_ICON, alertFullTime, alertTimeLabel, groupAlerts } from '@/lib/alerts';
import { answerInvitation, type PendingInvitation } from '@/lib/invitation-client';
import type { NotificationView, PinnedAlert } from '@/lib/notifications';

const EYEBROW = 'm-0 font-display text-xs leading-4 font-semibold tracking-[0.12em] uppercase';

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** One alert in a day group. */
function AlertRow({
  alert,
  now,
  last,
  onRemove,
  invitation,
  inviteBusy,
  onAnswer,
}: {
  alert: NotificationView;
  now: Date;
  last: boolean;
  onRemove: () => void;
  invitation?: PendingInvitation;
  inviteBusy: boolean;
  onAnswer: (inv: PendingInvitation, accept: boolean) => void;
}) {
  const label = `${alert.title}${alert.missionName ? `, ${alert.missionName}` : ''}`;
  return (
    <li className={`flex gap-3.5 items-start px-4 py-4 md:px-5${last ? '' : ' border-b border-kk-border'}`}>
      <span className="shrink-0 w-9 h-9 rounded-full grid place-items-center bg-kk-inset text-kk-stamp border border-kk-border">
        <Icon name={ALERT_ICON[alert.kind]} size={18} />
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex justify-between gap-3 items-baseline">
          <p className="m-0 font-bold text-kk-heading break-words">{alert.title}</p>
          <time dateTime={alert.createdAt} title={alertFullTime(alert.createdAt)} className="shrink-0 font-mono text-xs uppercase text-kk-muted">
            {alertTimeLabel(alert.createdAt, now)}
          </time>
        </div>
        {alert.missionName && <p className="m-0 font-mono text-[13px] uppercase tracking-[0.04em] text-kk-muted break-words">{alert.missionName}</p>}
        <p className="m-0 mt-1 break-words">{alert.message}</p>
        {invitation ? (
          <div className="flex flex-wrap gap-2 mt-2.5">
            <button type="button" onClick={() => onAnswer(invitation, true)} disabled={inviteBusy} className="kk-btn kk-btn--primary kk-btn--sm">
              {inviteBusy ? 'Working…' : 'Accept'}
            </button>
            <button type="button" onClick={() => onAnswer(invitation, false)} disabled={inviteBusy} className="kk-btn kk-btn--ghost kk-btn--sm">
              Decline
            </button>
          </div>
        ) : (
          alert.href && (
            <Link href={alert.href} className="mt-1 font-semibold text-sm self-start">
              Open mission
            </Link>
          )
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove alert: ${label}`}
        title="Remove"
        className="shrink-0 w-11 h-11 -mt-1.5 -mr-2.5 grid place-items-center border-0 rounded-[var(--kk-radius-md)] bg-transparent text-kk-muted hover:text-kk-ink hover:bg-kk-inset cursor-pointer"
      >
        <Icon name="close" />
      </button>
    </li>
  );
}

/** One pinned notice: a banner with its fix-it button. */
function PinnedBanner({ alert }: { alert: PinnedAlert }) {
  const missionLine = [alert.missionName, alert.kind === 'paused' ? 'You are Head Elf' : null].filter(Boolean).join(' · ');
  return (
    <li className={`kk-banner kk-banner--${alert.tone} border border-current`}>
      <Icon name={alert.tone === 'danger' ? 'pause' : 'alert'} size={20} />
      <div className="flex-1 min-w-0">
        <p className="m-0 font-bold break-words">{alert.title}</p>
        {missionLine && <p className="m-0 font-mono text-[13px] uppercase tracking-[0.04em] break-words">{missionLine}</p>}
        <p className="m-0 mt-1 break-words">{alert.message}</p>
        <div className="flex flex-wrap gap-2 mt-2.5">
          {alert.action === 'shipping' ? (
            <Link href="/profile#address" className="kk-btn kk-btn--primary kk-btn--sm">
              {alert.actionLabel}
            </Link>
          ) : (
            alert.href && (
              <Link href={alert.href} className="kk-btn kk-btn--primary kk-btn--sm">
                {alert.actionLabel}
              </Link>
            )
          )}
        </div>
      </div>
    </li>
  );
}

export default function AlertsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [wakingUp, setWakingUp] = useState(false);
  const [user, setUser] = useState<{ id: string; name?: string | null } | null>(null);

  const [pinned, setPinned] = useState<PinnedAlert[]>([]);
  const [alerts, setAlerts] = useState<NotificationView[]>([]);
  /** Open alerts beyond the newest batch the server sent (it caps each list). */
  const [unloaded, setUnloaded] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reload, setReload] = useState(0);
  // `now` is fixed per load so labels and groups agree; reloads refresh it.
  const [now, setNow] = useState(() => new Date());

  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

  const confirmRef = useRef<HTMLDialogElement>(null);
  const [clearing, setClearing] = useState(false);

  // Who is signed in (the page waits behind /verify-email like the dashboard).
  useEffect(() => {
    let cancelled = false;
    fetchJsonWithRetry('/api/users/me', { onRetry: () => setWakingUp(true) })
      .then((me) => {
        if (cancelled) return;
        if (me.ok && me.json.authenticated && me.json.user) setUser(me.json.user);
        else if (me.status === 403 && me.json.code === EMAIL_UNVERIFIED_CODE) window.location.replace('/verify-email');
        else if (me.status === 401 || me.status === 404) localStorage.removeItem(USER_ID_KEY);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setWakingUp(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signedInId = user?.id;

  useEffect(() => {
    if (!signedInId) return;
    let cancelled = false;
    Promise.all([
      fetch('/api/notifications').then((res) => (res.ok ? res.json() : Promise.reject(new Error()))),
      fetch('/api/invitations')
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([json, inv]) => {
        if (cancelled) return;
        const list: NotificationView[] = json.notifications || [];
        setAlerts(list);
        setPinned(json.pinned || []);
        setUnloaded(Math.max(0, (json.total ?? list.length) - list.length));
        setInvitations(inv?.invitations || []);
        setLoadError('');
        setNow(new Date());
      })
      .catch(() => {
        if (!cancelled) setLoadError('Your alerts could not be loaded. Check your connection and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [signedInId, reload]);

  const refresh = useCallback(() => {
    setReload((n) => n + 1);
    window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));
  }, []);

  const remove = useCallback(
    async (body: { ids: string[] } | { all: true }) => {
      setActionError('');
      if ('all' in body) {
        setAlerts([]);
        setUnloaded(0);
      } else {
        setAlerts((list) => list.filter((a) => !body.ids.includes(a.id)));
      }
      try {
        const res = await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        // Pull the next batch in once removals make room, and update the tab badge.
        if (unloaded > 0 && !('all' in body)) setReload((n) => n + 1);
        window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));
      } catch {
        setActionError('That could not be removed. Try again.');
        refresh();
      }
    },
    [unloaded, refresh],
  );

  async function clearAll() {
    setClearing(true);
    await remove({ all: true });
    setClearing(false);
    confirmRef.current?.close();
  }

  async function handleInvitation(inv: PendingInvitation, accept: boolean, alertId: string) {
    setInviteBusyId(inv.id);
    setActionError('');
    try {
      await answerInvitation(inv, accept);
      await remove({ ids: [alertId] });
      if (accept) router.push(`/exchange/${inv.exchange.code}`);
      else refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The invitation could not be updated.');
    } finally {
      setInviteBusyId(null);
    }
  }

  async function handleSignOut() {
    try {
      await fetch('/api/users/me', { method: 'DELETE' });
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem(USER_ID_KEY);
      localStorage.removeItem('kovertklaus_user_name');
      // A full load, so no signed-in state survives.
      window.location.replace('/');
    }
  }

  const removable = alerts.length + unloaded;
  const open = removable + pinned.length;
  const groups = groupAlerts(alerts, now);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const invitationFor = (a: NotificationView) => (a.kind === 'invite' ? invitations.find((i) => i.exchange.id === a.exchangeId) : undefined);

  return (
    <>
      <AppShell active="alerts" onSignOut={handleSignOut}>
        <main className="mx-auto w-full max-w-[800px] px-4 md:px-8 pt-6 md:pt-10 pb-8 md:pb-16 flex flex-col gap-6 md:gap-7">
          {loading ? (
            <div role="status" className="py-20 text-center flex flex-col items-center gap-3">
              <span className="kk-stamp">Checking for alerts</span>
              {wakingUp && <p className="m-0 text-kk-muted">Waking up the North Pole servers. This can take up to half a minute.</p>}
            </div>
          ) : !user ? (
            <div className="kk-card max-w-xl mx-auto mt-10 flex flex-col items-center text-center gap-3">
              <h1 className="m-0 font-display text-[28px] leading-[34px] font-bold text-kk-heading">You&apos;re signed out</h1>
              <p className="m-0 text-kk-muted">Sign in to see your alerts.</p>
              <Link href="/signin" className="kk-btn kk-btn--primary">
                <Icon name="key" />
                Sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 items-end justify-between">
                <div className="flex flex-col gap-1">
                  {firstName && <p className={`${EYEBROW} text-kk-muted`}>{firstName}</p>}
                  <h1 className="m-0 font-display font-bold text-kk-heading text-[28px] leading-[34px] md:text-4xl md:leading-[42px]">Alerts</h1>
                  {open > 0 && (
                    <p className="m-0 text-kk-muted">
                      {open} open{pinned.length > 0 ? ` · ${pinned.length} need${pinned.length === 1 ? 's' : ''} action` : ''}
                    </p>
                  )}
                </div>
                {removable > 0 && (
                  <button type="button" onClick={() => confirmRef.current?.showModal()} className="kk-btn kk-btn--ghost kk-btn--sm">
                    <Icon name="trash" />
                    Clear all
                  </button>
                )}
              </div>

              {(loadError || actionError) && (
                <div role="alert" className="kk-banner kk-banner--danger">
                  <Icon name="alert" size={20} />
                  <span className="flex-1">{loadError || actionError}</span>
                  {loadError && (
                    <button type="button" onClick={refresh} className="kk-btn kk-btn--ghost kk-btn--sm">
                      Try again
                    </button>
                  )}
                </div>
              )}

              {pinned.length > 0 && (
                <section aria-labelledby="alerts-pinned" className="flex flex-col gap-2.5">
                  <h2 id="alerts-pinned" className={`${EYEBROW} text-kk-danger`}>
                    Needs action · pinned
                  </h2>
                  <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
                    {pinned.map((p) => (
                      <PinnedBanner key={p.id} alert={p} />
                    ))}
                  </ul>
                </section>
              )}

              {groups.map((g) => (
                <section key={g.key} aria-labelledby={`alerts-${g.key}`} className="flex flex-col gap-2.5">
                  <h2 id={`alerts-${g.key}`} className={`${EYEBROW} text-kk-muted`}>
                    {g.label}
                  </h2>
                  <ul className="kk-card list-none m-0 !p-0">
                    {g.items.map((a, i) => {
                      const inv = invitationFor(a);
                      return (
                        <AlertRow
                          key={a.id}
                          alert={a}
                          now={now}
                          last={i === g.items.length - 1}
                          onRemove={() => remove({ ids: [a.id] })}
                          invitation={inv}
                          inviteBusy={inviteBusyId === inv?.id}
                          onAnswer={(invitation, accept) => handleInvitation(invitation, accept, a.id)}
                        />
                      );
                    })}
                  </ul>
                </section>
              ))}

              {unloaded > 0 && (
                <p className="m-0 text-sm text-kk-muted text-center">
                  Showing the newest {alerts.length} of {removable}. Remove some to see older ones.
                </p>
              )}

              {open === 0 && !loadError ? (
                <div className="kk-card flex flex-col items-center text-center gap-3 px-6 md:px-8 py-10 md:py-12">
                  <div className="w-[160px] h-[120px]">
                    <Illustration name="allClear" />
                  </div>
                  <h2 className="m-0 font-display text-[28px] leading-[34px] font-bold text-kk-heading">All clear</h2>
                  <p className="m-0 text-kk-muted max-w-[30em]">Nothing needs you right now. We&apos;ll show it here when something changes.</p>
                </div>
              ) : (
                open > 0 && (
                  <p className="m-0 text-[13px] leading-5 text-kk-muted text-center">
                    Removed alerts don&apos;t come back. Pinned alerts go away by themselves once the problem is fixed.
                  </p>
                )
              )}
            </>
          )}
        </main>
      </AppShell>

      <dialog
        ref={confirmRef}
        aria-labelledby="clear-alerts-h"
        className="kk-dialog"
        onClick={(e) => {
          if (e.target === confirmRef.current) confirmRef.current?.close();
        }}
      >
        <div className="kk-card flex flex-col gap-3.5">
          <h2 id="clear-alerts-h" className="m-0 font-display text-[22px] leading-7 font-bold text-kk-heading">
            Clear {plural(removable, 'alert', 'alerts')}?
          </h2>
          <p className="m-0">
            This removes everything under {groups.map((g) => g.label).join(', ').replace(/, ([^,]*)$/, ' and $1') || 'your alerts'}.
            {pinned.length > 0 && ` The ${plural(pinned.length, 'pinned alert stays', 'pinned alerts stay')} until ${pinned.length === 1 ? 'its problem is' : 'their problems are'} fixed.`}
          </p>
          <div className="flex flex-wrap gap-2.5 justify-end">
            <button type="button" onClick={() => confirmRef.current?.close()} className="kk-btn kk-btn--ghost">
              Keep them
            </button>
            <button type="button" onClick={clearAll} disabled={clearing} className="kk-btn kk-btn--danger">
              <Icon name="trash" />
              {clearing ? 'Clearing…' : `Clear ${plural(removable, 'alert', 'alerts')}`}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
