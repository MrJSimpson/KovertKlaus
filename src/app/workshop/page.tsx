'use client';

import Link from 'next/link';

export default function WorkshopHubPage() {
  const liveActions = [
    {
      title: '🎁 Create New Holiday Mission',
      path: '/exchange/create',
      badge: 'HEAD ELF',
      color: 'border-emerald-500/40 text-emerald-300',
      description: 'Host a real holiday gift exchange, configure budgets, and recruit field agents.',
      btnText: 'Start Mission →',
    },
    {
      title: '🔑 Join Mission with Invite Code',
      path: '/exchange/join',
      badge: 'ELF AGENT',
      color: 'border-sky-500/40 text-sky-300',
      description: 'Enlist in an active Secret Santa or White Elephant exchange using an invite cipher.',
      btnText: 'Join Operation →',
    },
    {
      title: '📝 Manage Wishlist Manifest',
      path: '/wishlist',
      badge: 'MANIFEST',
      color: 'border-amber-500/40 text-amber-300',
      description: 'Add wishlist items, auto-scrape product details, and configure delivery sizes.',
      btnText: 'Open Manifest →',
    },
    {
      title: '🎅 North Pole SysAdmin HQ',
      path: '/northpole',
      badge: 'ADMIN CONSOLE',
      color: 'border-red-500/40 text-red-300',
      description: 'Inspect operative records, manage Coal Citations, and administer system settings.',
      btnText: 'Admin Login →',
    },
  ];

  const benches = [
    {
      title: '🎯 Sattolo Derangement & 2-Way Swap Studio',
      path: '/workshop/draw',
      badge: 'ALGORITHM LAB',
      color: 'border-emerald-500/40 text-emerald-300',
      description:
        'Interactive SVG cyclic graph visualizer, 1-click scenario presets (Family Ops, 3 Couples, 12 Agents), CSPRNG trace, and 2-way cascade target swaps.',
    },
    {
      title: '⏰ 5-Phase Operation Schedule Simulator',
      path: '/workshop/lifecycle',
      badge: 'LIFECYCLE ENGINE',
      color: 'border-amber-500/40 text-amber-300',
      description:
        'Shift virtual calendar dates across recruitment, target assignment, courier shipping deadlines, and exchange execution with real-time countdown badges.',
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
    <div className="space-y-10 pb-16">
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border-2 border-amber-500/40 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950 px-2.5 py-0.5 rounded border border-amber-500/30">
              SANTA'S WORKSHOP // CLOSED ALPHA DOGFOODING
            </span>
          </div>
          <h1 className="text-3xl font-black text-white">
            Santa's Workshop Command Center
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Unrestricted live application dogfooding paired with instant algorithmic testing sandboxes.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            🎁 Open Live Operative Dashboard →
          </Link>
        </div>
      </div>

      {/* Section 1: Live Application Quick Launchers */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="text-base font-black text-white font-mono flex items-center gap-2">
            <span>🎁 1. LIVE APPLICATION FLOWS (DOGFOODING)</span>
          </h2>
          <span className="text-xs text-gray-500 font-mono">
            Use KovertKlaus as intended in a live environment
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {liveActions.map((action) => (
            <div
              key={action.path}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase border bg-slate-950 ${action.color}`}>
                  {action.badge}
                </span>
                <h3 className="text-sm font-bold text-white mt-2">{action.title}</h3>
                <p className="text-xs text-gray-400 font-mono mt-1 leading-snug">
                  {action.description}
                </p>
              </div>

              <Link
                href={action.path}
                className="w-full inline-flex items-center justify-center py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-colors"
              >
                {action.btnText}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Direct Scenario Testing Tools Suite */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="text-base font-black text-amber-300 font-mono flex items-center gap-2">
            <span>🧪 2. DIRECT TESTING TOOLS SUITE (STANDALONE SANDBOXES)</span>
          </h2>
          <span className="text-xs text-gray-500 font-mono">
            Test edge scenarios instantly without creating multi-user events
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {benches.map((bench) => (
            <div
              key={bench.path}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-4 shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase border bg-slate-950 ${bench.color}`}>
                    {bench.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{bench.title}</h3>
                <p className="text-xs text-gray-400 font-mono leading-relaxed">
                  {bench.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <Link
                  href={bench.path}
                  className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white font-mono text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Launch Sandbox Studio →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
