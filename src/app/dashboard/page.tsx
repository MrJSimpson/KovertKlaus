'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UserData {
  id: string;
  email: string;
  name: string;
  codename?: string;
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

  // Scraper & Wishlist State
  const [wishlistUrl, setWishlistUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [wishlistItems, setWishlistItems] = useState<Array<{ id: string; title: string; price?: number; url: string; thumbnail?: string }>>([]);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  async function fetchUserProfile() {
    setLoading(true);
    try {
      const res = await fetch('/api/users/me');
      const json = await res.json();
      if (!res.ok || !json.authenticated) {
        // Fall back to localStorage if available
        const savedId = localStorage.getItem('kovertklaus_user_id');
        const savedName = localStorage.getItem('kovertklaus_user_name');
        if (savedId) {
          setUser({
            id: savedId,
            email: 'joshua@example.com',
            name: savedName || 'Agent',
            codename: 'Agent-9867',
            demerits: 0,
            accountStatus: 'ACTIVE',
            participations: [],
          });
        } else {
          router.push('/');
        }
      } else {
        setUser(json.user);
      }
    } catch {
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/users/me', { method: 'DELETE' });
    localStorage.removeItem('kovertklaus_user_id');
    localStorage.removeItem('kovertklaus_user_name');
    router.push('/');
  }

  // Handle Scraper for Master Wishlist
  async function handleScrapeUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!wishlistUrl.trim()) return;

    setScraping(true);
    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: wishlistUrl.trim() }),
      });
      const json = await res.json();
      if (json.success && json.metadata) {
        const item = {
          id: Math.random().toString(36).substring(2, 9),
          title: json.metadata.title || 'Wishlist Item',
          price: json.metadata.price,
          thumbnail: json.metadata.thumbnail,
          url: wishlistUrl.trim(),
        };
        setWishlistItems((prev) => [...prev, item]);
        setWishlistUrl('');
      } else {
        setWishlistItems((prev) => [
          ...prev,
          { id: Math.random().toString(36).substring(2, 9), title: wishlistUrl, url: wishlistUrl },
        ]);
        setWishlistUrl('');
      }
    } catch {
      setWishlistItems((prev) => [
        ...prev,
        { id: Math.random().toString(36).substring(2, 9), title: wishlistUrl, url: wishlistUrl },
      ]);
      setWishlistUrl('');
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

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isDarkMode ? 'bg-slate-900 border-slate-700 text-sky-300' : 'bg-stone-100 border-stone-300 text-slate-700'
              }`}
            >
              {isDarkMode ? '🎄 Light' : '❄️ Dark (Icy)'}
            </button>

            <button
              onClick={handleLogout}
              className={`text-xs font-bold px-4 py-2 rounded-xl border transition-colors cursor-pointer ${
                isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white' : 'border-stone-300 bg-stone-100 text-slate-700 hover:bg-stone-200'
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
                  Codename: <strong className={isDarkMode ? 'text-sky-400' : 'text-red-600'}>{user.codename || 'Agent'}</strong> | Email: <strong>{user.email}</strong>
                </p>
              </div>

              <div className="flex gap-3">
                <Link
                  href="/"
                  className={`px-5 py-3 rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer ${
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
                              Role: <strong className="text-slate-700 dark:text-slate-200">{p.role === 'OPS_LEADER' ? 'Organizer' : 'Field Agent'}</strong>
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

              {/* Right Column: Master Wishlist */}
              <div className="lg:col-span-5 space-y-6">
                <div className={`p-6 rounded-3xl border shadow-md ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
                }`}>
                  <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                    🛍️ My Master Wishlist
                  </h2>
                  <p className="text-xs text-slate-500 mb-6">
                    Items added here can be shared across all your Secret Santa exchanges.
                  </p>

                  <form onSubmit={handleScrapeUrl} className="flex gap-2 mb-6">
                    <input
                      type="url"
                      placeholder="Paste product link (Amazon, Target, Etsy, etc.)"
                      value={wishlistUrl}
                      onChange={(e) => setWishlistUrl(e.target.value)}
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
                      {scraping ? '...' : '+ Add'}
                    </button>
                  </form>

                  {wishlistItems.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-stone-200 dark:border-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-500">No master wishlist items saved yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {wishlistItems.map((item) => (
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
                            onClick={() => setWishlistItems((prev) => prev.filter((i) => i.id !== item.id))}
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

    </div>
  );
}
