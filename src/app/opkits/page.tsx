'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCodename } from '@/lib/security';
import { getThemeClasses } from '@/lib/theme';

interface OpTool {
  id: string;
  title: string;
  price?: number;
  url: string;
  thumbnail?: string;
  notes?: string;
}

interface OpKit {
  id: string;
  name: string;
  isMaster: boolean;
  type: 'WISHLIST' | 'WHITE_ELEPHANT';
  createdAt: string;
  opTools: OpTool[];
}

export default function OpKitsPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opKits, setOpKits] = useState<OpKit[]>([]);
  const [selectedOpKitId, setSelectedOpKitId] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  
  // OpKit Creation & Editing State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newOpKitName, setNewOpKitName] = useState('');
  const [newOpKitType, setNewOpKitType] = useState<'WISHLIST' | 'WHITE_ELEPHANT'>('WISHLIST');
  const [editingOpKitId, setEditingOpKitId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // OpTool URL Scraper Input State
  const [opToolUrl, setOpToolUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [validationError, setValidationError] = useState('');

  const theme = getThemeClasses(isDarkMode);

  useEffect(() => {
    fetchOpKits();
  }, []);

  async function fetchOpKits() {
    setLoading(true);
    const userId = localStorage.getItem('kovertklaus_user_id');
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/users/me?userId=${userId}`);
      const json = await res.json();
      if (json.success && json.user) {
        const wishlists: OpKit[] = json.user.wishlists || [];
        setOpKits(wishlists);
        if (wishlists.length > 0 && !selectedOpKitId) {
          setSelectedOpKitId(wishlists[0].id);
        }
      }
    } catch {
      console.error('Failed to load OpKits');
    } finally {
      setLoading(false);
    }
  }

  const selectedOpKit = opKits.find((k) => k.id === selectedOpKitId);

  // Handle OpKit Creation
  async function handleCreateOpKit(e: React.FormEvent) {
    e.preventDefault();
    if (!newOpKitName.trim()) return;

    const userId = localStorage.getItem('kovertklaus_user_id');
    if (!userId) return;

    const newKit: OpKit = {
      id: Math.random().toString(36).substring(2, 9),
      name: newOpKitName.trim(),
      isMaster: false,
      type: newOpKitType,
      createdAt: new Date().toISOString(),
      opTools: [],
    };

    setOpKits((prev) => [...prev, newKit]);
    setSelectedOpKitId(newKit.id);
    setNewOpKitName('');
    setCreateModalOpen(false);
  }

  // Handle OpKit Renaming
  function handleRenameOpKit(id: string) {
    if (!editingName.trim()) return;
    setOpKits((prev) =>
      prev.map((k) => (k.id === id ? { ...k, name: editingName.trim() } : k))
    );
    setEditingOpKitId(null);
    setEditingName('');
  }

  // Handle OpKit Deletion
  function handleDeleteOpKit(id: string) {
    const kit = opKits.find((k) => k.id === id);
    if (kit?.isMaster) {
      alert('The Master OpKit cannot be deleted as it serves as your default inventory!');
      return;
    }
    if (confirm(`Are you sure you want to delete "${kit?.name}"?`)) {
      const remaining = opKits.filter((k) => k.id !== id);
      setOpKits(remaining);
      if (selectedOpKitId === id && remaining.length > 0) {
        setSelectedOpKitId(remaining[0].id);
      }
    }
  }

  // Handle Scraper for OpTool Item
  async function handleAddOpTool(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');
    if (!opToolUrl.trim() || !selectedOpKit) return;

    // Strict White Elephant 1-Gift Limit Check
    if (selectedOpKit.type === 'WHITE_ELEPHANT' && selectedOpKit.opTools.length >= 1) {
      setValidationError('🐘 White Elephant OpKits are strictly limited to 1 brought gift item per operative!');
      return;
    }

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
        prev.map((k) =>
          k.id === selectedOpKit.id
            ? { ...k, opTools: [...k.opTools, newItem] }
            : k
        )
      );
      setOpToolUrl('');
    } catch {
      const fallbackItem: OpTool = {
        id: Math.random().toString(36).substring(2, 9),
        title: opToolUrl.trim(),
        url: opToolUrl.trim(),
      };
      setOpKits((prev) =>
        prev.map((k) =>
          k.id === selectedOpKit.id
            ? { ...k, opTools: [...k.opTools, fallbackItem] }
            : k
        )
      );
      setOpToolUrl('');
    } finally {
      setScraping(false);
    }
  }

  // Remove OpTool
  function handleRemoveOpTool(opToolId: string) {
    if (!selectedOpKit) return;
    setValidationError('');
    setOpKits((prev) =>
      prev.map((k) =>
        k.id === selectedOpKit.id
          ? { ...k, opTools: k.opTools.filter((t) => t.id !== opToolId) }
          : k
      )
    );
  }

  const filteredOpKits = opKits.filter((k) =>
    k.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${theme.pageBg}`}>
      
      {/* Header Navigation */}
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
                OpKits & OpTools Workspace
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

            <Link
              href="/dashboard"
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${theme.btnPrimary}`}
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
        
        {/* Banner Explanation */}
        <div className={`p-8 rounded-3xl border shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${theme.cardBg}`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${theme.badgeCode}`}>
                🧰 OpKit Management Hub
              </span>
              <span className="text-xs text-slate-500">
                (OpKit = Wish List | OpTool = Gift Item)
              </span>
            </div>
            <h1 className="text-3xl font-black">Manage All OpKits & OpTools</h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Organize your Master OpKit and operation-specific wish lists. Add gift links (OpTools), manage White Elephant brought items, and keep your secret santa wishes updated.
            </p>
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className={`px-6 py-3.5 rounded-2xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${theme.btnPrimary}`}
          >
            <span>+ Create New OpKit</span>
          </button>
        </div>

        {/* 2-Column Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: OpKit Selector Directory */}
          <div className="lg:col-span-4 space-y-4">
            <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Your OpKits ({opKits.length})</h2>
                <span className="text-xs text-slate-400 font-mono">Inventory</span>
              </div>

              {/* Search Bar */}
              <input
                type="text"
                placeholder="Search OpKits by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full border rounded-2xl px-4 py-2.5 text-xs mb-4 focus:outline-none ${theme.inputBg}`}
              />

              {/* Directory List */}
              {loading ? (
                <div className="text-center py-8 text-xs font-semibold text-slate-400">
                  Loading OpKits...
                </div>
              ) : filteredOpKits.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 border-2 border-dashed rounded-2xl">
                  No OpKits found matching "{searchQuery}"
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredOpKits.map((kit) => {
                    const isSelected = kit.id === selectedOpKitId;
                    return (
                      <div
                        key={kit.id}
                        onClick={() => { setValidationError(''); setSelectedOpKitId(kit.id); }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-sky-500/20 border-sky-500 text-white shadow-md'
                              : 'bg-red-50 border-red-500 text-red-900 shadow-sm'
                            : theme.cardInnerBg
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {kit.isMaster ? '⭐' : kit.type === 'WHITE_ELEPHANT' ? '🐘' : '🎁'}
                          </span>

                          {editingOpKitId === kit.id ? (
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() => handleRenameOpKit(kit.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameOpKit(kit.id)}
                              autoFocus
                              className={`border rounded-lg px-2 py-1 text-xs ${theme.inputModalBg}`}
                            />
                          ) : (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">{kit.name}</span>
                                {kit.isMaster && (
                                  <span className="text-[10px] bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 font-bold px-2 py-0.5 rounded-full">
                                    Master
                                  </span>
                                )}
                              </div>

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase inline-block mt-1 ${
                                kit.type === 'WHITE_ELEPHANT'
                                  ? 'bg-purple-100 text-purple-900 dark:bg-purple-500/20 dark:text-purple-300'
                                  : 'bg-emerald-100 text-emerald-900 dark:bg-sky-500/20 dark:text-sky-300'
                              }`}>
                                {kit.type === 'WHITE_ELEPHANT' ? '🐘 White Elephant' : '🎁 Secret Santa'}
                              </span>

                              <span className="text-[11px] text-slate-500 block mt-0.5">
                                {kit.opTools.length} OpTool{kit.opTools.length === 1 ? '' : 's'}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingOpKitId(kit.id);
                              setEditingName(kit.name);
                            }}
                            title="Rename OpKit"
                            className="p-1.5 hover:bg-stone-200 dark:hover:bg-slate-800 rounded-lg text-xs"
                          >
                            ✏️
                          </button>
                          {!kit.isMaster && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOpKit(kit.id);
                              }}
                              title="Delete OpKit"
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500 rounded-lg text-xs"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Active OpKit Inspection & OpTool Scraper Workspace */}
          <div className="lg:col-span-8 space-y-6">
            {selectedOpKit ? (
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-md space-y-6 ${theme.cardBg}`}>
                
                {/* OpKit Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-stone-200 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{selectedOpKit.isMaster ? '⭐' : selectedOpKit.type === 'WHITE_ELEPHANT' ? '🐘' : '🎁'}</span>
                      <h2 className="text-2xl font-black">{selectedOpKit.name}</h2>
                    </div>
                    <span className="text-xs text-slate-500">
                      Created: {new Date(selectedOpKit.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <span className={`text-xs px-3.5 py-1.5 rounded-full font-bold uppercase ${
                    selectedOpKit.type === 'WHITE_ELEPHANT'
                      ? 'bg-purple-100 text-purple-900 dark:bg-purple-500/20 dark:text-purple-300'
                      : 'bg-emerald-100 text-emerald-900 dark:bg-sky-500/20 dark:text-sky-300'
                  }`}>
                    {selectedOpKit.type === 'WHITE_ELEPHANT' ? '🐘 White Elephant OpKit' : '🎁 Secret Santa Wishlist'}
                  </span>
                </div>

                {/* Info Note based on Dual OpKit Type */}
                <div className={`p-4 rounded-2xl text-xs ${
                  selectedOpKit.type === 'WHITE_ELEPHANT'
                    ? 'bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-950 dark:text-purple-200'
                    : 'bg-stone-100 dark:bg-slate-950 border border-stone-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {selectedOpKit.type === 'WHITE_ELEPHANT' ? (
                    <div>
                      <span className="font-bold block text-sm mb-0.5">🐘 White Elephant Brought Gift OpKit</span>
                      <span>This OpKit holds the single physical/digital gift item you are bringing to the live stealing pool. <strong>Strictly limited to 1 OpTool gift item.</strong></span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-bold block text-sm mb-0.5">🎁 Secret Santa Requested Wishlist OpKit</span>
                      <span>This OpKit holds items you wish to receive from your assigned Secret Santa operative. <strong>Unlimited OpTools allowed.</strong></span>
                    </div>
                  )}
                </div>

                {validationError && (
                  <div className={`p-4 rounded-2xl text-xs font-bold border ${theme.alertWarning}`}>
                    ⚠️ {validationError}
                  </div>
                )}

                {/* OpTool Link Scraper Form */}
                <form onSubmit={handleAddOpTool} className="flex gap-2 mb-6">
                  <input
                    type="url"
                    placeholder={
                      selectedOpKit.type === 'WHITE_ELEPHANT'
                        ? 'Paste White Elephant gift link (Amazon, Target, etc.)'
                        : 'Paste store product link (Amazon, Target, Etsy, etc.)'
                    }
                    value={opToolUrl}
                    onChange={(e) => setOpToolUrl(e.target.value)}
                    required
                    disabled={selectedOpKit.type === 'WHITE_ELEPHANT' && selectedOpKit.opTools.length >= 1}
                    className={`flex-1 border rounded-2xl px-4 py-3 text-xs focus:outline-none focus:ring-2 ${theme.inputBg}`}
                  />
                  <button
                    type="submit"
                    disabled={scraping || (selectedOpKit.type === 'WHITE_ELEPHANT' && selectedOpKit.opTools.length >= 1)}
                    className={`px-6 py-3 rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                      selectedOpKit.type === 'WHITE_ELEPHANT' && selectedOpKit.opTools.length >= 1
                        ? 'bg-slate-400 text-slate-200 cursor-not-allowed'
                        : theme.btnPrimary
                    }`}
                  >
                    {scraping ? 'Scraping...' : '+ Add OpTool'}
                  </button>
                </form>

                {/* OpTools List Grid */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold">Attached OpTools ({selectedOpKit.opTools.length})</h3>
                    <span className="text-xs text-slate-500 font-mono">Gift Items</span>
                  </div>

                  {selectedOpKit.opTools.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-stone-200 dark:border-slate-800 rounded-3xl">
                      <div className="text-3xl mb-2">🛍️</div>
                      <p className="text-xs font-bold mb-1">No OpTools Attached Yet</p>
                      <p className="text-[11px] text-slate-500">
                        Paste a store link above to auto-scrape product titles, prices, and thumbnails into your OpKit!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedOpKit.opTools.map((tool) => (
                        <div
                          key={tool.id}
                          className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${theme.cardInnerBg}`}
                        >
                          <div className="flex items-center gap-4">
                            {tool.thumbnail ? (
                              <img
                                src={tool.thumbnail}
                                alt={tool.title}
                                className="h-14 w-14 object-cover rounded-xl border border-stone-200 dark:border-slate-800"
                              />
                            ) : (
                              <div className="h-14 w-14 rounded-xl bg-stone-200 dark:bg-slate-800 flex items-center justify-center text-xl">
                                🛍️
                              </div>
                            )}

                            <div>
                              <a
                                href={tool.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-bold hover:underline block max-w-md truncate"
                              >
                                {tool.title}
                              </a>
                              {tool.price && (
                                <span className={`text-xs font-mono font-bold block mt-0.5 ${theme.textAccent}`}>
                                  ${tool.price}
                                </span>
                              )}
                              <a
                                href={tool.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-slate-400 hover:underline block max-w-xs truncate"
                              >
                                {tool.url}
                              </a>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemoveOpTool(tool.id)}
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
            ) : (
              <div className={`p-12 text-center rounded-3xl border ${theme.cardBg}`}>
                <p className="text-xs text-slate-500">Select an OpKit from the left directory to inspect and add OpTools.</p>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* MODAL: CREATE NEW OPKIT */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl border transition-all ${theme.modalBg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>🧰 Create New OpKit</span>
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleCreateOpKit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">OpKit Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Secret Santa Tech Wishlist 2026"
                  value={newOpKitName}
                  onChange={(e) => setNewOpKitName(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">OpKit Category Type *</label>
                <select
                  value={newOpKitType}
                  onChange={(e) => setNewOpKitType(e.target.value as 'WISHLIST' | 'WHITE_ELEPHANT')}
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none ${theme.inputModalBg}`}
                >
                  <option value="WISHLIST">🎁 Secret Santa Wishlist (Unlimited OpTools)</option>
                  <option value="WHITE_ELEPHANT">🐘 White Elephant Brought Gift (Strictly 1 OpTool)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
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
