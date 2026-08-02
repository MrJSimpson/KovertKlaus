'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FeaturesPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode
        ? 'bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950'
        : 'bg-stone-50 text-slate-900 selection:bg-red-600 selection:text-white'
    }`}>
      
      {/* Header Bar */}
      <header className={`border-b transition-colors ${
        isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-stone-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-white text-xl shadow-md ${
              isDarkMode
                ? 'bg-gradient-to-br from-sky-400 via-sky-500 to-slate-700'
                : 'bg-gradient-to-br from-red-600 via-red-700 to-emerald-800'
            }`}>
              🎁
            </div>
            <div>
              <span className={`text-2xl font-black tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                KOVERT KLAUS
              </span>
              <span className={`text-xs block font-bold ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>Features & Specs</span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-2 cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-700 text-sky-300 hover:bg-slate-800'
                  : 'bg-stone-100 border-stone-300 text-slate-700 hover:bg-stone-200'
              }`}
            >
              <span>{isDarkMode ? '☀️ Light' : '❄️ Dark (Icy)'}</span>
            </button>

            <Link
              href="/"
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors ${
                isDarkMode
                  ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
        
        {/* Page Hero */}
        <div className="max-w-3xl mb-16">
          <span className={`text-xs font-mono font-bold uppercase tracking-widest block mb-2 ${isDarkMode ? 'text-sky-400' : 'text-red-600'}`}>
            SYSTEM ARCHITECTURE & FEATURES
          </span>
          <h1 className={`text-4xl sm:text-5xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Built for Absolute Fairness, Stealth & Zero-Flake Reliability
          </h1>
          <p className={`mt-4 text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            Explore the core algorithms, protection mechanisms, and architectural decisions that make KovertKlaus the premier gift exchange platform.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Sattolo Algorithm */}
          <div className={`p-8 rounded-2xl border transition-all ${
            isDarkMode ? 'bg-slate-900 border-slate-800 shadow-slate-950/50' : 'bg-white border-stone-200 shadow-md'
          }`}>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-bold mb-6 ${
              isDarkMode ? 'bg-slate-950 text-sky-400 border border-sky-500/30' : 'bg-emerald-100 text-emerald-800'
            }`}>
              🔗
            </div>
            <h2 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Sattolo's Derangement Algorithm
            </h2>
            <p className={`text-sm leading-relaxed mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Unlike naive shuffle methods or standard random pairing that can leave leftover participants or reveal chain patterns, KovertKlaus utilizes <strong>Sattolo's Algorithm</strong> to generate a single, uniformly random cyclic permutation.
            </p>
            <ul className={`text-xs space-y-2 font-mono ${isDarkMode ? 'text-sky-300' : 'text-emerald-800'}`}>
              <li>✓ Guaranteed 1-to-1 cyclic mapping (A₁ ➔ A₂ ➔ ... ➔ A♙ ➔ A₁)</li>
              <li>✓ Zero self-assignment probability</li>
              <li>✓ Zero chain predictability — knowing your assignment reveals zero mathematical clues about other pairs</li>
            </ul>
          </div>

          {/* Demerit & Reliability System */}
          <div className={`p-8 rounded-2xl border transition-all ${
            isDarkMode ? 'bg-slate-900 border-slate-800 shadow-slate-950/50' : 'bg-white border-stone-200 shadow-md'
          }`}>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-bold mb-6 ${
              isDarkMode ? 'bg-slate-950 text-slate-200 border border-slate-700' : 'bg-amber-100 text-amber-800'
            }`}>
              🛡️
            </div>
            <h2 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Demerit & Reliability Tier Protection
            </h2>
            <p className={`text-sm leading-relaxed mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Traditional Secret Santas suffer from non-delivery flakes. KovertKlaus introduces an automated Demerit System to maintain high trust:
            </p>
            <ul className={`text-xs space-y-2 font-mono ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              <li>• <strong>0-2 Demerits:</strong> ACTIVE (Full participation privileges)</li>
              <li>• <strong>3 Demerits:</strong> REMOTE_RESTRICTED (Limited to in-person local exchanges)</li>
              <li>• <strong>&gt;3 Demerits:</strong> DISABLED (Account suspended)</li>
              <li className={isDarkMode ? 'text-sky-400 font-semibold pt-1' : 'text-emerald-800 font-semibold pt-1'}>
                ✓ <strong>Carrier Protection Waiver:</strong> Submitting a valid carrier tracking number automatically waives penalties if packages are delayed by USPS, FedEx, or UPS.
              </li>
            </ul>
          </div>

          {/* OpenGraph URL Web Scraper */}
          <div className={`p-8 rounded-2xl border transition-all ${
            isDarkMode ? 'bg-slate-900 border-slate-800 shadow-slate-950/50' : 'bg-white border-stone-200 shadow-md'
          }`}>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-bold mb-6 ${
              isDarkMode ? 'bg-slate-950 text-sky-400 border border-sky-500/30' : 'bg-teal-100 text-teal-800'
            }`}>
              ⚡
            </div>
            <h2 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Fast-Failover Product Scraper
            </h2>
            <p className={`text-sm leading-relaxed mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Paste any store item link (Amazon, Target, MicroCenter, Etsy, etc.) into your wishlist. KovertKlaus automatically scrapes product title, thumbnail, price, and description.
            </p>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Includes a <strong>2.5s AbortController fast failover</strong>: if anti-bot protections block automatic metadata retrieval, a pre-filled manual entry modal instantly appears so you are never stuck waiting.
            </p>
          </div>

          {/* Local-Only White Elephant */}
          <div className={`p-8 rounded-2xl border transition-all ${
            isDarkMode ? 'bg-slate-900 border-slate-800 shadow-slate-950/50' : 'bg-white border-stone-200 shadow-md'
          }`}>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-bold mb-6 ${
              isDarkMode ? 'bg-slate-950 text-slate-200 border border-slate-700' : 'bg-rose-100 text-rose-800'
            }`}>
              🎁
            </div>
            <h2 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Local-Only White Elephant Rules
            </h2>
            <p className={`text-sm leading-relaxed mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              White Elephant and Yankee Swap exchanges are strictly restricted to local, in-person events (<code className={`font-mono text-xs font-bold ${isDarkMode ? 'text-sky-400' : 'text-rose-700'}`}>isLocalOnly = true</code>). Digital White Elephant swaps are disabled to preserve authentic community interaction and stealing dynamics.
            </p>
          </div>

        </div>

        {/* License Banner */}
        <div className={`mt-16 p-8 rounded-2xl border ${
          isDarkMode ? 'bg-slate-900 border-sky-500/30' : 'bg-emerald-50/80 border-emerald-200'
        }`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <span className={`text-xs font-mono font-bold uppercase tracking-widest block mb-1 ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>
                BUSINESS SOURCE LICENSE 1.1
              </span>
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                100% Free Non-Commercial Self-Hosting
              </h3>
              <p className={`text-sm mt-1 max-w-2xl ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                KovertKlaus is free for families, friend groups, non-profits, and home labs. On <strong>January 1, 2030</strong>, the codebase automatically transitions to <strong>GPLv3</strong> open source forever.
              </p>
            </div>
            <Link
              href="/tests"
              className={`font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-md shrink-0 ${
                isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              Try Test Bench Simulation →
            </Link>
          </div>
        </div>

      </main>

    </div>
  );
}
