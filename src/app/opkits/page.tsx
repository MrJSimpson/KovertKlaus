'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface OpTool {
  id: string;
  title: string;
  price?: number;
  url: string;
  thumbnail?: string;
}

interface OpKit {
  id: string;
  name: string;
  isMaster: boolean;
  createdAt: string;
  opTools: OpTool[];
}

export default function DedicatedOpKitsPage() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opKits, setOpKits] = useState<OpKit[]>([
    {
      id: 'master-1',
      name: 'Master OpKit',
      isMaster: true,
      createdAt: new Date().toISOString(),
      opTools: [],
    },
    {
      id: 'holiday-2026',
      name: 'Holiday 2026 Secret Santa OpKit',
      isMaster: false,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      opTools: [],
    },
    {
      id: 'office-party',
      name: 'Office White Elephant OpKit',
      isMaster: false,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      opTools: [],
    },
  ]);

  const [selectedOpKitId, setSelectedOpKitId] = useState<string>('master-1');
  const [newOpKitName, setNewOpKitName] = useState('');
  const [editingOpKitId, setEditingOpKitId] = useState<string | null>(null);
  const [editOpKitTitle, setEditOpKitTitle] = useState('');

  // Scraper State
  const [opToolUrl, setOpToolUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Verify session
    fetchSession();
  }, []);

  async function fetchSession() {
    setLoading(true);
    try {
      const res = await fetch('/api/users/me');
      const json = await res.json();
      if (!res.ok || !json.authenticated) {
        const savedId = localStorage.getItem('kovertklaus_user_id');
        if (!savedId) router.push('/');
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }

  // Create New OpKit
  function handleCreateOpKit(e: React.FormEvent) {
    e.preventDefault();
    if (!newOpKitName.trim()) return;

    const newKit: OpKit = {
      id: Math.random().toString(36).substring(2, 9),
      name: newOpKitName.trim(),
      isMaster: false,
      createdAt: new Date().toISOString(),
      opTools: [],
    };

    setOpKits((prev) => [...prev, newKit]);
    setSelectedOpKitId(newKit.id);
    setNewOpKitName('');
  }

  // Rename OpKit
  function handleRenameOpKit(id: string) {
    if (!editOpKitTitle.trim()) return;
    setOpKits((prev) =>
      prev.map((kit) => (kit.id === id ? { ...kit, name: editOpKitTitle.trim() } : kit))
    );
    setEditingOpKitId(null);
    setEditOpKitTitle('');
  }

  // Delete OpKit
  function handleDeleteOpKit(id: string) {
    const kit = opKits.find((k) => k.id === id);
    if (kit?.isMaster) {
      alert('Master OpKit cannot be deleted as it is your primary wishlist.');
      return;
    }
    if (confirm(`Are you sure you want to delete "${kit?.name}"?`)) {
      setOpKits((prev) => prev.filter((k) => k.id !== id));
      if (selectedOpKitId === id) {
        setSelectedOpKitId('master-1');
      }
    }
  }

  // Add OpTool to Selected OpKit
  async function handleAddOpTool(e: React.FormEvent) {
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

      const newItem: OpTool = {
        id: Math.random().toString(36).substring(2, 9),
        title: json.success && json.metadata?.title ? json.metadata.title : opToolUrl.trim(),
        price: json.metadata?.price,
        thumbnail: json.metadata?.thumbnail,
        url: opToolUrl.trim(),
      };

      setOpKits((prev) =>
        prev.map((kit) =>
          kit.id === selectedOpKitId ? { ...kit, opTools: [...kit.opTools, newItem] } : kit
        )
      );
      setOpToolUrl('');
    } catch {
      const newItem: OpTool = {
        id: Math.random().toString(36).substring(2, 9),
        title: opToolUrl.trim(),
        url: opToolUrl.trim(),
      };
      setOpKits((prev) =>
        prev.map((kit) =>
          kit.id === selectedOpKitId ? { ...kit, opTools: [...kit.opTools, newItem] } : kit
        )
      );
      setOpToolUrl('');
    } finally {
      setScraping(false);
    }
  }

  // Remove OpTool
  function handleRemoveOpTool(toolId: string) {
    setOpKits((prev) =>
      prev.map((kit) =>
        kit.id === selectedOpKitId
          ? { ...kit, opTools: kit.opTools.filter((t) => t.id !== toolId) }
          : kit
      )
    );
  }

  const selectedOpKit = opKits.find((k) => k.id === selectedOpKitId) || opKits[0];

  const filteredOpKits = opKits.filter((kit) =>
    kit.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-white text-xl shadow-md ${
              isDarkMode ? 'bg-gradient-to-br from-sky-400 to-slate-700' : 'bg-gradient-to-br from-red-600 to-emerald-800'
            }`}>
              🎁
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block">KovertKlaus</span>
              <span className={`text-xs font-bold ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>OpKits & OpTools Manager</span>
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

            <Link
              href="/dashboard"
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${
                isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        
        {/* Title & Banner */}
        <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
        }`}>
          <div>
            <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
              isDarkMode ? 'bg-sky-500/20 text-sky-300' : 'bg-emerald-100 text-emerald-900'
            }`}>
              🧰 DEDICATED OPKITS MANAGEMENT WORKSPACE
            </span>
            <h1 className="text-3xl font-black mt-2">OpKits & OpTools Center</h1>
            <p className="text-xs font-semibold text-red-600 dark:text-sky-400 mt-1">
              (OpKit = Secret Santa Wishlist | OpTool = Wished-for Gift Item)
            </p>
          </div>

          <form onSubmit={handleCreateOpKit} className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="New OpKit Name (e.g. Office OpKit)"
              value={newOpKitName}
              onChange={(e) => setNewOpKitName(e.target.value)}
              required
              className={`border rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 w-full sm:w-64 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:ring-sky-400' : 'bg-stone-50 border-stone-300 text-slate-900 focus:ring-red-600'
              }`}
            />
            <button
              type="submit"
              className={`px-5 py-2.5 rounded-2xl font-bold text-xs shadow-md transition-all whitespace-nowrap ${
                isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              + Create OpKit
            </button>
          </form>
        </div>

        {/* 2-Column Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: All OpKits Directory */}
          <div className="lg:col-span-5 space-y-6">
            <div className={`p-6 rounded-3xl border shadow-md ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  🗂️ All OpKits ({opKits.length})
                </h2>
                <span className="text-xs text-slate-500 font-mono">Master Pinned First</span>
              </div>

              {/* Filter / Search Input */}
              <input
                type="text"
                placeholder="Filter OpKits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full border rounded-2xl px-3.5 py-2 text-xs mb-4 focus:outline-none ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-stone-50 border-stone-300 text-slate-900'
                }`}
              />

              <div className="space-y-3">
                {filteredOpKits.map((kit) => (
                  <div
                    key={kit.id}
                    onClick={() => setSelectedOpKitId(kit.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      selectedOpKitId === kit.id
                        ? isDarkMode
                          ? 'bg-sky-500/20 border-sky-500 text-white shadow-md'
                          : 'bg-red-50 border-red-500 text-red-900 shadow-sm'
                        : isDarkMode
                        ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        : 'bg-stone-50 border-stone-200 text-slate-700 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{kit.isMaster ? '⭐' : '📦'}</span>
                      <div>
                        {editingOpKitId === kit.id ? (
                          <input
                            type="text"
                            autoFocus
                            value={editOpKitTitle}
                            onChange={(e) => setEditOpKitTitle(e.target.value)}
                            onBlur={() => handleRenameOpKit(kit.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameOpKit(kit.id);
                            }}
                            className={`border rounded-lg px-2 py-0.5 text-xs focus:outline-none ${
                              isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-stone-300 text-slate-900'
                            }`}
                          />
                        ) : (
                          <h3 className="font-bold text-sm">
                            {kit.name} {kit.isMaster && <span className="text-xs text-amber-500">(Master)</span>}
                          </h3>
                        )}
                        <span className="text-[11px] text-slate-400 block font-mono">
                          {kit.opTools.length} {kit.opTools.length === 1 ? 'OpTool' : 'OpTools'} attached
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Inline Edit Icon */}
                      <button
                        type="button"
                        title="Rename OpKit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingOpKitId(kit.id);
                          setEditOpKitTitle(kit.name);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer text-xs"
                      >
                        ✏️
                      </button>

                      {/* Delete Icon for non-Master OpKits */}
                      {!kit.isMaster && (
                        <button
                          type="button"
                          title="Delete OpKit"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOpKit(kit.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition-colors cursor-pointer text-xs"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Right Column: Selected OpKit & OpTools Inspector */}
          <div className="lg:col-span-7 space-y-6">
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-md ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <span>{selectedOpKit.isMaster ? '⭐' : '📦'}</span>
                  <span>{selectedOpKit.name}</span>
                </h2>
                <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                  selectedOpKit.isMaster
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-900 dark:bg-sky-500/20 dark:text-sky-300'
                }`}>
                  {selectedOpKit.isMaster ? 'MASTER OPKIT' : 'CUSTOM OPKIT'}
                </span>
              </div>

              <p className="text-xs text-slate-500 mb-6">
                Add OpTools (gift items) into <strong className="text-slate-800 dark:text-slate-200">{selectedOpKit.name}</strong> by pasting store product links below.
              </p>

              {/* OpTool Link Scraper Form */}
              <form onSubmit={handleAddOpTool} className="flex gap-2 mb-6">
                <input
                  type="url"
                  placeholder="Paste product link (Amazon, Target, Etsy, etc.)"
                  value={opToolUrl}
                  onChange={(e) => setOpToolUrl(e.target.value)}
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
                  {scraping ? 'Scraping...' : '+ Add OpTool'}
                </button>
              </form>

              {/* OpTools List */}
              {selectedOpKit.opTools.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-stone-200 dark:border-slate-800 rounded-3xl">
                  <div className="text-3xl mb-2">🛍️</div>
                  <p className="text-xs text-slate-500">No OpTools inside "{selectedOpKit.name}" yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Paste a product URL above to automatically pull item details.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedOpKit.opTools.map((item) => (
                    <div key={item.id} className={`p-4 rounded-2xl border flex items-center justify-between ${
                      isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200'
                    }`}>
                      <div className="flex items-center gap-3.5">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.title} className="h-12 w-12 object-cover rounded-xl border" />
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-stone-200 dark:bg-slate-800 flex items-center justify-center text-xl">🛍️</div>
                        )}
                        <div>
                          <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-bold hover:underline block max-w-sm truncate">
                            {item.title}
                          </a>
                          {item.price && (
                            <span className="text-xs font-mono text-emerald-600 dark:text-sky-400 font-bold block mt-0.5">
                              ${item.price}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveOpTool(item.id)}
                        className="text-xs text-red-500 font-bold hover:underline px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
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

      </main>

    </div>
  );
}
