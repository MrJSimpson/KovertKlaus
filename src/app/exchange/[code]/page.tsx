'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatCodename } from '@/lib/security';

interface OperationData {
  id: string;
  title: string;
  code: string;
  description?: string;
  budgetMin?: number;
  budgetMax: number;
  currency: string;
  assignmentDate: string;
  executionDate: string;
  status: string;
  opsLeader: {
    id: string;
    name: string;
    codename?: string;
  };
  agents: Array<{
    id: string;
    userId: string;
    role: string;
    shippingStatus: string;
    user?: {
      name: string;
      codename?: string;
    };
  }>;
}

export default function ExchangeDashboardPage() {
  const params = useParams();
  const code = (params?.code as string)?.toUpperCase() || '';

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<OperationData | null>(null);

  // Current User Session
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  // Wishlist Scraper State
  const [wishlistUrl, setWishlistUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapedItem, setScrapedItem] = useState<{ title: string; price?: number; thumbnail?: string } | null>(null);
  const [userWishlist, setUserWishlist] = useState<Array<{ id: string; title: string; price?: number; url: string; thumbnail?: string }>>([]);

  // Load User & Exchange Info
  useEffect(() => {
    const savedUserId = localStorage.getItem('kovertklaus_user_id');
    const savedUserName = localStorage.getItem('kovertklaus_user_name');
    if (savedUserId) setUserId(savedUserId);
    if (savedUserName) setUserName(savedUserName);

    // Fetch Exchange Details
    fetchExchangeDetails();
  }, [code]);

  async function fetchExchangeDetails() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/invitations?code=${code}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Exchange not found');
      } else {
        setOperation(json.data);
      }
    } catch {
      setError('Failed to load exchange details');
    } finally {
      setLoading(false);
    }
  }

  // Handle URL Scraper
  async function handleScrapeUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!wishlistUrl.trim()) return;

    setScraping(true);
    setScrapedItem(null);
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
          title: json.metadata.title || 'Wishlist Gift Item',
          price: json.metadata.price || undefined,
          thumbnail: json.metadata.thumbnail || undefined,
          url: wishlistUrl.trim(),
        };
        setUserWishlist((prev) => [...prev, item]);
        setWishlistUrl('');
        setScrapedItem(item);
      } else {
        alert('Could not automatically scrape product details. Added as custom link!');
        setUserWishlist((prev) => [
          ...prev,
          { id: Math.random().toString(36).substring(2, 9), title: wishlistUrl, url: wishlistUrl },
        ]);
        setWishlistUrl('');
      }
    } catch {
      alert('Failed to scrape URL. Link added directly!');
      setUserWishlist((prev) => [
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
              <span className={`text-xs font-bold ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>Exchange Dashboard</span>
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
            <Link
              href="/"
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors ${
                isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              ← Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        
        {loading ? (
          <div className="text-center py-20">
            <div className="text-4xl animate-bounce mb-3">🎁</div>
            <p className="text-sm font-semibold">Loading Exchange Command Center...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-xl font-bold mb-2">Exchange Not Found</h2>
            <p className="text-xs text-slate-500 mb-6">{error}</p>
            <Link href="/" className="px-6 py-3 bg-red-600 text-white font-bold text-xs rounded-xl">
              Return Home
            </Link>
          </div>
        ) : operation ? (
          <div className="space-y-8">
            
            {/* Exchange Banner */}
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
            }`}>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-mono font-bold ${
                    isDarkMode ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    CODE: {operation.code}
                  </span>
                  <span className="text-xs text-slate-500">
                    OpsLeader: <strong>{operation.opsLeader.name} ({formatCodename(operation.opsLeader.codename, operation.opsLeader.name)})</strong>
                  </span>
                </div>
                <h1 className="text-3xl font-black">{operation.title}</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Budget: <strong>${operation.budgetMin || 0} – ${operation.budgetMax} {operation.currency}</strong> | Exchange Date: <strong>{new Date(operation.executionDate).toLocaleDateString()}</strong>
                </p>
              </div>

              {/* Share Code Button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(operation.code);
                  alert(`Copied Exchange Code to clipboard: ${operation.code}`);
                }}
                className={`px-5 py-3 rounded-2xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                  isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                <span>📋 Copy Invite Code ({operation.code})</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Wishlist Management */}
              <div className="lg:col-span-7 space-y-6">
                <div className={`p-6 rounded-3xl border shadow-md ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
                }`}>
                  <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                    🎁 My Universal Wishlist
                  </h2>
                  <p className="text-xs text-slate-500 mb-6">
                    Paste product links from any online store (Amazon, Target, Etsy, etc.). We'll automatically pull titles and prices!
                  </p>

                  <form onSubmit={handleScrapeUrl} className="flex gap-2 mb-6">
                    <input
                      type="url"
                      placeholder="Paste product link (e.g. https://amazon.com/...)"
                      value={wishlistUrl}
                      onChange={(e) => setWishlistUrl(e.target.value)}
                      required
                      className={`flex-1 border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${
                        isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-slate-100 focus:ring-sky-400'
                          : 'bg-stone-50 border-stone-300 text-slate-900 focus:ring-red-600'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={scraping}
                      className={`px-5 py-3 rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                        isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {scraping ? 'Scraping...' : '+ Add Item'}
                    </button>
                  </form>

                  {/* Wishlist Items List */}
                  {userWishlist.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-stone-200 dark:border-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-500">Your wishlist is empty. Add a product link above!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userWishlist.map((item) => (
                        <div key={item.id} className={`p-4 rounded-2xl border flex items-center justify-between ${
                          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200'
                        }`}>
                          <div className="flex items-center gap-3">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.title} className="h-10 w-10 object-cover rounded-xl border" />
                            ) : (
                              <div className="h-10 w-10 rounded-xl bg-stone-200 dark:bg-slate-800 flex items-center justify-center text-lg">🛍️</div>
                            )}
                            <div>
                              <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-bold hover:underline block max-w-xs truncate">
                                {item.title}
                              </a>
                              {item.price && <span className="text-xs font-mono text-emerald-600 dark:text-sky-400">${item.price}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => setUserWishlist((prev) => prev.filter((i) => i.id !== item.id))}
                            className="text-xs text-red-500 font-bold hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>

              {/* Right Column: Participant Roster */}
              <div className="lg:col-span-5 space-y-6">
                <div className={`p-6 rounded-3xl border shadow-md ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      👥 Agents ({operation.agents?.length || 0})
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">Status: {operation.status}</span>
                  </div>

                  <div className="space-y-2">
                    {operation.agents?.map((agent, i) => (
                      <div key={agent.id} className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                        isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400">#{i + 1}</span>
                          <span className="font-bold">{formatCodename(agent.user?.codename, agent.user?.name)}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            agent.role === 'OPS_LEADER'
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-900 dark:bg-sky-500/20 dark:text-sky-300'
                          }`}>
                            {agent.role === 'OPS_LEADER' ? 'OpsLeader' : 'Agent'}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono">{agent.shippingStatus}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

          </div>
        ) : null}

      </main>

    </div>
  );
}
