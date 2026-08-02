'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  // Light Mode by default (Christmas Red & Evergreen).
  // Dark Mode switches to Icy Winter Night (Light Blue & Silver).
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [missionCodeInput, setMissionCodeInput] = useState('');

  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col font-sans ${
      isDarkMode
        ? 'bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950'
        : 'bg-stone-50 text-slate-900 selection:bg-red-600 selection:text-white'
    }`}>
      
      {/* Announcement / Welcome Banner */}
      <div className={`text-xs py-2 px-4 text-center font-medium transition-colors ${
        isDarkMode
          ? 'bg-slate-900 text-sky-300 border-b border-sky-500/20 shadow-inner'
          : 'bg-red-600 text-white shadow-inner'
      }`}>
        <span>{isDarkMode ? '❄️ Winter Night Ops Active' : '🎄 Welcome to KovertKlaus! Organize gift exchanges in under 60 seconds.'}</span>
      </div>

      {/* Main Header */}
      <header className={`border-b transition-colors sticky top-0 z-40 backdrop-blur-md ${
        isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-stone-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-white text-xl shadow-md group-hover:scale-105 transition-all ${
              isDarkMode
                ? 'bg-gradient-to-br from-sky-400 via-sky-500 to-slate-700 shadow-sky-950/50'
                : 'bg-gradient-to-br from-red-600 via-red-700 to-emerald-800'
            }`}>
              🎁
            </div>
            <div>
              <span className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                KovertKlaus
              </span>
              <span className={`text-xs block font-bold ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>
                {isDarkMode ? 'Stealth Winter Exchange' : 'Simple & Fun Gift Exchanges'}
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            <a href="#how-it-works" className={`transition-colors ${isDarkMode ? 'text-slate-300 hover:text-sky-400' : 'text-slate-700 hover:text-red-600'}`}>
              How It Works
            </a>
            <a href="#benefits" className={`transition-colors ${isDarkMode ? 'text-slate-300 hover:text-sky-400' : 'text-slate-700 hover:text-red-600'}`}>
              Why KovertKlaus
            </a>
            <Link href="/features" className={`transition-colors ${isDarkMode ? 'text-slate-300 hover:text-sky-400' : 'text-slate-700 hover:text-red-600'}`}>
              Features & Specs
            </Link>
          </nav>

          {/* Controls & Action CTAs */}
          <div className="flex items-center gap-3">
            
            {/* Theme Toggle Button */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="Toggle Theme Mode"
              className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                isDarkMode
                  ? 'bg-slate-900 border-sky-500/30 text-sky-300 hover:bg-slate-800'
                  : 'bg-stone-100 border-stone-300 text-slate-700 hover:bg-stone-200'
              }`}
            >
              <span>{isDarkMode ? '☀️ Light' : '❄️ Dark (Icy)'}</span>
            </button>

            <button
              onClick={() => setJoinModalOpen(true)}
              className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all cursor-pointer hidden sm:inline-flex items-center gap-1 ${
                isDarkMode
                  ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-500/40 hover:text-sky-300'
                  : 'border-emerald-700/30 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 shadow-sm'
              }`}
            >
              <span>🔑 Enter Code</span>
            </button>

            <button
              onClick={() => setCreateModalOpen(true)}
              className={`font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer transform hover:-translate-y-0.5 ${
                isDarkMode
                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-950/60'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25'
              }`}
            >
              + Start Exchange
            </button>
          </div>

        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 pb-20 w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Hero Copy */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              isDarkMode
                ? 'bg-slate-900 text-sky-400 border border-sky-500/30'
                : 'bg-emerald-100/80 text-emerald-900 border border-emerald-300'
            }`}>
              <span>{isDarkMode ? '❄️ Winter Night Stealth Mode Active' : '🎅 Secret Santa & Holiday Gift Exchanges Made Effortless'}</span>
            </div>

            <h1 className={`text-4xl sm:text-6xl font-black tracking-tight leading-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              The Easiest, Funnest Way to Organize <br />
              <span className={
                isDarkMode
                  ? 'bg-gradient-to-r from-sky-400 via-cyan-300 to-slate-200 bg-clip-text text-transparent'
                  : 'bg-gradient-to-r from-red-600 via-rose-600 to-emerald-800 bg-clip-text text-transparent'
              }>
                Secret Santa & Gift Exchanges
              </span>
            </h1>

            <p className={`text-lg max-w-2xl leading-relaxed ${
              isDarkMode ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Bring your family, friends, or co-workers together! Create a gift exchange in 60 seconds, share universal wishlists, and enjoy a completely stress-free experience from start to delivery.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setCreateModalOpen(true)}
                className={`font-bold px-7 py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 text-base cursor-pointer transform hover:-translate-y-0.5 ${
                  isDarkMode
                    ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-950/60'
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                }`}
              >
                <span>🎅 Organize a Gift Exchange</span>
              </button>

              <button
                onClick={() => setJoinModalOpen(true)}
                className={`font-bold px-6 py-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-base cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white shadow-md'
                    : 'bg-emerald-800 text-white border-emerald-900 hover:bg-emerald-900 shadow-md'
                }`}
              >
                <span>🔑 Join an Exchange (Enter Code)</span>
              </button>
            </div>

            {/* Customer Trust Badges */}
            <div className={`pt-6 grid grid-cols-3 gap-4 border-t text-xs font-semibold ${
              isDarkMode ? 'border-slate-800 text-slate-400' : 'border-stone-200 text-slate-600'
            }`}>
              <div>
                <span className={`block font-bold text-sm ${isDarkMode ? 'text-sky-400' : 'text-red-700'}`}>⚡ 60-Second Setup</span>
                <span>No complicated setup</span>
              </div>
              <div>
                <span className={`block font-bold text-sm ${isDarkMode ? 'text-slate-200' : 'text-emerald-900'}`}>🎁 Easy Wishlists</span>
                <span>Add items from any site</span>
              </div>
              <div>
                <span className={`block font-bold text-sm ${isDarkMode ? 'text-sky-400' : 'text-red-700'}`}>🚚 Shipping Updates</span>
                <span>Real-time tracking</span>
              </div>
            </div>

          </div>

          {/* Right Column: Preview Card */}
          <div className="lg:col-span-5">
            <div className={`rounded-3xl p-6 sm:p-8 border shadow-2xl transition-all relative overflow-hidden ${
              isDarkMode
                ? 'bg-slate-900/90 border-slate-800 shadow-slate-950/80'
                : 'bg-white border-stone-200/80 shadow-stone-300/40'
            }`}>
              <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-slate-800">
                <div className={`flex items-center gap-2 text-xs font-bold ${isDarkMode ? 'text-sky-400' : 'text-red-600'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full inline-block animate-pulse ${isDarkMode ? 'bg-sky-400' : 'bg-red-600'}`}></span>
                  <span>LIVE EXCHANGE PREVIEW</span>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                  isDarkMode
                    ? 'bg-slate-950 text-sky-300 border-sky-500/30'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                }`}>
                  Code: SIMPSON-2026
                </span>
              </div>

              {/* Sample Mission Info */}
              <div className="mt-6 space-y-4">
                <div className={`p-4 rounded-2xl border ${
                  isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200'
                }`}>
                  <div className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>
                    ANNUAL HOLIDAY EXCHANGE
                  </div>
                  <div className={`text-xl font-black mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Simpson Family Secret Santa
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span>Budget: <strong className={isDarkMode ? 'text-sky-400 font-bold' : 'text-red-600 font-bold'}>$25 – $50</strong></span>
                    <span>Exchange: <strong className="text-slate-800 dark:text-slate-200 font-bold">Dec 25, 2026</strong></span>
                  </div>
                </div>

                {/* Sample Target Card */}
                <div className={`p-4 rounded-2xl border ${
                  isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-emerald-50/60 border-emerald-200'
                }`}>
                  <div className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-emerald-900'}`}>
                    YOUR ASSIGNED SECRET TARGET
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <span className={`text-lg font-bold block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Sarah Simpson</span>
                      <span className="text-xs text-slate-500">Wishlist: 3 Items Attached</span>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm ${
                      isDarkMode ? 'bg-sky-500 text-slate-950' : 'bg-red-600 text-white'
                    }`}>
                      View Wishlist →
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className={`py-20 border-t transition-colors ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-stone-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className={`text-xs font-bold uppercase tracking-widest block mb-2 ${isDarkMode ? 'text-sky-400' : 'text-red-600'}`}>
              SIMPLE & EASY
            </span>
            <h2 className={`text-3xl sm:text-4xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              How KovertKlaus Works in 3 Easy Steps
            </h2>
            <p className={`mt-3 text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              No confusing signups or complicated spreadsheets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Step 1 */}
            <div className={`p-8 rounded-3xl border transition-all ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200 shadow-sm'
            }`}>
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-xl font-bold mb-6 shadow-md ${
                isDarkMode ? 'bg-sky-500 text-slate-950 shadow-sky-950/40' : 'bg-red-600 text-white shadow-red-600/20'
              }`}>
                1
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Create Your Exchange
              </h3>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Set your budget limit, exchange date, and invite your group using a simple 8-character code or shareable link.
              </p>
            </div>

            {/* Step 2 */}
            <div className={`p-8 rounded-3xl border transition-all ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200 shadow-sm'
            }`}>
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-xl font-bold mb-6 shadow-md ${
                isDarkMode ? 'bg-slate-700 text-sky-300 border border-slate-600' : 'bg-emerald-800 text-white shadow-emerald-800/20'
              }`}>
                2
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Build Your Wishlist
              </h3>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Add gift ideas from any online store! Paste item links and KovertKlaus automatically grabs titles, prices, and photos.
              </p>
            </div>

            {/* Step 3 */}
            <div className={`p-8 rounded-3xl border transition-all ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200 shadow-sm'
            }`}>
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-xl font-bold mb-6 shadow-md ${
                isDarkMode ? 'bg-sky-500 text-slate-950 shadow-sky-950/40' : 'bg-red-600 text-white shadow-red-600/20'
              }`}>
                3
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Get Matched & Ship
              </h3>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Everyone gets their secret recipient assigned automatically. Ship your gift, enter tracking, and celebrate together!
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Benefits / Why Us */}
      <section id="benefits" className="py-20 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <span className={`text-xs font-bold uppercase tracking-widest block mb-2 ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>
              WHY FAMILIES & FRIENDS LOVE US
            </span>
            <h2 className={`text-3xl sm:text-4xl font-black tracking-tight mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Never Settle for Flakes or Mismatched Gifts Again
            </h2>
            <p className={`text-base leading-relaxed mb-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              We built KovertKlaus so everyone actually gets a gift they love, on time, without awkward duplicate assignments or forgotten participants.
            </p>
            <div className="space-y-4 text-sm font-semibold">
              <div className={`flex items-center gap-3 ${isDarkMode ? 'text-sky-400' : 'text-red-600'}`}>
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDarkMode ? 'bg-slate-900 border border-sky-500/40' : 'bg-red-100'
                }`}>✓</span>
                <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>100% Fair 1-to-1 Target Assignments</span>
              </div>
              <div className={`flex items-center gap-3 ${isDarkMode ? 'text-slate-300' : 'text-emerald-800'}`}>
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-emerald-100'
                }`}>✓</span>
                <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>Automatic Wishlist Scraper for Any Store</span>
              </div>
              <div className={`flex items-center gap-3 ${isDarkMode ? 'text-sky-400' : 'text-red-600'}`}>
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDarkMode ? 'bg-slate-900 border border-sky-500/40' : 'bg-red-100'
                }`}>✓</span>
                <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>Reliability & Shipping Carrier Tracking Protection</span>
              </div>
            </div>
            <div className="pt-6">
              <Link
                href="/features"
                className={`text-xs font-bold underline flex items-center gap-1 ${
                  isDarkMode ? 'text-sky-400 hover:text-sky-300' : 'text-emerald-800 hover:text-emerald-900'
                }`}
              >
                <span>Curious about our underlying algorithms & security specs? Read Features →</span>
              </Link>
            </div>
          </div>

          {/* CTA Card */}
          <div className={`p-8 rounded-3xl border shadow-xl ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
          }`}>
            <h3 className={`text-2xl font-black mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Ready to start your exchange?
            </h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Organize your Secret Santa, Yankee Swap, or Holiday Exchange today. Free for all non-commercial groups!
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className={`w-full font-bold py-4 px-6 rounded-2xl transition-all shadow-lg text-center cursor-pointer text-base ${
                isDarkMode
                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-950/50'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/25'
              }`}
            >
              Start Your Gift Exchange Now 🎅
            </button>
          </div>
        </div>
      </section>

      {/* Join Modal */}
      {joinModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 rounded-3xl max-w-md w-full shadow-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-stone-200 text-slate-900'
          }`}>
            <h3 className="text-xl font-bold mb-2">🔑 Join a Gift Exchange</h3>
            <p className="text-xs text-slate-500 mb-6">
              Enter the 8-character Exchange Code sent to you by your organizer.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); alert(`Exchange Code submitted: ${missionCodeInput}`); setJoinModalOpen(false); }}>
              <input
                type="text"
                placeholder="e.g. SIMPSON-2026"
                value={missionCodeInput}
                onChange={(e) => setMissionCodeInput(e.target.value.toUpperCase())}
                className={`w-full border rounded-2xl px-4 py-3 text-lg font-mono text-center tracking-widest uppercase mb-4 focus:outline-none focus:ring-2 ${
                  isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-sky-400 focus:ring-sky-400'
                    : 'bg-stone-50 border-stone-300 text-red-700 focus:ring-red-600'
                }`}
                maxLength={12}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setJoinModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-stone-100 text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-colors cursor-pointer shadow-md ${
                    isDarkMode ? 'bg-sky-500 hover:bg-sky-400 text-slate-950' : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  Join Exchange
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 rounded-3xl max-w-md w-full shadow-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-stone-200 text-slate-900'
          }`}>
            <h3 className="text-xl font-bold mb-2">🎅 Create Your Gift Exchange</h3>
            <p className="text-xs text-slate-500 mb-6">
              Set up your exchange parameters in seconds.
            </p>

            <div className="space-y-4 text-xs font-mono">
              <div className={`p-4 rounded-2xl border ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <span className={`font-bold block mb-1 ${isDarkMode ? 'text-sky-400' : 'text-emerald-900'}`}>Quick Start Setup</span>
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>You can test live algorithm simulations on the Test Bench or launch full exchange operations.</span>
              </div>
              <div className="flex gap-3 font-sans">
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-stone-100 text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  Close
                </button>
                <Link
                  href="/tests"
                  onClick={() => setCreateModalOpen(false)}
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm text-center transition-colors cursor-pointer shadow-md ${
                    isDarkMode ? 'bg-sky-500 hover:bg-sky-400 text-slate-950' : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  Go to Test Bench
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={`border-t py-8 text-xs font-medium transition-colors ${
        isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-white border-stone-200 text-slate-500 shadow-inner'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            © 2026 KovertKlaus by <span className="font-semibold text-slate-700 dark:text-slate-300">Joshua Simpson</span>. Made for families & friends.
          </div>
          <div className="flex gap-6 font-semibold">
            <Link href="/features" className={`transition-colors ${isDarkMode ? 'hover:text-sky-400' : 'hover:text-red-600'}`}>Features & Specs</Link>
            <Link href="/tests" className={`transition-colors ${isDarkMode ? 'hover:text-sky-400' : 'hover:text-red-600'}`}>Test Bench</Link>
            <a href="https://github.com/MrJSimpson/KovertKlaus" target="_blank" rel="noreferrer" className={`transition-colors ${isDarkMode ? 'hover:text-sky-400' : 'hover:text-red-600'}`}>GitHub</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
