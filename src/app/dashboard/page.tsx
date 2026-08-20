'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCodename, formatDateString, getNextMilestoneCountdown } from '@/lib/security';
import { useTheme } from '@/context/ThemeContext';
import { Card, SectionHeader, Button, Badge, DataRow } from '@/components/ui';
import { AccountPreferencesModal } from '@/components/AccountPreferencesModal';
import { CreateOperationModal } from '@/components/CreateOperationModal';
import { JoinOperationModal } from '@/components/JoinOperationModal';

interface OpKit {
  id: string;
  name: string;
  isMaster: boolean;
  type: 'WISHLIST' | 'WHITE_ELEPHANT';
  createdAt: string;
  opTools: Array<{ id: string; title: string; price?: number; url: string; thumbnail?: string }>;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  codename?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  demerits: number;
  accountStatus: string;
  wishlists: OpKit[];
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
    };
  }>;
  notifications?: Array<{
    id: string;
    title: string;
    message: string;
    operationId?: string;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isDarkMode, toggleTheme, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);

  // Edit Preferences Modal
  const [prefModalOpen, setPrefModalOpen] = useState(false);
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

  // OpKit Creation Modal
  const [createOpKitModalOpen, setCreateOpKitModalOpen] = useState(false);
  const [newOpKitName, setNewOpKitName] = useState('');
  const [newOpKitType, setNewOpKitType] = useState<'WISHLIST' | 'WHITE_ELEPHANT'>('WISHLIST');

  // Operation Creation & Join Modals
  const [createOpModalOpen, setCreateOpModalOpen] = useState(false);
  const [joinOpModalOpen, setJoinOpModalOpen] = useState(false);

  // Inline OpKit Rename State
  const [editingOpKitId, setEditingOpKitId] = useState<string | null>(null);
  const [editingOpKitName, setEditingOpKitName] = useState('');

  useEffect(() => {
    fetchUserData();
  }, []);

  async function fetchUserData() {
    setLoading(true);
    const savedUserId = localStorage.getItem('kovertklaus_user_id');

    try {
      const url = savedUserId ? `/api/users/me?userId=${savedUserId}` : '/api/users/me';
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || (!json.success && !json.authenticated) || !json.user) {
        localStorage.removeItem('kovertklaus_user_id');
        localStorage.removeItem('kovertklaus_user_name');
        router.push('/');
        return;
      }

      localStorage.setItem('kovertklaus_user_id', json.user.id);
      localStorage.setItem('kovertklaus_user_name', json.user.name);
      setUser(json.user);
      /*
      // NOTE: Unneeded state updates in DashboardPage. Address data is fetched and populated inside <AccountPreferencesModal>. Commented out per Phase 2 Code Review rules.
      setStreetAddress(json.user.streetAddress || '');
      setCity(json.user.city || '');
      setState(json.user.state || '');
      setZipCode(json.user.zipCode || '');
      setCodename(json.user.codename || '');
      */
    } catch {
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  /*
  // NOTE: Currently uncalled helper function inside DashboardPage. Account preference updates are delegated to <AccountPreferencesModal>. Commented out per Phase 2 Code Review rules.
  async function handleUpdatePreferences(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setPrefMessage('');
    setPrefError('');

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          streetAddress,
          city,
          state,
          zipCode,
          codename,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update preferences');
      }

      setPrefMessage('Preferences updated successfully!');
      fetchUserData();
    } catch (err: any) {
      setPrefError(err.message || 'Update failed');
    }
  }
  */

  // Create Quick OpKit
  async function handleCreateQuickOpKit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newOpKitName.trim()) return;

    try {
      const res = await fetch('/api/opkits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: newOpKitName.trim(),
          type: newOpKitType,
        }),
      });
      const json = await res.json();
      if (json.success && json.opKit) {
        setUser((prev) => (prev ? { ...prev, wishlists: [...prev.wishlists, json.opKit] } : prev));
      }
    } catch {
      console.error('Failed to create OpKit');
    } finally {
      setNewOpKitName('');
      setCreateOpKitModalOpen(false);
    }
  }

  // Handle Quick Inline OpKit Rename
  async function handleRenameQuickOpKit(id: string) {
    if (!editingOpKitName.trim() || !user) return;
    const cleanName = editingOpKitName.trim();
    setEditingOpKitId(null);
    setEditingOpKitName('');

    try {
      await fetch('/api/opkits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          wishlistId: id,
          name: cleanName,
        }),
      });
      setUser({
        ...user,
        wishlists: user.wishlists.map((k) =>
          k.id === id ? { ...k, name: cleanName } : k
        ),
      });
    } catch {
      console.error('Failed to rename OpKit');
    }
  }

  // Accept Operation Invitation Alert
  async function handleAcceptInvite(code: string) {
    if (!user) return;
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, operationCode: code }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchUserData();
        router.push(`/exchange/${code}`);
      } else {
        alert(json.error || 'Failed to accept invitation');
      }
    } catch {
      alert('Failed to accept invitation');
    }
  }

  // Capped OpKits (Max 3 items, Master Pinned First)
  const recentOpKits = user?.wishlists
    ? [...user.wishlists]
        .sort((a, b) => (b.isMaster ? 1 : 0) - (a.isMaster ? 1 : 0))
        .slice(0, 3)
    : [];

  // Capped Operations (Max 3 most recent active operations)
  const recentParticipations = user?.participations
    ? [...user.participations].slice(0, 3)
    : [];

  async function handleSignOut() {
    try {
      await fetch('/api/users/me', { method: 'DELETE' });
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('kovertklaus_user_id');
      localStorage.removeItem('kovertklaus_user_name');
      window.location.href = '/';
    }
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${theme.pageBg}`}>
      
      {/* Top Header Navigation */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md ${theme.headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-white text-xl shadow-md ${
              isDarkMode ? 'bg-gradient-to-br from-sky-400 to-slate-700' : 'bg-gradient-to-br from-red-600 to-emerald-800'
            }`}>
              🎁
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block">KovertKlaus</span>
              <span className={`text-xs font-bold ${theme.textBrand}`}>
                Operative Dashboard
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${theme.btnToggle}`}
            >
              {isDarkMode ? '🎅 Klaus Mode' : '🕶️ Kovert Mode'}
            </button>

            <button
              onClick={handleSignOut}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer ${theme.btnNeutral}`}
            >
              Sign Out
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
                  <span className="text-xs text-slate-500 font-mono">
                    Coal Citations: <strong className={user.demerits > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-sky-400'}>{user.demerits}/3</strong>
                  </span>
                </div>

                <h1 className="text-3xl font-black">
                  Welcome Back, {formatCodename(user.codename, user.name)}
                </h1>
                <p className={`text-xs mt-1 ${theme.textSubLabel}`}>
                  Logged in as: <strong className={theme.textLabel}>{user.email}</strong> | Full Name: <strong className={theme.textLabel}>{user.name}</strong>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPrefModalOpen(true)}
                  className={`px-5 py-3 rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer ${theme.btnSecondary}`}
                >
                  ⚙️ Account Preferences
                </button>
              </div>
            </div>

            {/* In-App Operation Invitation Alerts */}
            {user.notifications && user.notifications.length > 0 && (
              <div className="space-y-3">
                {user.notifications.map((notif) => {
                  const codeMatch = notif.message.match(/Code:\s*([A-Z0-9-]{8,16})/i);
                  const code = codeMatch ? codeMatch[1] : null;

                  return (
                    <div
                      key={notif.id}
                      className={`p-5 sm:p-6 rounded-3xl border shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${theme.cardBg} border-amber-500/50`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">📩</span>
                        <div>
                          <h4 className="font-extrabold text-sm">{notif.title}</h4>
                          <p className={`text-xs mt-0.5 ${theme.textSubLabel}`}>
                            {notif.message}
                          </p>
                        </div>
                      </div>
                      {code && (
                        <button
                          onClick={() => handleAcceptInvite(code)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold shadow-md cursor-pointer whitespace-nowrap transition-all ${theme.btnPrimary}`}
                        >
                          🚀 Accept & Enlist
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Courier Shipping Address Incomplete Warning Banner */}
            {(!user.streetAddress || !user.city || !user.state || !user.zipCode) &&
              user.participations?.some((p) => {
                const ex = p.exchange || p.mission;
                return ex && !ex.isLocalOnly && !ex.isWhiteElephant;
              }) && (
                <div className={`p-5 sm:p-6 rounded-3xl border shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${theme.alertWarning}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📦</span>
                    <div>
                      <h4 className="font-extrabold text-sm">Action Required: Courier Shipping Address Incomplete</h4>
                      <p className="text-xs mt-0.5 opacity-90">
                        You are enrolled in an active remote Secret Santa operation. Provide your Courier Shipping Address so your assigned Secret Santa can deliver your gifts!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPrefModalOpen(true)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer whitespace-nowrap transition-all ${theme.btnPrimary}`}
                  >
                    ⚙️ Complete Shipping Address
                  </button>
                </div>
            )}

            {/* Section 1: Active Operations (Exchanges) */}
            <Card variant="section" className="space-y-6">
              <SectionHeader
                title="🎯 Active Operations (Exchanges)"
                subtitle="Gift exchanges you are currently organizing or participating in — Showing 3 most recent."
                primaryAction={
                  <div className="flex items-center gap-2">
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

              {/* Operations Cards Grid */}
              {recentParticipations.length === 0 ? (
                <Card className="text-center py-8">
                  <div className="text-3xl mb-2">🎁</div>
                  <h3 className="text-base font-bold mb-1">No Active Operations</h3>
                  <p className="text-xs text-slate-500 mb-4">
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
                            <Badge variant={ex.isWhiteElephant ? 'white-elephant' : 'secret-santa'}>
                              ● {countdown.phaseStatusLabel}
                            </Badge>
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

                            <div className="flex justify-between items-center pt-2 border-t border-stone-200/80 dark:border-slate-800/80">
                              <span className={`flex items-center gap-1 ${theme.textLabel}`}>
                                ⏳ {countdown.milestoneLabel}:
                              </span>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                                countdown.isToday
                                  ? theme.badgeCountdownToday
                                  : countdown.daysLeft <= 7 && !countdown.isPast
                                  ? theme.badgeCountdownUrgent
                                  : theme.badgeCountdown
                              }`}>
                                {countdown.formattedText}
                              </span>
                            </div>
                          </Card>
                        </div>

                        <div className="mt-6 flex items-center justify-between gap-2 pt-3 border-t border-stone-200 dark:border-slate-800">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-xs ${theme.textLabel}`}>Role:</span>
                            <Badge variant={p.role === 'ORGANIZER' || p.role === 'OPS_LEADER' ? 'opsleader' : 'code'}>
                              {p.role === 'ORGANIZER' || p.role === 'OPS_LEADER' ? '⭐ Head Elf' : '🕵️ Elf Agent'}
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

            {/* Section 2: Wishlists & Gifts Inventory (3 Most Recent Limit) */}
            <Card variant="section" className="space-y-6">
              <SectionHeader
                title="🧰 Wishlist Manifests"
                subtitle="Create & manage your wishlist manifests and wished-for manifest items — Showing 3 most recent."
                primaryAction={
                  <Button onClick={() => setCreateOpKitModalOpen(true)} variant="primary">
                    + New Wishlist Manifest
                  </Button>
                }
                secondaryAction={
                  <Button href="/opkits" variant="toggle">
                    ⚙️ Manage All Wishlist Manifests →
                  </Button>
                }
              />

              {/* OpKits Display Grid */}
              {recentOpKits.length === 0 ? (
                <div className={`p-8 text-center rounded-3xl border ${theme.cardBg}`}>
                  <div className="text-3xl mb-2">🧰</div>
                  <h3 className="text-base font-bold mb-1">No OpKits Created Yet</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Create your first OpKit wishlist to add wished-for gift items for your Secret Santa.
                  </p>
                  <button
                    onClick={() => setCreateOpKitModalOpen(true)}
                    className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-md ${theme.btnPrimary}`}
                  >
                    + Create OpKit Wish List
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recentOpKits.map((kit) => (
                  <div
                    key={kit.id}
                    className={`p-6 rounded-3xl border shadow-md flex flex-col justify-between transition-all ${theme.cardBg}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{kit.isMaster ? '⭐' : kit.type === 'WHITE_ELEPHANT' ? '🐘' : '🎁'}</span>
                          {kit.isMaster && (
                            <span className="text-[10px] bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 font-bold px-2 py-0.5 rounded-full">
                              Master OpKit
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingOpKitId(kit.id);
                              setEditingOpKitName(kit.name);
                            }}
                            title="Click to Rename OpKit"
                            className={`px-2.5 py-1 text-xs rounded-lg flex items-center gap-1 font-semibold border transition-all cursor-pointer shadow-xs ${theme.btnNeutral}`}
                          >
                            <span>✏️</span>
                            <span className="text-[10px] font-bold">Rename</span>
                          </button>
                        </div>
                      </div>

                      {editingOpKitId === kit.id ? (
                        <input
                          type="text"
                          value={editingOpKitName}
                          onChange={(e) => setEditingOpKitName(e.target.value)}
                          onBlur={() => handleRenameQuickOpKit(kit.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameQuickOpKit(kit.id)}
                          autoFocus
                          className={`w-full border rounded-xl px-3 py-1.5 text-sm font-bold ${theme.inputModalBg}`}
                        />
                      ) : (
                        <h3 className="text-lg font-black">{kit.name}</h3>
                      )}

                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase inline-block mt-1 ${
                        kit.type === 'WHITE_ELEPHANT' ? theme.badgeWhiteElephant : theme.badgeSecretSanta
                      }`}>
                        {kit.type === 'WHITE_ELEPHANT' ? '🐘 White Elephant' : '🎁 Secret Santa'}
                      </span>

                      <div className={`mt-4 p-4 rounded-2xl border space-y-2 ${theme.cardInnerBg}`}>
                        <div className="flex justify-between items-center text-xs">
                          <span className={theme.textLabel}>Attached OpTools:</span>
                          <strong className={theme.textAccent}>{kit.opTools?.length || 0} Items</strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-end pt-3 border-t border-stone-200 dark:border-slate-800">
                      <Link
                        href="/opkits"
                        className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${theme.btnPrimary}`}
                      >
                        Manage OpTools →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </Card>

          </>
        ) : null}

      </main>

      {/* MODAL: ACCOUNT PREFERENCES */}
      <AccountPreferencesModal
        isOpen={prefModalOpen}
        onClose={() => setPrefModalOpen(false)}
        onProfileUpdated={fetchUserData}
      />

      {/* MODAL: CREATE QUICK OPKIT */}
      {createOpKitModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full transition-all ${theme.modalBg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>🧰 Create Quick OpKit</span>
              </h3>
              <button onClick={() => setCreateOpKitModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleCreateQuickOpKit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">OpKit Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Holiday Exchange 2026"
                  value={newOpKitName}
                  onChange={(e) => setNewOpKitName(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Category Type *</label>
                <select
                  value={newOpKitType}
                  onChange={(e) => setNewOpKitType(e.target.value as 'WISHLIST' | 'WHITE_ELEPHANT')}
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${theme.inputModalBg}`}
                >
                  <option value="WISHLIST">🎁 Secret Santa Wishlist (Unlimited OpTools)</option>
                  <option value="WHITE_ELEPHANT">🐘 White Elephant Brought Gift (Strictly 1 OpTool)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpKitModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${theme.btnNeutral}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${theme.btnPrimary}`}
                >
                  Create OpKit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
