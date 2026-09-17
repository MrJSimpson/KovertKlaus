'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import {
  calculateRecommendedHardLimit,
  validateItemBudget,
  evaluateDrawEligibility,
  calculateClaimedBasketTotal,
  ManifestItemInput,
} from '@/lib/validations/manifest';

export default function WorkshopManifestBench() {
  const { theme, isDarkMode } = useTheme();

  // Event Configuration (OpsLeader / Head Elf controls)
  const [eventType, setEventType] = useState<'SECRET_SANTA' | 'WHITE_ELEPHANT'>('SECRET_SANTA');
  const [budgetMax, setBudgetMax] = useState<number>(50);
  const [budgetHardLimit, setBudgetHardLimit] = useState<number | undefined>(60);
  const [hardCapFocused, setHardCapFocused] = useState<boolean>(false);

  // Active View Perspective (Operative building list vs Assigned Buyer shopping)
  const [viewPerspective, setViewPerspective] = useState<'OPERATIVE' | 'BUYER'>('OPERATIVE');

  // Operative Wishlist State
  const [items, setItems] = useState<ManifestItemInput[]>([
    { id: '1', title: 'Noise-Cancelling Earbuds', price: 49.99, priority: 'HIGH', isClaimed: false },
    { id: '2', title: 'Artisanal Whole Bean Coffee (2-Pack)', price: 24.50, priority: 'MEDIUM', isClaimed: true },
    { id: '3', title: 'Thermal Stainless Travel Mug', price: 18.00, priority: 'LOW', isClaimed: false },
  ]);

  // Form Inputs for Adding New Item
  const [newItemTitle, setNewItemTitle] = useState<string>('');
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [newItemPriority, setNewItemPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [formError, setFormError] = useState<string | null>(null);

  // Importer Modal State
  const [showImporter, setShowImporter] = useState<boolean>(false);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);

  const isWhiteElephant = eventType === 'WHITE_ELEPHANT';

  // Saved Master Wishlists for Import Simulation
  const masterWishlistPresets = [
    {
      id: 'master-1',
      name: '🎅 Master Holiday Wishlist 2026',
      items: [
        { title: 'Wireless Charging Desk Mat', price: 39.99, priority: 'HIGH' as const },
        { title: 'Espresso Bean Sampler Box', price: 28.00, priority: 'MEDIUM' as const },
        { title: 'Cozy Wool Cabin Socks', price: 15.00, priority: 'LOW' as const },
        { title: 'Luxury Leather Travel Bag', price: 175.00, priority: 'LOW' as const }, // Over cap test item
      ],
    },
    {
      id: 'master-2',
      name: '🐘 White Elephant Contribution Ideas',
      items: [
        { title: 'Gourmet Hot Sauce Challenge Set', price: 35.00, priority: 'HIGH' as const },
        { title: 'Desktop Mini Retro Arcade Machine', price: 45.00, priority: 'HIGH' as const },
      ],
    },
  ];

  // Evaluations
  const eligibility = evaluateDrawEligibility(items, budgetMax, budgetHardLimit, isWhiteElephant);
  const basketTally = calculateClaimedBasketTotal(items, budgetMax);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const priceNum = parseFloat(newItemPrice);
    if (!newItemTitle.trim()) {
      setFormError('Item title is required.');
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Please enter a valid positive item price.');
      return;
    }

    if (isWhiteElephant && items.length >= 1) {
      setFormError('🐘 White Elephant Wishlist Manifests are strictly limited to 1 brought gift item per operative!');
      return;
    }

    const validation = validateItemBudget(priceNum, budgetMax, budgetHardLimit);
    if (!validation.isAllowed) {
      setFormError(validation.message);
      return;
    }

    const newItem: ManifestItemInput = {
      id: `item-${Date.now()}`,
      title: newItemTitle.trim(),
      price: priceNum,
      priority: newItemPriority,
      isClaimed: false,
    };

    setItems((prev) => [...prev, newItem]);
    setNewItemTitle('');
    setNewItemPrice('');
  };

  const handleRemoveItem = (id?: string) => {
    if (!id) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleToggleClaim = (id?: string) => {
    if (!id) return;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isClaimed: !i.isClaimed } : i))
    );
  };

  const handleImportPreset = (preset: typeof masterWishlistPresets[0], singleItemId?: string) => {
    if (isWhiteElephant) {
      // Pick selected single item or first item
      const itemToImport = singleItemId
        ? preset.items.find((i) => i.title === singleItemId)
        : preset.items[0];
      if (itemToImport) {
        setItems([
          {
            id: `we-${Date.now()}`,
            title: itemToImport.title,
            price: itemToImport.price,
            priority: 'HIGH',
            isClaimed: false,
          },
        ]);
      }
    } else {
      // Clone all valid items
      const cloned: ManifestItemInput[] = preset.items.map((item, idx) => ({
        id: `clone-${Date.now()}-${idx}`,
        title: item.title,
        price: item.price,
        priority: item.priority,
        isClaimed: false,
      }));
      setItems(cloned);
    }
    setShowImporter(false);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* HUD Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
            <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
              WORKSHOP LAB // DUAL MANIFEST & ANTI-OVERWISHING BENCH
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 text-white flex items-center gap-2">
            <span>Dual Manifest & Limit Validator</span>
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1">
            Test Secret Santa vs White Elephant rules, +20% anti-overwishing hard caps, buyer cart spend tallying, and pre-draw eligibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/workshop/draw"
            className="bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            🎯 Draw
          </Link>
          <Link
            href="/workshop/lifecycle"
            className="bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            ⏰ Schedule
          </Link>
          <Link
            href="/workshop/theme"
            className="bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            🎨 Theme
          </Link>
          <Link
            href="/workshop"
            className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors"
          >
            ← Hub
          </Link>
        </div>
      </div>

      {/* Top Controller: OpsLeader Event Settings */}
      <div className="p-6 rounded-3xl bg-slate-900 border-2 border-emerald-500/40 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-emerald-400">
              🎖️ OPSLEADER EVENT CONFIGURATION
            </h2>
            <p className="text-xs text-gray-400">
              Configure event gifting model and budget caps.
            </p>
          </div>

          {/* Event Gifting Type Switcher */}
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 font-mono text-xs">
            <button
              onClick={() => {
                setEventType('SECRET_SANTA');
                setItems([
                  { id: '1', title: 'Noise-Cancelling Earbuds', price: 49.99, priority: 'HIGH', isClaimed: false },
                  { id: '2', title: 'Whole Bean Coffee (2-Pack)', price: 24.50, priority: 'MEDIUM', isClaimed: true },
                ]);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                !isWhiteElephant
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🎅 Secret Santa (Multi-Item)
            </button>
            <button
              onClick={() => {
                setEventType('WHITE_ELEPHANT');
                setItems([
                  { id: 'we-1', title: 'Gourmet Hot Sauce Challenge Set', price: 35.00, priority: 'HIGH', isClaimed: false },
                ]);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                isWhiteElephant
                  ? 'bg-purple-500 text-slate-950 shadow-md font-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🐘 White Elephant (1 Gift Pool)
            </button>
          </div>
        </div>

        {/* Budget Inputs & 1-Click Recommendation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          
          {/* Target Spend (budgetMax) */}
          <div>
            <label className="block text-gray-300 mb-1 font-bold">
              1. TARGET SOFT BUDGET (Per Operative Spend):
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="number"
                min="5"
                max="500"
                value={budgetMax}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setBudgetMax(val);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
              />
            </div>
            <span className="text-[11px] text-gray-500 mt-1 block">
              Target spend amount that the assigned buyer aims to reach.
            </span>
          </div>

          {/* Optional Hard Cap (budgetHardLimit) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-300 font-bold">
                2. ANTI-OVERWISHING HARD CAP <span className="text-gray-500 font-normal">(Optional)</span>:
              </label>
              {budgetMax > 0 && (
                <button
                  type="button"
                  onClick={() => setBudgetHardLimit(calculateRecommendedHardLimit(budgetMax, 0.20))}
                  className="text-[10px] text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  ✨ Set +20% ({`$${calculateRecommendedHardLimit(budgetMax, 0.20).toFixed(2)}`})
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="number"
                min="5"
                max="1000"
                value={budgetHardLimit ?? ''}
                onFocus={() => setHardCapFocused(true)}
                onBlur={() => setHardCapFocused(false)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setBudgetHardLimit(isNaN(val) ? undefined : val);
                }}
                placeholder="No hard limit (Optional)"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Focused Helper Tooltip */}
            {hardCapFocused && (
              <div className="p-2 rounded bg-amber-950/80 border border-amber-500/40 text-amber-200 text-[11px] mt-1.5">
                🛡️ <em>"Prevent overwishing from greedy elves. Excludes users with non-compliant wishlists from the draw."</em>
              </div>
            )}
            {!hardCapFocused && (
              <span className="text-[11px] text-gray-500 mt-1 block">
                Maximum price allowed for any individual item. Blocks items above this price.
              </span>
            )}
          </div>

        </div>
      </div>

      {/* Pre-Draw Eligibility Warning Banner */}
      <div className={`p-4 sm:p-5 rounded-2xl border-2 font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg ${eligibility.statusColor}`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider">{eligibility.statusLabel}</span>
          </div>
          <p className="text-white/90 text-[11px]">{eligibility.bannerMessage}</p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={() => setShowImporter(true)}
            className="bg-slate-950 hover:bg-slate-800 text-sky-300 border border-sky-500/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            📦 Import Existing Wishlist Manifest
          </button>
        </div>
      </div>

      {/* Main Grid: Wishlist Editor & Buyer View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Add Item Form & Test Presets */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="p-6 rounded-2xl border bg-slate-900 border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                {isWhiteElephant ? '🐘 REGISTER BROUGHT GIFT' : '➕ ADD WISHLIST ITEM'}
              </h2>
              <span className="text-[11px] font-mono text-gray-500">
                {isWhiteElephant ? `${items.length}/1 Max` : `${items.length} Items`}
              </span>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-mono">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddItem} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">ITEM NAME:</label>
                <input
                  type="text"
                  required
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="e.g. Espresso Coffee Kit"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">PRICE ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="25.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>

                {!isWhiteElephant && (
                  <div>
                    <label className="block text-gray-400 mb-1 font-bold">PRIORITY:</label>
                    <select
                      value={newItemPriority}
                      onChange={(e) => setNewItemPriority(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="HIGH">High (Most Wanted)</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low (Idea)</option>
                    </select>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isWhiteElephant && items.length >= 1}
                className={`w-full py-2.5 px-4 rounded-xl font-bold font-mono text-xs transition-all shadow-md cursor-pointer ${
                  isWhiteElephant && items.length >= 1
                    ? 'bg-slate-800 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
              >
                {isWhiteElephant && items.length >= 1
                  ? '🔒 Gift Pool Locked (1/1 Reached)'
                  : '➕ Add to Manifest'}
              </button>
            </form>

            {/* Quick Test Injectors */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 font-mono text-xs">
              <span className="text-[11px] text-gray-400 block font-bold">1-CLICK TEST GIFTS:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => {
                    setNewItemTitle('Gourmet Coffee Roaster Kit');
                    setNewItemPrice('29.99');
                    setNewItemPriority('HIGH');
                  }}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[10px] text-left cursor-pointer"
                >
                  ☕ Coffee ($30)
                </button>
                <button
                  onClick={() => {
                    setNewItemTitle('LEGO Botanical Flower Set');
                    setNewItemPrice('49.99');
                    setNewItemPriority('HIGH');
                  }}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[10px] text-left cursor-pointer"
                >
                  🧱 LEGO ($50)
                </button>
                <button
                  onClick={() => {
                    setNewItemTitle('Wireless Gaming Mouse');
                    setNewItemPrice('59.50');
                    setNewItemPriority('MEDIUM');
                  }}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-amber-300 rounded border border-slate-800 text-[10px] text-left cursor-pointer"
                >
                  🖱️ Mouse ($59.50)
                </button>
                <button
                  onClick={() => {
                    setNewItemTitle('Luxury 4K Drone (Over Cap)');
                    setNewItemPrice('149.00');
                    setNewItemPriority('HIGH');
                  }}
                  className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded border border-rose-900/40 text-[10px] text-left cursor-pointer"
                >
                  🚁 Drone ($149 - Over)
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* Center & Right Column: Wishlist Items & Buyer View */}
        <div className="lg:col-span-2 space-y-6">

          {/* Perspective View Switcher */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between font-mono text-xs">
            <span className="text-gray-400">PERSPECTIVE:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setViewPerspective('OPERATIVE')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  viewPerspective === 'OPERATIVE'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-950 text-gray-400 hover:text-white'
                }`}
              >
                👤 Operative (Edit List)
              </button>
              <button
                onClick={() => setViewPerspective('BUYER')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  viewPerspective === 'BUYER'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-950 text-gray-400 hover:text-white'
                }`}
              >
                🎁 Assigned Buyer (Shop & Claim)
              </button>
            </div>
          </div>

          {/* Buyer Live Spend Meter (if Buyer View Active) */}
          {viewPerspective === 'BUYER' && !isWhiteElephant && (
            <div className="p-5 rounded-2xl bg-slate-900 border-2 border-emerald-500/40 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-bold uppercase tracking-wider">
                  🛍️ SECRET SANTA SHOPPING BASKET
                </span>
                <span className="text-gray-400">
                  Target Spend: <strong className="text-white">${budgetMax.toFixed(2)}</strong>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-950 h-3.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all ${
                    basketTally.isSoftBudgetMet ? 'bg-emerald-400' : 'bg-sky-400'
                  }`}
                  style={{
                    width: `${Math.min(100, (basketTally.claimedTotal / Math.max(1, budgetMax)) * 100)}%`,
                  }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-200">{basketTally.statusText}</span>
                <span className="font-bold text-amber-300">
                  Claimed: ${basketTally.claimedTotal.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Item List Cards */}
          <div className="p-6 rounded-2xl border bg-slate-900 border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono text-xs">
              <span className="font-bold text-white uppercase tracking-wider">
                {viewPerspective === 'OPERATIVE'
                  ? isWhiteElephant
                    ? '🐘 YOUR REGISTERED POOL GIFT'
                    : '📋 YOUR CLASSIFIED WISHLIST'
                  : '🎯 TARGET OPERATIVE WISHLIST (Classified)'}
              </span>
              <span className="text-gray-400">{items.length} Registered Items</span>
            </div>

            {items.length === 0 && (
              <div className="py-12 text-center text-xs font-mono text-gray-500 border border-dashed border-slate-800 rounded-xl">
                No items on this wishlist yet. Add ideas on the left or import an existing Wishlist Manifest!
              </div>
            )}

            <div className="space-y-3">
              {items.map((item) => {
                const validation = validateItemBudget(item.price, budgetMax, budgetHardLimit);

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      item.isClaimed && viewPerspective === 'BUYER'
                        ? 'bg-emerald-950/30 border-emerald-500/50'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        {item.priority && (
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                            item.priority === 'HIGH' ? 'bg-red-950 text-red-300 border border-red-800' :
                            item.priority === 'MEDIUM' ? 'bg-sky-950 text-sky-300 border border-sky-800' :
                            'bg-slate-900 text-gray-400'
                          }`}>
                            {item.priority}
                          </span>
                        )}
                        <h3 className="text-sm font-bold text-white font-sans">{item.title}</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs pt-1">
                        <span className="text-amber-400 font-bold text-sm">
                          ${item.price.toFixed(2)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${validation.badgeStyle}`}>
                          {validation.message}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 font-mono text-xs">
                      {viewPerspective === 'BUYER' ? (
                        <button
                          onClick={() => handleToggleClaim(item.id)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                            item.isClaimed
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-700'
                          }`}
                        >
                          {item.isClaimed ? '✓ Claimed (Purchased)' : '🛍️ Mark as Bought'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-gray-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

        </div>
      </div>

      {/* Wishlist Importer Modal Simulator */}
      {showImporter && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-sky-500/50 rounded-3xl p-6 max-w-xl w-full space-y-5 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">📦 IMPORT EXISTING WISHLIST MANIFEST</h3>
                <p className="text-gray-400 text-[11px]">
                  Clones items into a decoupled event snapshot.
                </p>
              </div>
              <button
                onClick={() => setShowImporter(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {masterWishlistPresets.map((preset) => (
                <div key={preset.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{preset.name}</span>
                    <span className="text-gray-400 text-[11px]">{preset.items.length} Items</span>
                  </div>

                  {isWhiteElephant ? (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-amber-300 block">
                        Pick 1 gift to bring to the Yankee Swap pool:
                      </span>
                      {preset.items.map((it, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleImportPreset(preset, it.title)}
                          className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-purple-900/40 border border-slate-800 text-[11px] flex justify-between cursor-pointer"
                        >
                          <span className="text-slate-200">{it.title}</span>
                          <span className="text-amber-400 font-bold">${it.price.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleImportPreset(preset)}
                      className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Clone All {preset.items.length} Items to Event
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowImporter(false)}
              className="w-full bg-slate-800 text-gray-300 py-2 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
