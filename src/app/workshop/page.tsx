'use client';

import Link from 'next/link';

export default function WorkshopHubPage() {
  const benches = [
    {
      title: '🎯 Sattolo Derangement & 2-Way Swap Bench',
      path: '/workshop/draw',
      badge: 'ALGORITHM LAB',
      color: 'border-emerald-500/40 text-emerald-300',
      description:
        'Test single-cycle derangement permutations, 100% bidirectional exclusion rules ($A \\iff B$), and mobile-first 2-way cascade target swaps in isolation.',
    },
    {
      title: '⏰ 5-Phase Operation Schedule Simulator',
      path: '/workshop/lifecycle',
      badge: 'LIFECYCLE ENGINE',
      color: 'border-amber-500/40 text-amber-300',
      description:
        'Shift virtual calendar dates across recruitment, target assignment, courier shipping deadlines, and exchange event execution with real-time countdown badges.',
    },
    {
      title: '🔎 OpenGraph Metadata Scraper Bench',
      path: '/workshop/scraper',
      badge: 'SECURITY & PERFORMANCE',
      color: 'border-sky-500/40 text-sky-300',
      description:
        'Verify URL scraping against e-commerce stores, SSRF defense invariants, 24-hour database catalog caching (~10ms), and 2.5s fast-failover timeouts.',
    },
    {
      title: '📧 Universal Transactional Email Dispatcher Bench',
      path: '/workshop/email',
      badge: 'DISPATCH TESTING',
      color: 'border-purple-500/40 text-purple-300',
      description:
        'Preview and test-fire live email dispatches across all 6 branded encrypted templates (Invitations, Target Reveals, Nudges, Onboarding, Broadcasts, Waitlist).',
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border-2 border-amber-500/40 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950 px-2.5 py-0.5 rounded border border-amber-500/30">
              WORKSHOP USER-TESTING SITE // ACTIVE
            </span>
          </div>
          <h1 className="text-3xl font-black text-white">
            Santa's Workshop Testing Laboratory
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Isolated QA harnesses and algorithmic simulation benches for verified workshop operatives.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono text-xs font-bold transition-all border border-emerald-500/30"
          >
            🎁 Open Operative Dashboard
          </Link>
        </div>
      </div>

      {/* Test Benches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {benches.map((bench) => (
          <div
            key={bench.path}
            className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase border bg-slate-950 ${bench.color}`}>
                  {bench.badge}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mb-2">{bench.title}</h2>
              <p className="text-xs text-gray-400 font-mono leading-relaxed">
                {bench.description}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <Link
                href={bench.path}
                className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white font-mono text-xs font-bold transition-all shadow-md"
              >
                Launch Test Bench →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
