'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [missionCodeInput, setMissionCodeInput] = useState('');
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Top Classification Bar */}
      <div className="bg-slate-900 border-b border-emerald-500/20 text-xs py-1.5 px-4 font-mono flex items-center justify-between text-slate-400">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 font-semibold uppercase tracking-wider">SYSTEM STATUS: OPERATIONAL</span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline">BSL 1.1 FREE SELF-HOSTING ACTIVE</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/tests"
            className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 font-semibold"
          >
            <span>⚡ ALGORITHM TEST BENCH</span>
          </Link>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-extrabold text-slate-950 text-xl shadow-lg shadow-emerald-950/50">
            K
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              KOVERT KLAUS
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-mono">
                v1.0
              </span>
            </span>
            <span className="text-xs text-slate-400 block font-mono">Stealth Gift Exchange Architecture</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
          <a href="#algorithm" className="hover:text-emerald-400 transition-colors">Sattolo Protocol</a>
          <a href="#licensing" className="hover:text-emerald-400 transition-colors">Licensing & SaaS</a>
          <Link href="/tests" className="text-emerald-400 hover:text-emerald-300 font-mono text-xs bg-emerald-950/50 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-all">
            Test Bench →
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 pt-8 pb-16 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Headline & Primary CTAs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-emerald-500/30 text-xs font-mono text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              <span>CLASSIFIED GIFT EXCHANGE SYSTEM</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-none">
              Stealth Ops <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Gift Exchanges
              </span> <br />
              Zero Leaks & Pure Fairness.
            </h1>

            <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
              KovertKlaus replaces predictable Secret Santa apps with a mathematically proven <strong className="text-white">Sattolo Derangement Algorithm</strong>, a <strong className="text-white">Demerit & Reliability System</strong> with carrier tracking protection, and OpenGraph fast-failover wishlist scraping.
            </p>

            {/* CTAs */}
            <div className="pt-4 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3.5 rounded-xl transition-all shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 text-base cursor-pointer transform hover:-translate-y-0.5"
              >
                <span>🚀 Launch New Operation</span>
              </button>

              <button
                onClick={() => setJoinModalOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-100 font-semibold px-6 py-3.5 rounded-xl border border-slate-700/80 transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
              >
                <span>🔑 Enter Mission Code</span>
              </button>

              <Link
                href="/tests"
                className="bg-slate-900/60 hover:bg-slate-800/80 text-emerald-400 font-mono font-medium px-5 py-3.5 rounded-xl border border-emerald-500/30 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <span>🧪 Test Bench</span>
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-slate-800 text-xs font-mono text-slate-400">
              <div>
                <span className="text-white font-bold block text-sm">100% 1-to-1</span>
                <span>Sattolo Single Cycle</span>
              </div>
              <div>
                <span className="text-white font-bold block text-sm">Zero Flakes</span>
                <span>Demerit Protection</span>
              </div>
              <div>
                <span className="text-white font-bold block text-sm">Free Self-Host</span>
                <span>BSL 1.1 Non-Commercial</span>
              </div>
            </div>
          </div>

          {/* Right Column: Mission Console Preview */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
              <div className="absolute top-0 right-0 p-3 opacity-10 font-black text-7xl font-mono text-emerald-400 select-none">
                KK-01
              </div>

              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
                  <span>TACTICAL BRIEFING</span>
                </div>
                <span className="font-mono text-xs text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                  ENCRYPTION OK
                </span>
              </div>

              {/* Console Quick Operation Card */}
              <div className="mt-6 space-y-4 font-mono text-xs">
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-2">
                  <div className="text-slate-400 text-[11px] uppercase tracking-wider">OPERATION NAME</div>
                  <div className="text-white font-bold text-base font-sans">Simpson Holiday Stealth Ops</div>
                  <div className="flex justify-between pt-2 border-t border-slate-900 text-slate-400">
                    <span>OPS LEADER: <span className="text-emerald-400">Joshua Simpson</span></span>
                    <span>ROSTER: <span className="text-white font-bold">4 AGENTS</span></span>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <div className="text-slate-400 text-[11px] uppercase tracking-wider">ASSIGNMENT GENERATION</div>
                  <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-emerald-500/20">
                    <span className="text-slate-300">Agent Shadow (#01)</span>
                    <span className="text-emerald-400 font-bold">➔ Agent Falcon</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-300">Agent Falcon (#02)</span>
                    <span className="text-emerald-400 font-bold">➔ Agent Ghost</span>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <Link
                    href="/tests"
                    className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 font-semibold font-mono"
                  >
                    <span>Run interactive test bench simulation →</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Feature Grid */}
        <section id="features" className="mt-24 pt-16 border-t border-slate-800">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest block mb-2">ENGINEERING HIGHLIGHTS</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Built for Stealth, Reliability & Security</h2>
            <p className="text-slate-400 mt-3 text-sm">Every line of code in KovertKlaus is engineered to solve the flaws of traditional Secret Santa applications.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-2xl hover:border-emerald-500/30 transition-all">
              <div className="h-12 w-12 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl font-bold mb-6">
                🔗
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Sattolo Derangement Protocol</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Uses Sattolo's algorithm to form a single, uniformly random cyclic permutation. Revealing one assignment gives away zero mathematical clues about the rest of the group.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-2xl hover:border-emerald-500/30 transition-all">
              <div className="h-12 w-12 rounded-xl bg-amber-950 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl font-bold mb-6">
                ⚖️
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Demerit & Reliability Tiers</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Prevents non-delivery flakes. Operatives earn demerits for failing to ship on time. Includes <strong className="text-slate-200">Carrier Tracking Waiver</strong> protection if packages are delayed by carriers.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-2xl hover:border-emerald-500/30 transition-all">
              <div className="h-12 w-12 rounded-xl bg-teal-950 text-teal-400 border border-teal-500/30 flex items-center justify-center text-xl font-bold mb-6">
                ⚡
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Fast-Failover URL Scraper</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Scrapes product titles, images, and prices using OpenGraph metadata with a 2.5s fast timeout fallback so users are never stuck waiting on anti-bot protected sites.
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* Join Mission Modal */}
      {joinModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <span>🔑 Enlist in Operation</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Enter the 8-character Mission Code provided by your OpsLeader to join the roster.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); alert(`Mission Code submitted: ${missionCodeInput}`); setJoinModalOpen(false); }}>
              <input
                type="text"
                placeholder="e.g. KOVERT-8X92"
                value={missionCodeInput}
                onChange={(e) => setMissionCodeInput(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-lg font-mono text-emerald-400 text-center tracking-widest uppercase mb-4 focus:outline-none focus:border-emerald-500"
                maxLength={11}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setJoinModalOpen(false)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  Enlist Field Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Mission Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <span>🚀 Launch New Operation</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Set up your Stealth Ops gift exchange parameters.
            </p>

            <div className="space-y-4 text-xs font-mono">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-emerald-400 block font-bold mb-1">Interactive Operations Creator</span>
                <span className="text-slate-400">To test full operation setups, try the interactive Test Bench simulator or run full API operations.</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  Close
                </button>
                <Link
                  href="/tests"
                  onClick={() => setCreateModalOpen(false)}
                  className="w-1/2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl transition-colors text-sm text-center cursor-pointer font-sans"
                >
                  Go to Test Bench
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 bg-slate-950 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            © 2026 KovertKlaus by <span className="text-slate-300 font-semibold">Joshua Simpson</span>. Licensed under BSL 1.1 with GPLv3 sunset (2030).
          </div>
          <div className="flex gap-6 text-slate-400">
            <Link href="/tests" className="hover:text-emerald-400 transition-colors">Test Bench</Link>
            <a href="https://github.com/MrJSimpson/KovertKlaus" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">GitHub Repository</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
