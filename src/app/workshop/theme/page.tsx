'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { Badge, FilterContainer, FilterTab, SeasonalLightsStrand } from '@/components/ui';
import { LightsStrandType, getThemeClasses } from '@/lib/theme';
import { formatCodename } from '@/lib/security';

export default function WorkshopThemeGallery() {
  const { isDarkMode } = useTheme();

  // Local interactive overrides for sandbox testing
  const [selectedMode, setSelectedMode] = useState<'KOVERT' | 'KLAUS'>(isDarkMode ? 'KOVERT' : 'KLAUS');
  const [selectedStrand, setSelectedStrand] = useState<LightsStrandType>('christmas_bulbs');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  // Resolved tokens for local inspection
  const isGalleryDark = selectedMode === 'KOVERT';
  const tokens = getThemeClasses(isGalleryDark);

  const seasonalPresets: { id: string; name: string; strand: LightsStrandType; season: string; desc: string }[] = [
    {
      id: 'winter_holiday',
      name: 'Winter Holiday (Klaus & Kovert)',
      strand: 'christmas_bulbs',
      season: 'winter',
      desc: 'Evergreen pines, cranberry red accents, and glowing festive holiday bulbs.',
    },
    {
      id: 'spring_egg_hunt',
      name: 'Spring Egg Hunt (Meadow & Shadow)',
      strand: 'easter_eggs',
      season: 'spring',
      desc: 'Pastel clover greens, lilac purple ribbons, and decorated Easter eggs.',
    },
    {
      id: 'tropic_klaus',
      name: 'Tropic Klaus (Cabana & Luau)',
      strand: 'tropic_lanterns',
      season: 'summer',
      desc: 'Sunset gold, oceanic cyan, luau paper lanterns, and tropical tiki vibes.',
    },
    {
      id: 'spooky_autumn',
      name: 'Spooky Autumn (Harvest & Haunted)',
      strand: 'spooky_pumpkins',
      season: 'autumn',
      desc: 'Pumpkin orange, haunted violet, midnight fog, and glowing jack-o-lanterns.',
    },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-purple-400 animate-pulse inline-block"></span>
            <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-purple-950/80 text-purple-300 border border-purple-500/30">
              WORKSHOP LAB // DESIGN SYSTEM & TOKENS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 text-white flex items-center gap-2">
            <span>Design Token & Theme Inspection Gallery</span>
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1">
            Inspect live UI tokens across Klaus Mode 🎄 and Kovert Mode ❄️ with animated seasonal lights strands.
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
            href="/workshop/scraper"
            className="bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            🔎 Scraper
          </Link>
          <Link
            href="/workshop"
            className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors"
          >
            ← Hub
          </Link>
        </div>
      </div>

      {/* Mode & Season Sandbox Controller */}
      <div className="p-6 rounded-3xl bg-slate-900 border-2 border-purple-500/40 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-purple-400">
              🎨 THEME SANDBOX CONTROLLER
            </h2>
            <p className="text-xs text-gray-400">
              Switch visual mode and seasonal presets to preview real-time token rendering.
            </p>
          </div>

          {/* Mode Switcher Toggle */}
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 font-mono text-xs">
            <button
              onClick={() => setSelectedMode('KOVERT')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                selectedMode === 'KOVERT'
                  ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              ❄️ Kovert Mode (Dark)
            </button>
            <button
              onClick={() => setSelectedMode('KLAUS')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                selectedMode === 'KLAUS'
                  ? 'bg-red-700 text-white shadow-md font-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🎄 Klaus Mode (Light)
            </button>
          </div>
        </div>

        {/* 4 Seasonal Preset Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {seasonalPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedStrand(preset.strand)}
              className={`p-3.5 rounded-2xl text-left border transition-all font-mono text-xs cursor-pointer ${
                selectedStrand === preset.strand
                  ? 'bg-purple-950/60 border-purple-400 shadow-lg shadow-purple-950/60 text-white'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-gray-400'
              }`}
            >
              <div className="font-bold text-slate-100 flex items-center justify-between">
                <span>{preset.name}</span>
                {selectedStrand === preset.strand && <span className="text-purple-400 font-black">✓</span>}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 line-clamp-2 font-sans">{preset.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Animated Seasonal Lights Strand Showcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
            ✨ ANIMATED SEASONAL LIGHTS STRAND ({selectedStrand.toUpperCase()})
          </h2>
          <div className="flex gap-2">
            {(['christmas_bulbs', 'easter_eggs', 'tropic_lanterns', 'spooky_pumpkins'] as LightsStrandType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedStrand(type)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  selectedStrand === type
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-slate-800 text-gray-400 hover:text-white'
                }`}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <SeasonalLightsStrand type={selectedStrand} isDarkMode={isGalleryDark} />
        </div>
      </div>

      {/* Side-by-Side Component Showcase Preview Box */}
      <div className={`p-6 sm:p-8 rounded-3xl border-2 transition-all space-y-8 ${tokens.sectionFrame}`}>
        
        {/* Gallery Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className={`text-2xl font-black ${tokens.heroGradient}`}>
              KovertKlaus UI Component Showcase
            </div>
            <p className={`text-xs mt-1 ${tokens.textSubLabel}`}>
              Active Simulation Target: <strong className="font-mono">{selectedMode} MODE</strong>
            </p>
          </div>
          <Badge variant={isGalleryDark ? 'code' : 'secret-santa'}>
            {isGalleryDark ? '❄️ KOVERT ACTIVE' : '🎄 KLAUS ACTIVE'}
          </Badge>
        </div>

        {/* Section 1: Typography & Headings */}
        <div className="space-y-3">
          <div className={`text-xs font-mono font-bold uppercase tracking-wider ${tokens.textBrand}`}>
            1. TYPOGRAPHY & BRAND TOKENS
          </div>
          <div className={`p-5 rounded-2xl border ${tokens.cardInnerBg} space-y-3`}>
            <h1 className={`text-2xl font-black ${tokens.textHeading}`}>
              Classified Holiday Operation: Zion Stealth 2026
            </h1>
            <p className={`text-sm ${tokens.heroSubtext}`}>
              Operatives must maintain strict protocol and build classified wishlists before the assignment deadline.
            </p>
            <div className="flex flex-wrap gap-3 text-xs font-mono pt-2">
              <span className={tokens.textAccent}>ACCENT: Dec 25, 2026</span>
              <span className={tokens.textBrand}>BRAND: KovertKlaus HQ</span>
              <span className={tokens.textDate}>DATE: Today! 🎉</span>
              <span className="font-bold">{formatCodename('Joshua', 'Agent: 007')}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Buttons & Actions */}
        <div className="space-y-3">
          <div className={`text-xs font-mono font-bold uppercase tracking-wider ${tokens.textBrand}`}>
            2. BUTTON TOKEN GALLERY
          </div>
          <div className={`p-5 rounded-2xl border ${tokens.cardInnerBg} space-y-4`}>
            <div className="flex flex-wrap items-center gap-3">
              <button className={`py-2.5 px-4 rounded-xl text-xs font-bold ${tokens.btnPrimary} cursor-pointer`}>
                btnPrimary (Main Action)
              </button>
              <button className={`py-2.5 px-4 rounded-xl text-xs font-bold ${tokens.btnSecondary} cursor-pointer`}>
                btnSecondary
              </button>
              <button className={`py-2.5 px-4 rounded-xl text-xs font-bold ${tokens.btnEmerald} cursor-pointer`}>
                btnEmerald
              </button>
              <button className={`py-2.5 px-4 rounded-xl text-xs font-bold ${tokens.btnAmber} cursor-pointer`}>
                btnAmber
              </button>
              <button className={`py-2.5 px-4 rounded-xl text-xs font-bold ${tokens.btnSky} cursor-pointer`}>
                btnSky
              </button>
              <button className={`py-2.5 px-4 rounded-xl text-xs font-bold ${tokens.btnPurple} cursor-pointer`}>
                btnPurple
              </button>
              <button className={`py-2.5 px-4 rounded-xl text-xs font-bold ${tokens.btnNeutral} cursor-pointer`}>
                btnNeutral
              </button>
              <button disabled className={`py-2.5 px-4 rounded-xl text-xs font-bold ${tokens.inputDisabled}`}>
                Disabled Action
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Badges & Status Pills */}
        <div className="space-y-3">
          <div className={`text-xs font-mono font-bold uppercase tracking-wider ${tokens.textBrand}`}>
            3. BADGES & COUNTDOWN PILLS
          </div>
          <div className={`p-5 rounded-2xl border ${tokens.cardInnerBg} space-y-4 font-mono text-xs`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`px-3 py-1 rounded-full ${tokens.badgeCode}`}>KOVERT-9999</span>
              <span className={`px-3 py-1 rounded-full ${tokens.badgeSecretSanta}`}>Secret Santa</span>
              <span className={`px-3 py-1 rounded-full ${tokens.badgeWhiteElephant}`}>White Elephant</span>
              <span className={`px-3 py-1 rounded-full ${tokens.badgeAmber}`}>Amber Alert</span>
              <span className={`px-3 py-1 rounded-full ${tokens.badgeRose}`}>Demerit Citation</span>
            </div>

            {/* Countdown Milestone Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className={`p-3 rounded-xl border ${tokens.badgeCountdown}`}>
                <div className="text-[10px] opacity-75">STANDARD COUNTDOWN</div>
                <div className="font-bold text-sm mt-0.5">In 14 Days</div>
              </div>

              <div className={`p-3 rounded-xl border ${tokens.badgeCountdownUrgent}`}>
                <div className="text-[10px] opacity-75">URGENT COUNTDOWN (&le; 3d)</div>
                <div className="font-bold text-sm mt-0.5">In 2 Days ⏳</div>
              </div>

              <div className={`p-3 rounded-xl border ${tokens.badgeCountdownToday}`}>
                <div className="text-[10px] opacity-75">CELEBRATORY EVENT DAY</div>
                <div className="font-bold text-sm mt-0.5">Today! 🎉</div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: OpsLeader Console Card */}
        <div className="space-y-3">
          <div className={`text-xs font-mono font-bold uppercase tracking-wider ${tokens.textBrand}`}>
            4. OPSLEADER COMMAND CONSOLE CARD
          </div>
          <div className={`p-6 rounded-2xl border ${tokens.consoleCard} space-y-3`}>
            <div className="flex items-center justify-between">
              <div className={tokens.consoleHeading}>OPSLEADER CONSOLE</div>
              <span className={tokens.consoleBadge}>MISSION ORGANIZER</span>
            </div>
            <p className={tokens.consoleText}>
              Host controls are active. You have executive clearance to stage 2-way swaps and broadcast reminders.
            </p>
            <div className="flex gap-2 pt-2">
              <button className={`py-2 px-3.5 rounded-xl text-xs font-bold ${tokens.btnPrimary} cursor-pointer`}>
                🎯 Open Swap Console
              </button>
              <button className={`py-2 px-3.5 rounded-xl text-xs font-bold ${tokens.btnSecondary} cursor-pointer`}>
                📢 Broadcast Alert
              </button>
            </div>
          </div>
        </div>

        {/* Section 5: Filter Bar & Input Controls */}
        <div className="space-y-3">
          <div className={`text-xs font-mono font-bold uppercase tracking-wider ${tokens.textBrand}`}>
            5. FILTER BARS & INPUT FIELDS
          </div>
          <div className={`p-5 rounded-2xl border ${tokens.cardInnerBg} space-y-4`}>
            <FilterContainer>
              <FilterTab active={activeFilter === 'ALL'} onClick={() => setActiveFilter('ALL')}>
                All Operatives (12)
              </FilterTab>
              <FilterTab active={activeFilter === 'READY'} onClick={() => setActiveFilter('READY')}>
                Wishlists Ready (10)
              </FilterTab>
              <FilterTab active={activeFilter === 'PENDING'} onClick={() => setActiveFilter('PENDING')}>
                Pending Enlistment (2)
              </FilterTab>
            </FilterContainer>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className={`block text-xs font-mono mb-1 ${tokens.textLabel}`}>ACTIVE TEXT INPUT:</label>
                <input
                  type="text"
                  defaultValue="Agent: Trinity"
                  className={`w-full rounded-xl px-3 py-2 text-xs border ${tokens.inputBg}`}
                />
              </div>
              <div>
                <label className={`block text-xs font-mono mb-1 ${tokens.textLabel}`}>LOCKED / READONLY INPUT:</label>
                <input
                  type="text"
                  disabled
                  defaultValue="EXCHANGE-CLASSIFIED-CIPHER"
                  className={`w-full rounded-xl px-3 py-2 text-xs border ${tokens.inputDisabled}`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 6: Alert Callouts */}
        <div className="space-y-3">
          <div className={`text-xs font-mono font-bold uppercase tracking-wider ${tokens.textBrand}`}>
            6. ALERTS & NOTIFICATIONS
          </div>
          <div className="space-y-3 font-mono text-xs">
            <div className={`p-4 rounded-xl border ${tokens.alertSuccess}`}>
              ✓ Success: Target assignments generated with 0 rule violations.
            </div>
            <div className={`p-4 rounded-xl border ${tokens.alertWarning}`}>
              ⚠️ Warning: 2 operatives have not yet submitted their classified Wishlist Manifests.
            </div>
            <div className={`p-4 rounded-xl border ${tokens.alertError}`}>
              🚫 Error: Over-constrained matching rules prevented cyclic derangement.
            </div>
          </div>
        </div>

      </div>

      {/* Raw Token Dictionary Inspector */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between text-slate-300 border-b border-slate-800 pb-2">
          <span className="font-bold">📋 RESOLVED TAILWIND TOKENS DICTIONARY ({selectedMode})</span>
          <span className="text-gray-500 text-[11px]">{Object.keys(tokens).length} ACTIVE TOKENS</span>
        </div>
        <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-sky-300 overflow-x-auto max-h-72">
          {JSON.stringify(tokens, null, 2)}
        </pre>
      </div>

    </div>
  );
}
