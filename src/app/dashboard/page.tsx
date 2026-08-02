'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCodename } from '@/lib/security';

interface UserData {
  id: string;
  email: string;
  name: string;
  codename?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  emailNotifications?: boolean;
  demerits: number;
  accountStatus: string;
  participations: Array<{
    id: string;
    role: string;
    shippingStatus: string;
    mission: {
      id: string;
      title: string;
      code: string;
      budgetMin?: number;
      budgetMax: number;
      currency: string;
      executionDate: string;
      status: string;
      opsLeader: {
        name: string;
        codename?: string;
      };
    };
  }>;
}

export default function UserDashboardPage() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);

  // Preferences Modal State
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefMessage, setPrefMessage] = useState('');
  const [prefError, setPrefError] = useState('');

  // Form Fields for Account Preferences
  const [editName, setEditName] = useState('');
  const [editCodename, setEditCodename] = useState('');
  const [editNotifications, setEditNotifications] = useState(true);
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Scraper & Wishlist State (OpKit / OpTools)
  const [opToolUrl, setOpToolUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [opTools, setOpTools] = useState<Array<{ id: string; title: string; price?: number; url: string; thumbnail?: string }>>([]);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  async function fetchUserProfile() {
    setLoading(true);
    try {
      const res = await fetch('/api/users/me');
      const json = await res.json();
      if (!res.ok || !json.authenticated) {
        const savedId = localStorage.getItem('kovertklaus_user_id');
        const savedName = localStorage.getItem('kovertklaus_user_name');
        if (savedId) {
          const fallbackUser = {
            id: savedId,
            email: 'joshua@example.com',
            name: savedName || 'Agent',
            codename: 'Agent-9867',
            demerits: 0,
            accountStatus: 'ACTIVE',
            emailNotifications: true,
            participations: [],
          };
          setUser(fallbackUser);
          populateForm(fallbackUser);
        } else {
          router.push('/');
        }
      } else {
        setUser(json.user);
        populateForm(json.user);
      }
    } catch {
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  function populateForm(u: UserData) {
    setEditName(u.name || '');
    setEditCodename(u.codename || '');
    setEditNotifications(u.emailNotifications ?? true);
    setStreetAddress(u.streetAddress || '');
    setCity(u.city || '');
    setState(u.state || '');
    setZipCode(u.zipCode || '');
  }

  async function handleUpdatePreferences(e: React.FormEvent) {
    e.preventDefault();
    setPrefLoading(true);
    setPrefMessage('');
    setPrefError('');

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          codename: editCodename,
          emailNotifications: editNotifications,
          streetAddress,
          city,
          state,
          zipCode,
          oldPassword: oldPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update preferences');
      }

      setUser((prev) => (prev ? { ...prev, ...json.user } : json.user));
      setPrefMessage('Account preferences saved successfully!');
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPrefError(err.message || 'Update failed');
    } finally {
      setPrefLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/users/me', { method: 'DELETE' });
    localStorage.removeItem('kovertklaus_user_id');
    localStorage.removeItem('kovertklaus_user_name');
    router.push('/');
  }

  // Handle Scraper for Master OpKit (Wishlist) & OpTools (Gift Items)
  async function handleScrapeUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!opToolUrl.trim()) return;

    setScraping(true);
    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: opToolUrl.trim() }),
      });
      const json = await res.json();
      if (json.success && json.metadata) {
        const item = {
          id: Math.random().toString(36).substring(2, 9),
          title: json.metadata.title || 'OpTool Gift Item',
          price: json.metadata.price,
          thumbnail: json.metadata.thumbnail,
          url: opToolUrl.trim(),
        };
        setOpTools((prev) => [...prev, item]);
        setOpToolUrl('');
      } else {
        setOpTools((prev) => [
          ...prev,
          { id: Math.random().toString(36).substring(2, 9), title: opToolUrl, url: opToolUrl },
        ]);
        setOpToolUrl('');
      }
    } catch {
      setOpTools((prev) => [
        ...prev,
        { id: Math.random().toString(36).substring(2, 9), title: opToolUrl, url: opToolUrl },
      ]);
      setOpToolUrl('');
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${
      isDarkMode
        ? 'bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950'
        : 'bg-stone-50 text-slate-900 selection:bg-red-600 selection:text-white'
    }`}>
      
      {/* Header */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md ${
        isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-stone-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-white text-xl shadow-md ${
              isDarkMode ? 'bg-gradient-to-br from-sky-400 to-slate-700' : 'bg-gradient-to-br from-red-600 to-emerald-800'
            }`}>
              🎁
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block">KovertKlaus</span>
              <span className={`text-xs font-bold ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>Agent Command Center</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isDarkMode ? 'bg-slate-900 border-slate-700 text-sky-300' : 'bg-stone-100 border-stone-300 text-slate-700'
              }`}
            >
              {isDarkMode ? '🎄 Light' : '❄️ Dark (Icy)'}
            </button>

            {/* Account Preferences Button */}
            <button
              onClick={() => { setPrefError(''); setPrefMessage(''); setPrefModalOpen(true); }}
              className={`text-xs font-bold px-3.5 py-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 ${
                isDarkMode
                  ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-500/40 hover:text-sky-300'
                  : 'border-stone-300 bg-stone-100 text-slate-700 hover:bg-stone-200'
              }`}
            >
              <span>⚙️ Preferences</span>
            </button>

            <button
              onClick={handleLogout}
              className={`text-xs font-bold px-3.5 py-2 rounded-xl border transition-colors cursor-pointer ${
                isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white' : 'border-stone-300 bg-stone-100 text-slate-600 hover:bg-stone-200'
              }`}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        
        {loading ? (
          <div className="text-center py-20">
            <div className="text-4xl animate-bounce mb-3">🎁</div>
            <p className="text-sm font-semibold">Loading Agent Profile...</p>
          </div>
        ) : user ? (
          <div className="space-y-8">
            
            {/* User Profile Welcome Banner */}
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
            }`}>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                    user.accountStatus === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-sky-500/20 dark:text-sky-300'
                      : 'bg-amber-100 text-amber-900'
                  }`}>
                    ● {user.accountStatus} ACCOUNT
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Demerits: <strong>{user.demerits}/3</strong>
                  </span>
                </div>
                <h1 className="text-3xl font-black">Welcome back, {user.name}!</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Codename: <strong className={isDarkMode ? 'text-sky-400' : 'text-red-600'}>{formatCodename(user.codename, user.name)}</strong> | Email: <strong>{user.email}</strong>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setPrefError(''); setPrefMessage(''); setPrefModalOpen(true); }}
                  className={`px-4 py-2.5 rounded-2xl font-bold text-xs border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-sky-400 hover:border-sky-500/40' : 'bg-stone-50 border-stone-300 text-slate-700 hover:bg-stone-100'
                  }`}
                >
                  ⚙️ Account Preferences
                </button>

                <Link
                  href="/"
                  className={`px-5 py-2.5 rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer ${
                    isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  + New Exchange
                </Link>
              </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: My Exchanges */}
              <div className="lg:col-span-7 space-y-6">
                <div className={`p-6 rounded-3xl border shadow-md ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      🎄 My Active Gift Exchanges ({user.participations?.length || 0})
                    </h2>
                  </div>

                  {user.participations?.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-stone-200 dark:border-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-500 mb-4">You are not enrolled in any active exchanges yet.</p>
                      <Link
                        href="/"
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs ${
                          isDarkMode ? 'bg-sky-500 text-slate-950' : 'bg-red-600 text-white'
                        }`}
                      >
                        Organize or Join One Now
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {user.participations.map((p) => (
                        <div key={p.id} className={`p-5 rounded-2xl border transition-all ${
                          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                              isDarkMode ? 'bg-sky-500/20 text-sky-300' : 'bg-emerald-100 text-emerald-900'
                            }`}>
                              CODE: {p.mission.code}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">{p.mission.status}</span>
                          </div>

                          <h3 className="text-lg font-bold">{p.mission.title}</h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Budget: <strong>${p.mission.budgetMin || 0} – ${p.mission.budgetMax} {p.mission.currency}</strong> | Exchange: <strong>{new Date(p.mission.executionDate).toLocaleDateString()}</strong>
                          </p>

                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                              Role: <strong className="text-slate-700 dark:text-slate-200">{p.role === 'OPS_LEADER' ? 'OpsLeader' : 'Agent'}</strong>
                            </span>
                            <Link
                              href={`/exchange/${p.mission.code}`}
                              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${
                                isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
                              }`}
                            >
                              Open Command Center →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>

              {/* Right Column: Master OpKit (Wishlist) & OpTools */}
              <div className="lg:col-span-5 space-y-6">
                <div className={`p-6 rounded-3xl border shadow-md ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
                }`}>
                  <h2 className="text-xl font-bold mb-0.5 flex items-center gap-2">
                    🧰 Master OpKit
                  </h2>
                  <p className="text-xs font-semibold text-red-600 dark:text-sky-400 mb-1">
                    (OpKit = Your Wishlist | OpTools = Wished-for Gift Items)
                  </p>
                  <p className="text-xs text-slate-500 mb-6">
                    Add OpTools (gift items) to your master OpKit to share across all Secret Santa exchanges.
                  </p>

                  <form onSubmit={handleScrapeUrl} className="flex gap-2 mb-6">
                    <input
                      type="url"
                      placeholder="Paste OpTool link (Amazon, Target, Etsy, etc.)"
                      value={opToolUrl}
                      onChange={(e) => setOpToolUrl(e.target.value)}
                      required
                      className={`flex-1 border rounded-2xl px-3 py-2 text-xs focus:outline-none focus:ring-2 ${
                        isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-slate-100 focus:ring-sky-400'
                          : 'bg-stone-50 border-stone-300 text-slate-900 focus:ring-red-600'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={scraping}
                      className={`px-4 py-2 rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                        isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {scraping ? '...' : '+ Add OpTool'}
                    </button>
                  </form>

                  {opTools.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-stone-200 dark:border-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-500">No OpTools added to your OpKit yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {opTools.map((item) => (
                        <div key={item.id} className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200'
                        }`}>
                          <div className="flex items-center gap-3">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.title} className="h-8 w-8 object-cover rounded-lg border" />
                            ) : (
                              <div className="h-8 w-8 rounded-lg bg-stone-200 dark:bg-slate-800 flex items-center justify-center text-sm">🛍️</div>
                            )}
                            <a href={item.url} target="_blank" rel="noreferrer" className="font-bold hover:underline max-w-[180px] truncate block">
                              {item.title}
                            </a>
                          </div>
                          <button
                            onClick={() => setOpTools((prev) => prev.filter((i) => i.id !== item.id))}
                            className="text-red-500 font-bold hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>

            </div>

          </div>
        ) : null}

      </main>

      {/* ACCOUNT PREFERENCES MODAL */}
      {prefModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-lg w-full shadow-2xl border transition-all max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-stone-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>⚙️ Account Preferences</span>
              </h3>
              <button onClick={() => setPrefModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            {prefMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold">
                ✓ {prefMessage}
              </div>
            )}

            {prefError && (
              <div className="mb-4 p-3 rounded-xl bg-red-100 border border-red-300 text-red-700 text-xs font-bold">
                ⚠️ {prefError}
              </div>
            )}

            <form onSubmit={handleUpdatePreferences} className="space-y-4 text-xs font-semibold">
              
              {/* Profile Details */}
              <div className="p-4 rounded-2xl bg-stone-100 dark:bg-slate-950 border border-stone-200 dark:border-slate-800 space-y-3">
                <span className={`text-xs font-bold block uppercase tracking-wider ${isDarkMode ? 'text-sky-400' : 'text-red-600'}`}>
                  Profile & Codename
                </span>
                <div>
                  <label className="block text-slate-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Secret Codename / Handle (Will be prefixed with Agent-)</label>
                  <input
                    type="text"
                    value={editCodename}
                    onChange={(e) => setEditCodename(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                    }`}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="text-slate-500">Email Notifications</label>
                  <input
                    type="checkbox"
                    checked={editNotifications}
                    onChange={(e) => setEditNotifications(e.target.checked)}
                    className="h-4 w-4 rounded accent-red-600"
                  />
                </div>
              </div>

              {/* Physical Shipping Address */}
              <div className="p-4 rounded-2xl bg-stone-100 dark:bg-slate-950 border border-stone-200 dark:border-slate-800 space-y-3">
                <span className={`text-xs font-bold block uppercase tracking-wider ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>
                  Physical Shipping Address (Optional)
                </span>
                <div>
                  <label className="block text-slate-500 mb-1">Street Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 123 Holiday Lane"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                    }`}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-500 mb-1">City</label>
                    <input
                      type="text"
                      placeholder="Seattle"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">State</label>
                    <input
                      type="text"
                      placeholder="WA"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Zip Code</label>
                    <input
                      type="text"
                      placeholder="98101"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Password Change Section */}
              <div className="p-4 rounded-2xl bg-stone-100 dark:bg-slate-950 border border-stone-200 dark:border-slate-800 space-y-3">
                <span className={`text-xs font-bold block uppercase tracking-wider ${isDarkMode ? 'text-sky-400' : 'text-red-600'}`}>
                  Security & Password Update
                </span>
                <div>
                  <label className="block text-slate-500 mb-1">Current Password</label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">New Password (Min 10 Characters)</label>
                  <input
                    type="password"
                    placeholder="New 10+ char complex password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:ring-sky-400' : 'bg-white border-stone-300 text-slate-900 focus:ring-red-600'
                    }`}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPrefModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-stone-100 text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={prefLoading}
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${
                    isDarkMode ? 'bg-sky-500 hover:bg-sky-400 text-slate-950' : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {prefLoading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
