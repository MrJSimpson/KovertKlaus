'use client';

import { EMAIL_UNVERIFIED_CODE, USER_ID_KEY } from '@/lib/constants/auth';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { AccountPreferencesModal, type PreferencesTab } from '@/components/AccountPreferencesModal';
import { CreateOperationModal } from '@/components/CreateOperationModal';
import { JoinOperationModal } from '@/components/JoinOperationModal';
import type { PinnedNotice } from '@/components/NotificationBell';
import type { NotificationView } from '@/lib/notifications';
import { fetchJsonWithRetry } from '@/lib/load-retry';
import { DEFAULT_HIDE_PREFS, MISSION_CHIPS, chipCounts, chipMatches, filterMissions, type MissionChip } from '@/lib/mission-list';
import { sentenceDate, type MissionListItem } from '@/lib/mission-card';
import { formatBudget } from '@/lib/display-format';
import { AppShell } from '@/components/brand/AppShell';
import { Icon } from '@/components/brand/Icon';
import { Illustration } from '@/components/art/Illustration';
import { MissionFileCard } from '@/components/missions/MissionFileCard';

interface UserData {
  id: string;
  email: string;
  name: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  demerits: number;
  accountStatus: string;
  participations: Array<{
    id: string;
    role: string;
    exchange?: {
      id: string;
      title: string;
      code: string;
      status: string;
      giftingType: string;
      isLocalOnly?: boolean;
      isWhiteElephant: boolean;
      budgetMin?: number;
      budgetMax: number;
      currency: string;
      executionDate: string;
      /** Set while the draw is paused for repair. */
      repairDeadline?: string | null;
      /** The mission's Head Elf. */
      organizerId?: string;
    };
    mission?: {
      id: string;
      title: string;
      code: string;
      status: string;
      giftingType: string;
      isLocalOnly?: boolean;
      isWhiteElephant: boolean;
      budgetMin?: number;
      budgetMax: number;
      currency: string;
      executionDate: string;
      /** Set while the draw is paused for repair. */
      repairDeadline?: string | null;
      /** The mission's Head Elf. */
      organizerId?: string;
    };
  }>;
}

/** One mission from `GET /api/operations` (with the viewer's card state; src/lib/mission-card.ts). */
type MissionSummary = MissionListItem & { isLocalOnly?: boolean };

/** One open invitation from `GET /api/invitations`. */
interface PendingInvitation {
  id: string;
  isLatePass: boolean;
  exchange: {
    id: string;
    title: string;
    code: string;
    executionDate: string;
    budgetMin: number | null;
    budgetMax: number;
    currency: string;
    organizer: { name: string };
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  /** Set once a load has been retried, so the loading screen says the servers are waking up. */
  const [wakingUp, setWakingUp] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);

  // Every mission the agent runs or has joined, with the list filters (the old Operations Center's).
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [missionsError, setMissionsError] = useState('');
  /** Missions the agent asked to join by code (src/lib/join-requests.ts): waiting or declined. */
  const [joinRequests, setJoinRequests] = useState<Array<{ id: string; status: string; exchange: { title: string; code: string } }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  /** Filter chip (All, Running, I lead, Completed, Cancelled; src/lib/mission-list.ts). */
  const [chip, setChip] = useState<MissionChip>('all');

  // Edit Preferences Modal
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  // Each opening remounts the modal (`key`), so it starts on the requested tab.
  const [prefTab, setPrefTab] = useState<PreferencesTab>('identity');
  const [prefOpenCount, setPrefOpenCount] = useState(0);
  function openPreferences(tab: PreferencesTab = 'identity') {
    setPrefTab(tab);
    setPrefOpenCount((n) => n + 1);
    setPrefModalOpen(true);
  }
  /*
  // NOTE: Unused state variables in DashboardPage. Address & preference form state is handled directly inside <AccountPreferencesModal>. Commented out per Phase 2 Code Review rules.
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [codename, setCodename] = useState('');
  const [prefMessage, setPrefMessage] = useState('');
  const [prefError, setPrefError] = useState('');
  */

  // Operation Creation & Join Modals
  const [createOpModalOpen, setCreateOpModalOpen] = useState(false);
  const [joinOpModalOpen, setJoinOpModalOpen] = useState(false);

  // Pending email invitations (/api/invitations): accept enrolls through the normal join path and
  // opens the mission; decline just removes the card.
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [inviteReload, setInviteReload] = useState(0);
  const signedInUserId = user?.id;


  useEffect(() => {
    if (!signedInUserId) return;
    let cancelled = false;
    fetch('/api/invitations')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setInvitations(json.invitations || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [signedInUserId, inviteReload]);

  // `?start=1` / `?join=1` / `?profile=1` from other pages ("Start a mission", src/lib/auth-flow.ts): once the
  // agent is loaded, open the matching dialog and drop the parameter so a reload does not reopen it.
  useEffect(() => {
    if (!signedInUserId) return;
    const params = new URLSearchParams(window.location.search);
    const start = params.get('start') === '1';
    const join = params.get('join') === '1';
    // `?profile=1`: the Profile tab on other pages (src/components/missions/MissionFrame.tsx).
    const profile = params.get('profile') === '1';
    if (!start && !join && !profile) return;
    params.delete('start');
    params.delete('join');
    params.delete('profile');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (start) setCreateOpModalOpen(true);
    else if (join) setJoinOpModalOpen(true);
    else openPreferences();
  }, [signedInUserId]);

  /** Answers an invitation; `onDone` runs after it succeeds (the bell uses it to clear the notification). */
  async function handleInvitation(inv: PendingInvitation, accept: boolean, onDone?: () => void) {
    setInviteBusyId(inv.id);
    setInviteError('');
    try {
      const res = accept
        ? await fetch('/api/invitations/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationCode: inv.exchange.code }),
          })
        : await fetch('/api/invitations', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invitationId: inv.id, action: 'decline' }),
          });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || (accept ? 'Could not join the mission' : 'Could not decline the invitation'));
      setInviteReload((n) => n + 1);
      onDone?.();
      if (accept) router.push(`/exchange/${inv.exchange.code}`);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invitation update failed');
    } finally {
      setInviteBusyId(null);
    }
  }

  useEffect(() => {
    fetchUserData();
  }, []);

  async function fetchUserData() {
    setLoading(true);
    try {
      const me = await fetchJsonWithRetry('/api/users/me', { onRetry: () => setWakingUp(true) });
      if (me.ok && me.json.authenticated && me.json.user) {
        setUser(me.json.user);
        localStorage.setItem(USER_ID_KEY, me.json.user.id);
        await fetchMissions(me.json.user.id);
      } else if (me.status === 403 && me.json.code === EMAIL_UNVERIFIED_CODE) {
        // Signed in but the email is not verified yet: the dashboard waits behind /verify-email.
        window.location.replace('/verify-email');
        return;
      } else if (me.status === 401 || me.status === 404) {
        // Session expired or signed out: drop the cached identity.
        localStorage.removeItem(USER_ID_KEY);
      }
    } catch {
      console.error('Failed to load user profile');
    } finally {
      setLoading(false);
      setWakingUp(false);
    }
  }

  /** Loads every mission the agent runs or has joined (Head Elves are not always enrolled as members). */
  async function fetchMissions(userId: string) {
    setMissionsError('');
    try {
      const { ok, json } = await fetchJsonWithRetry(`/api/operations?userId=${encodeURIComponent(userId)}`, {
        onRetry: () => setWakingUp(true),
      });
      if (ok && json.success && Array.isArray(json.data)) {
        setMissions(json.data);
        setJoinRequests(Array.isArray(json.joinRequests) ? json.joinRequests : []);
      }
      else setMissionsError(json.error || 'Your missions could not be loaded.');
    } catch {
      setMissionsError('Your missions could not be loaded. Check your connection and try again.');
    }
  }

  /*
  // Handle Account Preferences Save
  async function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    setSavingPref(true);
    setPrefMessage('');
    setPrefError('');

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          name: prefName,
          codename: prefCodename,
          streetAddress: prefAddress,
          city: prefCity,
          state: prefState,
          zipCode: prefZip,
        }),
      });
      const json = await res.json();
      if (json.success && json.user) {
        setUser(json.user);
        setPrefMessage('Preferences updated successfully!');
        setTimeout(() => setPrefModalOpen(false), 800);
      } else {
        setPrefError(json.error || 'Failed to update preferences');
      }
    } catch {
      setPrefError('Failed to update preferences');
    } finally {
      setSavingPref(false);
    }
  }
  */

  const visibleMissions = user
    ? filterMissions(missions, user.id, { query: searchQuery, role: 'ALL', status: 'ALL', hide: DEFAULT_HIDE_PREFS }).filter((m) =>
        chipMatches(chip, m, user.id),
      )
    : [];
  const counts = user ? chipCounts(missions, user.id) : null;

  // Bell notices derived from the profile: a remote Secret Santa mission needs a shipping address.
  const pinnedNotices: PinnedNotice[] = [];
  if (
    user &&
    (!user.streetAddress || !user.city || !user.state || !user.zipCode) &&
    user.participations?.some((p) => {
      const ex = p.exchange || p.mission;
      return ex && !ex.isLocalOnly && !ex.isWhiteElephant;
    })
  ) {
    pinnedNotices.push({
      id: 'shipping-address',
      emoji: '📦',
      title: 'Action Required: Courier Shipping Address Incomplete',
      message: 'You are enrolled in a remote Secret Santa mission. Add your Courier Shipping Address so your Secret Santa can deliver your gift.',
      actionLabel: 'Complete Shipping Address',
      onAction: () => openPreferences('shipping'),
    });
  }

  /** Accept/Decline on an invitation notification while the invitation is still open. */
  function invitationActions(n: NotificationView, dismiss: () => void) {
    const inv = invitations.find((i) => i.exchange.id === n.exchangeId);
    if (!inv) return null;
    const busy = inviteBusyId === inv.id;
    return (
      <>
        <Button onClick={() => handleInvitation(inv, true, dismiss)} variant="primary" disabled={busy} className="px-3 py-1.5 text-[11px]">
          {busy ? 'Working...' : '✅ Accept'}
        </Button>
        <Button onClick={() => handleInvitation(inv, false, dismiss)} variant="secondary" disabled={busy} className="px-3 py-1.5 text-[11px]">
          Decline
        </Button>
      </>
    );
  }

  async function handleSignOut() {
    try {
      await fetch('/api/users/me', { method: 'DELETE' });
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem(USER_ID_KEY);
      localStorage.removeItem('kovertklaus_user_name');
      window.location.href = '/';
    }
  }

  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <>
      <AppShell
        active="missions"
        onProfile={() => openPreferences()}
        onSignOut={handleSignOut}
        alerts={{ pinned: pinnedNotices, actionsFor: invitationActions, reloadKey: inviteReload }}
      >
        <main className="mx-auto max-w-[1200px] px-4 md:px-8 pt-6 md:pt-10 pb-8 md:pb-16 flex flex-col gap-5 md:gap-7">
          {loading ? (
            <div role="status" className="py-20 text-center flex flex-col items-center gap-3">
              <span className="kk-stamp">Opening your files</span>
              {wakingUp && <p className="m-0 text-kk-muted">Waking up the North Pole servers. This can take up to half a minute.</p>}
            </div>
          ) : !user ? (
            <div className="kk-card max-w-xl mx-auto mt-10 flex flex-col items-center text-center gap-3">
              <h1 className="m-0 font-display text-[28px] leading-[34px] font-bold text-kk-heading">You&apos;re signed out</h1>
              <p className="m-0 text-kk-muted">Sign in to see your Holiday Missions.</p>
              <Link href="/signin" className="kk-btn kk-btn--primary">
                <Icon name="key" />
                Sign in
              </Link>
            </div>
          ) : (
            <>
              {/* Heading and main actions */}
              <div className="flex flex-col md:flex-row md:flex-wrap gap-4 md:items-end md:justify-between">
                <div className="flex flex-col gap-1 md:gap-1.5">
                  <p className="eyebrow m-0 uppercase text-kk-muted">{missions.length ? `Welcome back${firstName ? `, ${firstName}` : ''}` : 'Welcome, new agent'}</p>
                  <h1 className="m-0 font-display font-bold text-kk-heading text-balance text-[28px] leading-[34px] md:text-4xl md:leading-10">Your Holiday Missions</h1>
                </div>
                <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2.5 md:gap-3">
                  <button type="button" onClick={() => setCreateOpModalOpen(true)} className="kk-btn kk-btn--primary md:order-2 px-3 md:px-6">
                    <Icon name="plus" />
                    <span className="md:hidden">Start</span>
                    <span className="hidden md:inline">Start a mission</span>
                  </button>
                  <button type="button" onClick={() => setJoinOpModalOpen(true)} className="kk-btn kk-btn--ghost md:order-1 px-3 md:px-6">
                    <Icon name="key" />
                    <span className="md:hidden">Join</span>
                    <span className="hidden md:inline">Join a mission</span>
                  </button>
                </div>
              </div>

              {/* Requests to join by code: waiting for (or declined by) the Head Elf */}
              {joinRequests.map((r) => (
                <div key={r.id} className={`kk-banner ${r.status === 'DECLINED' ? 'kk-banner--danger' : 'kk-banner--warning'} flex-wrap`}>
                  <Icon name={r.status === 'DECLINED' ? 'alert' : 'clock'} size={20} />
                  <span className="flex-1 min-w-[12rem]">
                    <strong>{r.exchange.title}: </strong>
                    {r.status === 'DECLINED'
                      ? 'The Head Elf declined your request. Ask them to invite you by email if this is a mistake.'
                      : 'Waiting for the Head Elf to approve your request to join.'}
                  </span>
                  <Link href={`/exchange/${r.exchange.code}`} className="kk-btn kk-btn--ghost kk-btn--sm">
                    View mission
                  </Link>
                </div>
              ))}

              {/* Pending email invitations */}
              {inviteError && (
                <div role="alert" className="kk-banner kk-banner--danger">
                  <Icon name="alert" size={20} />
                  <span>{inviteError}</span>
                </div>
              )}
              {invitations.map((inv) => (
                <section key={inv.id} className="kk-card flex flex-col md:flex-row md:items-center gap-4 justify-between" aria-label={`Invitation to ${inv.exchange.title}`}>
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="eyebrow m-0 uppercase text-kk-stamp">
                      Invitation{inv.isLatePass ? ' · Late Pass' : ''} from {inv.exchange.organizer.name}
                    </p>
                    <h2 className="m-0 font-display text-[22px] leading-7 font-semibold text-kk-heading break-words">{inv.exchange.title}</h2>
                    <p className="m-0 text-kk-muted text-sm">
                      Budget {formatBudget(inv.exchange.budgetMin, inv.exchange.budgetMax, inv.exchange.currency)} · Exchange Day {sentenceDate(inv.exchange.executionDate)} ·{' '}
                      <Link href={`/exchange/${inv.exchange.code}`}>View mission</Link>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:flex gap-2.5 shrink-0">
                    <button type="button" onClick={() => handleInvitation(inv, true)} disabled={inviteBusyId === inv.id} className="kk-btn kk-btn--primary">
                      <Icon name="check" />
                      {inviteBusyId === inv.id ? 'Working…' : 'Accept'}
                    </button>
                    <button type="button" onClick={() => handleInvitation(inv, false)} disabled={inviteBusyId === inv.id} className="kk-btn kk-btn--ghost">
                      Decline
                    </button>
                  </div>
                </section>
              ))}

              {missionsError ? (
                <div role="alert" className="kk-banner kk-banner--danger flex-wrap">
                  <Icon name="alert" size={20} />
                  <span className="flex-1">{missionsError}</span>
                  <button type="button" onClick={() => fetchMissions(user.id)} className="kk-btn kk-btn--ghost kk-btn--sm">
                    Try again
                  </button>
                </div>
              ) : missions.length === 0 ? (
                /* Empty state (design canvas "Dashboard · no missions yet") */
                <div className="kk-card max-w-[736px] w-full mx-auto flex flex-col items-center text-center gap-3 px-6 md:px-8 py-10 md:py-12">
                  <div className="w-[200px] md:w-[240px] h-[150px] md:h-[180px]">
                    <Illustration name="noMissions" />
                  </div>
                  <h2 className="m-0 font-display text-[28px] leading-[34px] font-bold text-kk-heading">No missions yet</h2>
                  <p className="m-0 text-kk-muted max-w-[30em]">Start one for your family, friends or team, or join with an invite code from your Head Elf.</p>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 justify-center w-full">
                    <button type="button" onClick={() => setCreateOpModalOpen(true)} className="kk-btn kk-btn--primary">
                      <Icon name="plus" />
                      Start a mission
                    </button>
                    <button type="button" onClick={() => setJoinOpModalOpen(true)} className="kk-btn kk-btn--ghost">
                      <Icon name="key" />
                      Join with a code
                    </button>
                  </div>
                  <Link href="/#how-it-works" className="text-sm font-semibold">
                    How a mission runs
                  </Link>
                </div>
              ) : (
                <>
                  {/* Filter chips and search */}
                  <div className="flex flex-col md:flex-row md:flex-wrap gap-3 md:items-center">
                    <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap" role="group" aria-label="Filter missions">
                      {MISSION_CHIPS.filter((c) => c.id !== 'cancelled' || (counts?.cancelled ?? 0) > 0).map((c) => (
                        <button key={c.id} type="button" className="kk-chip" aria-pressed={chip === c.id} onClick={() => setChip(c.id)}>
                          {c.label}
                          {counts && counts[c.id] > 0 ? ` (${counts[c.id]})` : ''}
                        </button>
                      ))}
                    </div>
                    <label className="md:ml-auto relative flex items-center">
                      <span className="absolute left-3 text-kk-muted" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="7" />
                          <path d="M20 20l-4-4" />
                        </svg>
                      </span>
                      <span className="sr-only">Search missions</span>
                      <input type="search" className="kk-field__input w-full md:w-60 pl-10" placeholder="Search missions" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-6 items-start">
                    {/* Mission files */}
                    <div className="w-full min-w-0 grid gap-6 grid-cols-[repeat(auto-fill,minmax(min(100%,380px),1fr))]">
                      {visibleMissions.length === 0 ? (
                        <div className="kk-card text-center flex flex-col items-center gap-2 col-span-full">
                          <h2 className="m-0 font-display text-lg font-semibold text-kk-heading">No missions match</h2>
                          <p className="m-0 text-kk-muted">Try another filter or clear the search.</p>
                        </div>
                      ) : (
                        visibleMissions.map((m) => <MissionFileCard key={m.id} mission={m} />)
                      )}
                    </div>

                  </div>
                </>
              )}
            </>
          )}
        </main>
      </AppShell>

      {/* MODAL: ACCOUNT PREFERENCES */}
      <AccountPreferencesModal
        key={prefOpenCount}
        isOpen={prefModalOpen}
        onClose={() => setPrefModalOpen(false)}
        onProfileUpdated={fetchUserData}
        initialTab={prefTab}
      />

      {/* MODAL: CREATE OPERATION */}
      <CreateOperationModal
        isOpen={createOpModalOpen}
        onClose={() => setCreateOpModalOpen(false)}
        userId={user?.id}
        onSuccess={() => fetchUserData()}
      />

      {/* MODAL: JOIN OPERATION */}
      <JoinOperationModal
        isOpen={joinOpModalOpen}
        onClose={() => setJoinOpModalOpen(false)}
        userId={user?.id}
        onSuccess={() => fetchUserData()}
      />
    </>
  );
}
