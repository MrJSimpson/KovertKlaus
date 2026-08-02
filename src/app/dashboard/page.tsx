'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCodename, formatDateString, getNextMilestoneCountdown } from '@/lib/security';
import { getThemeClasses } from '@/lib/theme';

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
    mission: {
      id: string;
      title: string;
      code: string;
      status: string;
      giftingType: string;
      isWhiteElephant: boolean;
      budgetMin?: number;
      budgetMax: number;
      currency: string;
      executionDate: string;
    };
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);

  // Edit Preferences Modal
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [codename, setCodename] = useState('');
  const [prefMessage, setPrefMessage] = useState('');
  const [prefError, setPrefError] = useState('');

  // OpKit Creation Modal
  const [createOpKitModalOpen, setCreateOpKitModalOpen] = useState(false);
  const [newOpKitName, setNewOpKitName] = useState('');
  const [newOpKitType, setNewOpKitType] = useState<'WISHLIST' | 'WHITE_ELEPHANT'>('WISHLIST');

  // Inline OpKit Rename State
  const [editingOpKitId, setEditingOpKitId] = useState<string | null>(null);
  const [editingOpKitName, setEditingOpKitName] = useState('');

  const theme = getThemeClasses(isDarkMode);

  useEffect(() => {
    fetchUserData();
  }, []);

  async function fetchUserData() {
    setLoading(true);
    const userId = localStorage.getItem('kovertklaus_user_id');

    if (!userId) {
      router.push('/');
      return;
    }

    try {
      const res = await fetch(`/api/users/me?userId=${userId}`);
      const json = await res.json();
      if (!res.ok || (!json.success && !json.authenticated) || !json.user) {
        localStorage.removeItem('kovertklaus_user_id');
        router.push('/');
        return;
      }

      setUser(json.user);
      setStreetAddress(json.user.streetAddress || '');
      setCity(json.user.city || '');
      setState(json.user.state || '');
      setZipCode(json.user.zipCode || '');
      setCodename(json.user.codename || '');
    } catch {
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  // Update Account & Address Preferences
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

  // Capped OpKits (Max 5 items, Master Pinned First)
  const recentOpKits = user?.wishlists
    ? [...user.wishlists]
        .sort((a, b) => (b.isMaster ? 1 : 0) - (a.isMaster ? 1 : 0))
        .slice(0, 5)
    : [];

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
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${theme.btnToggle}`}
            >
              {isDarkMode ? '🎄 Light' : '❄️ Dark (Icy)'}
            </button>

            <button
              onClick={() => {
                localStorage.removeItem('kovertklaus_user_id');
                router.push('/');
              }}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${theme.btnNeutral}`}
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
                    Demerits: <strong className={user.demerits > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-sky-400'}>{user.demerits}/3</strong>
                  </span>
                </div>

                <h1 className="text-3xl font-black">
                  Welcome Back, {formatCodename(user.codename, user.name)}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Logged in as: <strong>{user.email}</strong> | Full Name: <strong>{user.name}</strong>
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

            {/* Section 1: Active Operations (Exchanges) */}
            <section className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${theme.sectionFrame}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-stone-200/80 dark:border-slate-800">
                <div>
                  <h2 className="text-2xl font-black flex items-center gap-2">
                    🎯 Active Operations (Exchanges)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Gift exchanges you are currently organizing or participating in as an assigned Field Agent.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/operations"
                    className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all ${theme.btnToggle}`}
                  >
                    ⚙️ Manage All Operations →
                  </Link>

                  <Link
                    href="/"
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer ${theme.btnPrimary}`}
                  >
                    + New Exchange
                  </Link>
                </div>
              </div>

              {/* Operations Cards Grid */}
              {user.participations.length === 0 ? (
                <div className={`p-8 text-center rounded-3xl border ${theme.cardBg}`}>
                  <div className="text-3xl mb-2">🎁</div>
                  <h3 className="text-base font-bold mb-1">No Active Operations</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    You haven't joined or created any secret santa gift exchanges yet.
                  </p>
                  <Link
                    href="/"
                    className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-md ${theme.btnPrimary}`}
                  >
                    Organize or Join an Exchange
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {user.participations.map((p) => {
                    const countdown = getNextMilestoneCountdown(p.mission);
                    return (
                      <div
                        key={p.id}
                        className={`p-6 rounded-3xl border shadow-md flex flex-col justify-between transition-all hover:shadow-xl ${theme.cardBg}`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${theme.badgeCode}`}>
                              CODE: {p.mission.code}
                            </span>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                              p.mission.isWhiteElephant ? theme.badgeWhiteElephant : theme.badgeSecretSanta
                            }`}>
                              ● {countdown.phaseStatusLabel}
                            </span>
                          </div>

                          <h3 className="text-xl font-black mt-2">{p.mission.title}</h3>
                          
                          <div className={`mt-3 p-3.5 rounded-2xl border space-y-1.5 text-xs ${theme.cardInnerBg}`}>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Budget Range:</span>
                              <strong className={theme.textAccent}>
                                ${p.mission.budgetMin || 0} – ${p.mission.budgetMax} {p.mission.currency}
                              </strong>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Exchange Day:</span>
                              <strong className={theme.textDate}>
                                {formatDateString(p.mission.executionDate)}
                              </strong>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-stone-200/80 dark:border-slate-800/80">
                              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
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
                          </div>
                        </div>

                        <div className="mt-6 flex items-center justify-between pt-3 border-t border-stone-200 dark:border-slate-800">
                          <span className="text-xs font-semibold text-slate-500">
                            Role: <strong className="text-slate-900 dark:text-slate-100 font-bold">{p.role === 'OPS_LEADER' ? 'OpsLeader' : 'Agent'}</strong>
                          </span>

                          <Link
                            href={`/exchange/${p.mission.code}`}
                            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${theme.btnPrimary}`}
                          >
                            Open Command Center →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Section 2: OpKits & OpTools Inventory (5 Most Recent Limit) */}
            <section className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${theme.sectionFrame}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-stone-200/80 dark:border-slate-800">
                <div>
                  <h2 className="text-2xl font-black flex items-center gap-2">
                    🧰 OpKits (Wish Lists)
                  </h2>
                  <p className="text-xs text-slate-500">
                    (OpKit = Wish List | OpTool = Gift Item) — Showing 5 most recent OpKits.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCreateOpKitModalOpen(true)}
                    className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all ${theme.btnToggle}`}
                  >
                    + Quick OpKit
                  </button>

                  <Link
                    href="/opkits"
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer ${theme.btnPrimary}`}
                  >
                    ⚙️ Manage All OpKits →
                  </Link>
                </div>
              </div>

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
                            title="Quick Edit OpKit Name"
                            className="p-1 text-xs hover:bg-stone-100 dark:hover:bg-slate-800 rounded-md"
                          >
                            ✏️
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
                          <span className="text-slate-400">Attached OpTools:</span>
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
            </section>

          </>
        ) : null}

      </main>

      {/* MODAL: ACCOUNT PREFERENCES */}
      {prefModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full transition-all max-h-[90vh] overflow-y-auto ${theme.modalBg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>⚙️ Account Preferences</span>
              </h3>
              <button onClick={() => setPrefModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            {prefMessage && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertSuccess}`}>
                ✓ {prefMessage}
              </div>
            )}

            {prefError && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertError}`}>
                ⚠️ {prefError}
              </div>
            )}

            <form onSubmit={handleUpdatePreferences} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">Codename / Handle (Will be prefixed with Agent-)</label>
                <input
                  type="text"
                  placeholder="e.g. Agent-KovertKlaus"
                  value={codename}
                  onChange={(e) => setCodename(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div className="pt-2 border-t border-stone-200 dark:border-slate-800">
                <span className={`text-xs font-bold block mb-2 ${theme.textAccent}`}>
                  📦 Default Courier Shipping Address
                </span>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-500 mb-1">Street Address</label>
                    <input
                      type="text"
                      placeholder="123 Holly Lane"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="block text-slate-500 mb-1">City</label>
                      <input
                        type="text"
                        placeholder="Tacoma"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">State</label>
                      <input
                        type="text"
                        placeholder="WA"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Zip Code</label>
                      <input
                        type="text"
                        placeholder="98402"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPrefModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${theme.btnNeutral}`}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${theme.btnPrimary}`}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

    </div>
  );
}
