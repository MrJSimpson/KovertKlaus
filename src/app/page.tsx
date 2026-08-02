'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  // Light Mode by default for a warm, welcoming experience
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [missionCodeInput, setMissionCodeInput] = useState('');

  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col font-sans selection:bg-emerald-500 selection:text-white ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Announcement / Welcome Banner */}
      <div className={`text-xs py-2 px-4 text-center font-medium transition-colors ${
        isDarkMode ? 'bg-emerald-950 text-emerald-300 border-b border-emerald-900/50' : 'bg-emerald-600 text-white shadow-inner'
      }`}>
        <span>🎉 Welcome to KovertKlaus! Organize holiday & special occasion gift exchanges in under 60 seconds.</span>
      </div>

      {/* Main Header */}
      <header className={`border-b transition-colors sticky top-0 z-40 backdrop-blur-md ${
        isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-200/80 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-extrabold text-white text-xl shadow-md group-hover:scale-105 transition-transform">
              🎁
            </div>
            <div>
              <span className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                KovertKlaus
              </span>
              <span className="text-xs text-slate-500 block font-medium">Simple & Fun Gift Exchanges</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            <a href="#how-it-works" className={`transition-colors ${isDarkMode ? 'text-slate-300 hover:text-emerald-400' : 'text-slate-600 hover:text-emerald-600'}`}>
              How It Works
            </a>
            <a href="#benefits" className={`transition-colors ${isDarkMode ? 'text-slate-300 hover:text-emerald-400' : 'text-slate-600 hover:text-emerald-600'}`}>
              Why KovertKlaus
            </a>
            <Link href="/features" className={`transition-colors ${isDarkMode ? 'text-slate-300 hover:text-emerald-400' : 'text-slate-600 hover:text-emerald-600'}`}>
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
                  ? 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{isDarkMode ? '☀️ Light' : '🌙 Dark'}</span>
            </button>

            <button
              onClick={() => setJoinModalOpen(true)}
              className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all cursor-pointer hidden sm:inline-flex items-center gap-1 ${
                isDarkMode
                  ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-sm'
              }`}
            >
              <span>🔑 Enter Code</span>
            </button>

            <button
              onClick={() => setCreateModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer transform hover:-translate-y-0.5"
            >
              + Start Exchange
            </button>
          </div>

        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 pb-20 w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Welcoming Hero Copy */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              isDarkMode ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <span>✨ Secret Santa & Holiday Gift Exchanges Made Effortless</span>
            </div>

            <h1 className={`text-4xl sm:text-6xl font-black tracking-tight leading-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              The Easiest, Funnest Way to Organize <br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Secret Santa & Gift Exchanges
              </span>
            </h1>

            <p className={`text-lg max-w-2xl leading-relaxed ${
              isDarkMode ? 'text-slate-300' : 'text-slate-600'
            }`}>
              Bring your family, friends, or co-workers together! Create a gift exchange in 60 seconds, share universal wishlists, and enjoy a completely stress-free experience from start to delivery.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-7 py-4 rounded-2xl transition-all shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 text-base cursor-pointer transform hover:-translate-y-0.5"
              >
                <span>🎅 Organize a Gift Exchange</span>
              </button>

              <button
                onClick={() => setJoinModalOpen(true)}
                className={`font-semibold px-6 py-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-base cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800'
                    : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-md'
                }`}
              >
                <span>🔑 Join an Exchange (Enter Code)</span>
              </button>
            </div>

            {/* Customer Trust Badges */}
            <div className={`pt-6 grid grid-cols-3 gap-4 border-t text-xs font-semibold ${
              isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
            }`}>
              <div>
                <span className={`block font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>⚡ 60-Second Setup</span>
                <span>No complicated setup</span>
              </div>
              <div>
                <span className={`block font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>🎁 Easy Wishlists</span>
                <span>Add items from any site</span>
              </div>
              <div>
                <span className={`block font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>🚚 Shipping Updates</span>
                <span>Real-time tracking</span>
              </div>
            </div>

          </div>

          {/* Right Column: Friendly Product Card Preview */}
          <div className="lg:col-span-5">
            <div className={`rounded-3xl p-6 sm:p-8 border shadow-2xl transition-all relative overflow-hidden ${
              isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80 shadow-slate-200/50'
            }`}>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  <span>LIVE EXCHANGE PREVIEW</span>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  isDarkMode ? 'bg-emerald-950 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  Code: SIMPSON-2026
                </span>
              </div>

              {/* Sample Mission Info */}
              <div className="mt-6 space-y-4">
                <div className={`p-4 rounded-2xl border ${
                  isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">ANNUAL HOLIDAY EXCHANGE</div>
                  <div className={`text-xl font-black mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Simpson Family Secret Santa
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Budget: <strong className="text-emerald-600 font-bold">$25 – $50</strong></span>
                    <span>Exchange: <strong className="text-slate-700 dark:text-slate-300 font-semibold">Dec 25, 2026</strong></span>
                  </div>
                </div>

                {/* Sample Target Card */}
                <div className={`p-4 rounded-2xl border ${
                  isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">YOUR ASSIGNED SECRET TARGET</div>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <span className={`text-lg font-bold block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Sarah Simpson</span>
                      <span className="text-xs text-slate-400">Wishlist: 3 Items Attached</span>
                    </div>
                    <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl">
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
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest block mb-2">SIMPLE & EASY</span>
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
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl font-bold mb-6">
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
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="h-12 w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center text-xl font-bold mb-6">
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
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="h-12 w-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center text-xl font-bold mb-6">
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
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest block mb-2">WHY FAMILIES & FRIENDS LOVE US</span>
            <h2 className={`text-3xl sm:text-4xl font-black tracking-tight mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Never Settle for Flakes or Mismatched Gifts Again
            </h2>
            <p className={`text-base leading-relaxed mb-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              We built KovertKlaus so everyone actually gets a gift they love, on time, without awkward duplicate assignments or forgotten participants.
            </p>
            <div className="space-y-4 text-sm font-semibold">
              <div className="flex items-center gap-3 text-emerald-600">
                <span className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-xs">✓</span>
                <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>100% Fair 1-to-1 Target Assignments</span>
              </div>
              <div className="flex items-center gap-3 text-emerald-600">
                <span className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-xs">✓</span>
                <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>Automatic Wishlist Scraper for Any Store</span>
              </div>
              <div className="flex items-center gap-3 text-emerald-600">
                <span className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-xs">✓</span>
                <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>Reliability & Shipping Carrier Tracking Protection</span>
              </div>
            </div>
            <div className="pt-6">
              <Link
                href="/features"
                className="text-xs font-mono font-bold text-emerald-600 hover:text-emerald-700 underline flex items-center gap-1"
              >
                <span>Curious about our underlying algorithms & security specs? Read Features →</span>
              </Link>
            </div>
          </div>

          <div className={`p-8 rounded-3xl border shadow-xl ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Ready to start your exchange?
            </h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Organize your Secret Santa, Yankee Swap, or Holiday Exchange today. Free for all non-commercial groups!
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 text-center cursor-pointer"
            >
              Start Your Gift Exchange Now
            </button>
          </div>
        </div>
      </section>

      {/* Join Modal */}
      {joinModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 rounded-3xl max-w-md w-full shadow-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
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
                className={`w-full border rounded-2xl px-4 py-3 text-lg font-mono text-center tracking-widest uppercase mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-slate-50 border-slate-300 text-emerald-700'
                }`}
                maxLength={12}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setJoinModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-sm transition-colors cursor-pointer shadow-md"
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
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 rounded-3xl max-w-md w-full shadow-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-xl font-bold mb-2">🎅 Create Your Gift Exchange</h3>
            <p className="text-xs text-slate-500 mb-6">
              Set up your exchange parameters in seconds.
            </p>

            <div className="space-y-4 text-xs font-mono">
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-emerald-600 font-bold block mb-1">Quick Start Setup</span>
                <span className="text-slate-500">You can test live algorithm simulations on the Test Bench or launch full exchange operations.</span>
              </div>
              <div className="flex gap-3 font-sans">
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Close
                </button>
                <Link
                  href="/tests"
                  onClick={() => setCreateModalOpen(false)}
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-sm text-center transition-colors cursor-pointer shadow-md"
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
        isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-500 shadow-inner'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            © 2026 KovertKlaus by <span className="font-semibold text-slate-700 dark:text-slate-300">Joshua Simpson</span>. Made for families & friends.
          </div>
          <div className="flex gap-6 font-semibold">
            <Link href="/features" className="hover:text-emerald-600 transition-colors">Features & Specs</Link>
            <Link href="/tests" className="hover:text-emerald-600 transition-colors">Test Bench</Link>
            <a href="https://github.com/MrJSimpson/KovertKlaus" target="_blank" rel="noreferrer" className="hover:text-emerald-600 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
