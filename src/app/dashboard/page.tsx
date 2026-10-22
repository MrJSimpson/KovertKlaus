'use client';

import { USER_ID_KEY } from '@/lib/constants/auth';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDateString, getNextMilestoneCountdown } from '@/lib/security';
import { countdownBadgeClass, statusBadgeClass } from '@/lib/stage-colors';
import { useTheme } from '@/context/ThemeContext';
import { Card, SectionHeader, Button, Badge, DataRow } from '@/components/ui';
import { AccountPreferencesModal, type PreferencesTab } from '@/components/AccountPreferencesModal';
import { CreateOperationModal } from '@/components/CreateOperationModal';
import { JoinOperationModal } from '@/components/JoinOperationModal';
import { NotificationBell, type PinnedNotice } from '@/components/NotificationBell';
import { WhatsNewButton } from '@/components/WhatsNewButton';
import type { NotificationView } from '@/lib/notifications';

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
  const { isDarkMode, toggleTheme, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);

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
    const savedUserId = localStorage.getItem(USER_ID_KEY);

    try {
      if (savedUserId) {
        const res = await fetch(`/api/users/me?userId=${savedUserId}`);
        const json = await res.json();
        if (json.authenticated && json.user) {
          setUser(json.user);
          setLoading(false);
          return;
        }
      }

      // Dev mock fallback if no stored operative ID
      const res = await fetch('/api/users/me');
      const json = await res.json();
      if (json.authenticated && json.user) {
        setUser(json.user);
        localStorage.setItem(USER_ID_KEY, json.user.id);
      } else {
        // Session expired or signed out: drop the cached identity.
        localStorage.removeItem(USER_ID_KEY);
      }
    } catch {
      console.error('Failed to load user profile');
    } finally {
      setLoading(false);
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

  // Capped Operations (Max 3 most recent active operations)
  const recentParticipations = user?.participations
    ? [...user.participations].slice(0, 3)
    : [];

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

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${theme.pageBg}`}>
      
      {/* Top Header Navigation */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md ${theme.headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center font-extrabold text-lg sm:text-xl shadow-md shrink-0 bg-kk-primary text-kk-on-primary border border-kk-border-strong">
              🎁
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black tracking-tight block">KovertKlaus</span>
              <span className={`text-[10px] sm:text-xs font-bold hidden sm:block ${theme.textGoldOnDark}`}>
                Operative Dashboard
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {user && (
              <NotificationBell
                pinned={pinnedNotices}
                actionsFor={invitationActions}
                reloadKey={inviteReload}
                className={`text-xs font-bold px-3 py-2 min-h-[44px] min-w-[44px] justify-center rounded-xl border transition-all ${theme.btnToggle}`}
              />
            )}
            <WhatsNewButton
              compact
              className={`text-xs font-bold px-3 py-2 min-h-[44px] min-w-[44px] justify-center rounded-xl border transition-all ${theme.btnToggle}`}
            />
            <button
              onClick={toggleTheme}
              className={`p-2 min-h-[44px] min-w-[44px] rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center ${theme.btnToggle}`}
              title={isDarkMode ? 'Switch to Klaus Mode' : 'Switch to Kovert Mode'}
            >
              <span className="sm:hidden text-base">{isDarkMode ? '🎅' : '🕶️'}</span>
              <span className="hidden sm:inline">{isDarkMode ? '🎅 Klaus Mode' : '🕶️ Kovert Mode'}</span>
            </button>

            <button
              onClick={handleSignOut}
              className={`text-xs font-bold px-3 sm:px-4 py-2 min-h-[44px] flex items-center rounded-xl transition-all shadow-sm cursor-pointer ${theme.btnNeutral}`}
            >
              <span className="sm:hidden">Exit</span>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
        
        {loading ? (
          <div className="text-center py-20">
            <div className="text-4xl animate-bounce mb-3">🎁</div>
            <p className="text-sm font-semibold">Loading Operative Profile Data...</p>
          </div>
        ) : user ? (
          <>
            {/* Operative Welcome Banner */}
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${theme.cardBg}`}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${theme.badgeCode}`}>
                    OPERATIVE STATUS: ACTIVE
                  </span>
                  <span className="text-xs text-kk-muted font-mono">
                    Coal Citations: <strong className={user.demerits > 0 ? 'text-kk-danger' : 'text-kk-brand'}>{user.demerits}/3</strong>
                  </span>
                </div>

                <h1 className="text-3xl font-black">
                  Welcome Back, {user.name}
                </h1>
                <p className={`text-xs mt-1 ${theme.textSubLabel}`}>
                  Logged in as: <strong className={theme.textLabel}>{user.email}</strong> | Full Name: <strong className={theme.textLabel}>{user.name}</strong>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => openPreferences()}
                  className={`px-5 py-3 rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer ${theme.btnSecondary}`}
                >
                  ⚙️ Account Preferences
                </button>
              </div>
            </div>

            {/* Section 1: Active Operations (Exchanges) */}
            <Card variant="section" className="space-y-6">
              <SectionHeader
                title="🎯 Active Operations (Exchanges)"
                subtitle="Gift exchanges you are currently organizing or participating in — Showing 3 most recent."
                primaryAction={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => setJoinOpModalOpen(true)} variant="secondary">
                      🕵️ Join Exchange
                    </Button>
                    <Button onClick={() => setCreateOpModalOpen(true)} variant="primary">
                      + New Exchange
                    </Button>
                  </div>
                }
                secondaryAction={<Button href="/operations" variant="toggle">⚙️ Manage All Operations →</Button>}
              />

              {/* Pending email invitations */}
              {invitations.length > 0 && (
                <div className="mb-6 space-y-3">
                  {inviteError && <p className="text-xs font-bold text-kk-danger">⚠️ {inviteError}</p>}
                  {invitations.map((inv) => (
                    <Card key={inv.id} className="border-kk-border-strong">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-kk-gold-ink">
                            📩 Invitation{inv.isLatePass ? ' · Late Pass' : ''} from {inv.exchange.organizer.name}
                          </span>
                          <h3 className="text-base font-bold">{inv.exchange.title}</h3>
                          <p className="text-xs text-kk-muted">
                            Budget ${inv.exchange.budgetMin || 0}–${inv.exchange.budgetMax} {inv.exchange.currency} · Exchange Day {formatDateString(inv.exchange.executionDate)} ·{' '}
                            <Link href={`/exchange/${inv.exchange.code}`} className="underline">View mission</Link>
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button onClick={() => handleInvitation(inv, true)} variant="primary" disabled={inviteBusyId === inv.id}>
                            {inviteBusyId === inv.id ? 'Working...' : '✅ Accept'}
                          </Button>
                          <Button onClick={() => handleInvitation(inv, false)} variant="secondary" disabled={inviteBusyId === inv.id}>
                            Decline
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Operations Cards Grid */}
              {recentParticipations.length === 0 ? (
                <Card className="text-center py-8">
                  <div className="text-3xl mb-2">🎁</div>
                  <h3 className="text-base font-bold mb-1">No Active Operations</h3>
                  <p className="text-xs text-kk-muted mb-4">
                    You haven't joined or created any secret santa gift exchanges yet.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button onClick={() => setCreateOpModalOpen(true)} variant="primary">
                      + Organize New Exchange
                    </Button>
                    <Button onClick={() => setJoinOpModalOpen(true)} variant="secondary">
                      🕵️ Join via Invite Code
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recentParticipations.map((p) => {
                    const ex = p.exchange || p.mission;
                    if (!ex) return null;
                    const countdown = getNextMilestoneCountdown(ex);
                    return (
                      <Card
                        key={p.id}
                        className="flex flex-col justify-between hover:shadow-xl"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="code">CODE: {ex.code}</Badge>
                            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase inline-flex items-center gap-1 ${statusBadgeClass(countdown)}`}>
                              ● {countdown.phaseStatusLabel}
                            </span>
                          </div>

                          <h3 className="text-xl font-black mt-2">{ex.title}</h3>
                          
                          <Card variant="inner" className="mt-3 space-y-1.5 text-xs">
                            <DataRow
                              label="Budget Range"
                              value={`$${ex.budgetMin || 0} – $${ex.budgetMax} ${ex.currency}`}
                              valueVariant="accent"
                            />
                            <DataRow
                              label="Exchange Day"
                              value={formatDateString(ex.executionDate)}
                              valueVariant="date"
                            />

                            <div className="flex justify-between items-center pt-2 border-t border-kk-border">
                              <span className={`flex items-center gap-1 ${theme.textLabel}`}>
                                ⏳ {countdown.milestoneLabel}:
                              </span>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${countdownBadgeClass(countdown)}`}>
                                {countdown.formattedText}
                              </span>
                            </div>
                          </Card>
                        </div>

                        <div className="mt-6 flex items-center justify-between gap-2 pt-3 border-t border-kk-border">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-xs ${theme.textLabel}`}>Role:</span>
                            <Badge variant={ex?.organizerId === user.id ? 'opsleader' : 'code'}>
                              {ex?.organizerId === user.id ? '⭐ Head Elf' : '🕵️ Elf Agent'}
                            </Badge>
                          </div>

                          <Button
                            href={`/exchange/${ex.code}`}
                            variant="primary"
                            className="px-3 py-2 text-[11px] font-extrabold whitespace-nowrap shrink-0"
                          >
                            Command Center →
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Card>

          </>
        ) : null}

      </main>

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

    </div>
  );
}
