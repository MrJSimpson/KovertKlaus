'use client';

import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';

export default function FeaturesPage() {
  const { isDarkMode, toggleTheme, theme } = useTheme();

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme.pageBg}`}>
      
      {/* Header Bar */}
      <header className={`border-b transition-colors ${theme.headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-5 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-extrabold text-xl shadow-md bg-kk-primary text-kk-on-primary border border-kk-border-strong">
              🎁
            </div>
            <div className="min-w-0">
              <span className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 text-kk-on-header">
                KOVERT KLAUS
              </span>
              <span className={`text-xs block font-bold ${theme.textGoldOnDark}`}>Features & Specs</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              onClick={toggleTheme}
              title="Toggle Theme Mode"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`min-h-11 min-w-11 p-2 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${theme.btnToggle}`}
            >
              <span aria-hidden>{isDarkMode ? '🎅' : '🕶️'}</span>
              <span className="hidden sm:inline">{isDarkMode ? 'Klaus Mode' : 'Kovert Mode'}</span>
            </button>

            <Link
              href="/"
              className={`min-h-11 flex items-center whitespace-nowrap text-xs font-bold px-3 sm:px-4 py-2 rounded-xl transition-colors ${theme.btnPrimary}`}
            >
              ← Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        
        {/* Page Hero */}
        <div className="max-w-3xl mb-10 sm:mb-16">
          <span className={`text-xs font-mono font-bold uppercase tracking-widest block mb-2 text-kk-accent`}>
            SYSTEM ARCHITECTURE & FEATURES
          </span>
          <h1 className={`text-3xl sm:text-5xl font-black tracking-tight text-kk-heading`}>
            Built for Absolute Fairness, Stealth & Zero-Flake Reliability
          </h1>
          <p className={`mt-4 text-lg text-kk-muted`}>
            Explore the core algorithms, protection mechanisms, and architectural decisions that make KovertKlaus the premier gift exchange platform.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Sattolo Algorithm */}
          <div className={`p-6 sm:p-8 rounded-2xl border transition-all bg-kk-surface border-kk-border shadow-md`}>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-bold mb-6 bg-kk-success text-kk-on-success`}>
              🔗
            </div>
            <h2 className={`text-2xl font-bold mb-3 text-kk-heading`}>
              Sattolo's Derangement Algorithm
            </h2>
            <p className={`text-sm leading-relaxed mb-4 text-kk-muted`}>
              Unlike naive shuffle methods or standard random pairing that can leave leftover participants or reveal chain patterns, KovertKlaus utilizes <strong>Sattolo's Algorithm</strong> to generate a single, uniformly random cyclic permutation.
            </p>
            <ul className={`text-xs space-y-2 font-mono text-kk-brand`}>
              <li>✓ Guaranteed 1-to-1 cyclic mapping (A₁ ➔ A₂ ➔ ... ➔ A♙ ➔ A₁)</li>
              <li>✓ Zero self-assignment probability</li>
              <li>✓ Optimized for groups of 4 or more — provides genuine secrecy, surprising pairings, and intelligent couple filtering without awkward 3-person spoilers</li>
              <li>✓ Zero chain predictability — knowing your assignment reveals zero mathematical clues about other pairs</li>
            </ul>
          </div>

          {/* Demerit & Reliability System */}
          <div className={`p-6 sm:p-8 rounded-2xl border transition-all bg-kk-surface border-kk-border shadow-md`}>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-bold mb-6 bg-kk-warning text-kk-on-warning`}>
              🛡️
            </div>
            <h2 className={`text-2xl font-bold mb-3 text-kk-heading`}>
              Demerit & Reliability Tier Protection
            </h2>
            <p className={`text-sm leading-relaxed mb-4 text-kk-muted`}>
              Traditional Secret Santas suffer from non-delivery flakes. KovertKlaus introduces an automated Demerit System to maintain high trust:
            </p>
            <ul className={`text-xs space-y-2 font-mono text-kk-muted`}>
              <li>• <strong>0-2 Demerits:</strong> ACTIVE (Full participation privileges)</li>
              <li>• <strong>3 Demerits:</strong> REMOTE_RESTRICTED (Limited to in-person local exchanges)</li>
              <li>• <strong>&gt;3 Demerits:</strong> DISABLED (Account suspended)</li>
              <li className={'text-kk-brand font-semibold pt-1'}>
                ✓ <strong>Carrier Protection Waiver:</strong> Submitting a valid carrier tracking number automatically waives penalties if packages are delayed by USPS, FedEx, or UPS.
              </li>
            </ul>
          </div>

          {/* OpenGraph URL Web Scraper */}
          <div className={`p-6 sm:p-8 rounded-2xl border transition-all bg-kk-surface border-kk-border shadow-md`}>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-bold mb-6 bg-kk-success text-kk-on-success`}>
              ⚡
            </div>
            <h2 className={`text-2xl font-bold mb-3 text-kk-heading`}>
              Fast-Failover Product Scraper
            </h2>
            <p className={`text-sm leading-relaxed mb-4 text-kk-muted`}>
              Paste any store item link (Amazon, Target, MicroCenter, Etsy, etc.) into your wishlist. KovertKlaus automatically scrapes product title, thumbnail, price, and description.
            </p>
            <p className={`text-xs text-kk-muted`}>
              Includes a <strong>2.5s AbortController fast failover</strong>: if anti-bot protections block automatic metadata retrieval, a pre-filled manual entry modal instantly appears so you are never stuck waiting.
            </p>
          </div>

          {/* Local-Only White Elephant */}
          <div className={`p-6 sm:p-8 rounded-2xl border transition-all bg-kk-surface border-kk-border shadow-md`}>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-bold mb-6 bg-kk-danger-soft text-kk-on-danger-soft`}>
              🎁
            </div>
            <h2 className={`text-2xl font-bold mb-3 text-kk-heading`}>
              Local-Only White Elephant Rules
            </h2>
            <p className={`text-sm leading-relaxed mb-4 text-kk-muted`}>
              White Elephant and Yankee Swap exchanges are strictly restricted to local, in-person events (<code className={`font-mono text-xs font-bold text-kk-danger`}>isLocalOnly = true</code>). Digital White Elephant swaps are disabled to preserve authentic community interaction and stealing dynamics.
            </p>
          </div>

        </div>

        {/* License Banner */}
        <div className={`mt-10 sm:mt-16 p-6 sm:p-8 rounded-2xl border-2 bg-kk-surface border-kk-border-strong`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <span className={`text-xs font-mono font-bold uppercase tracking-widest block mb-1 text-kk-accent`}>
                BUSINESS SOURCE LICENSE 1.1
              </span>
              <h3 className={`text-xl font-bold text-kk-heading`}>
                100% Free Non-Commercial Self-Hosting
              </h3>
              <p className={`text-sm mt-1 max-w-2xl text-kk-muted`}>
                KovertKlaus is free for families, friend groups, non-profits, and home labs. On <strong>January 1, 2030</strong>, the codebase automatically transitions to <strong>GPLv3</strong> open source forever.
              </p>
            </div>
          </div>
        </div>

      </main>

    </div>
  );
}
