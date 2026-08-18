'use client';

import { useState } from 'react';

// Charlie Brown Retro Glowing Christmas Lights Strand
function ChristmasLightsStrand() {
  const bulbs = [
    { color: 'bg-red-500 shadow-red-500/90 ring-red-400/50', delay: '0s' },
    { color: 'bg-emerald-500 shadow-emerald-500/90 ring-emerald-400/50', delay: '0.4s' },
    { color: 'bg-amber-400 shadow-amber-400/90 ring-amber-300/50', delay: '0.8s' },
    { color: 'bg-sky-400 shadow-sky-400/90 ring-sky-300/50', delay: '0.2s' },
    { color: 'bg-purple-500 shadow-purple-500/90 ring-purple-400/50', delay: '0.6s' },
    { color: 'bg-yellow-300 shadow-yellow-300/90 ring-yellow-200/50', delay: '1s' },
    { color: 'bg-rose-600 shadow-rose-600/90 ring-rose-400/50', delay: '0.3s' },
    { color: 'bg-emerald-400 shadow-emerald-400/90 ring-emerald-300/50', delay: '0.7s' },
    { color: 'bg-blue-500 shadow-blue-500/90 ring-blue-400/50', delay: '0.5s' },
    { color: 'bg-orange-500 shadow-orange-500/90 ring-orange-400/50', delay: '0.9s' },
  ];

  return (
    <div className="w-full py-1 relative z-30 overflow-hidden select-none bg-slate-950/90 border-b border-slate-800/80">
      {/* Hanging Wire Strand */}
      <div className="absolute top-2 left-0 right-0 h-0.5 pointer-events-none bg-slate-700"></div>

      <div className="max-w-7xl mx-auto px-4 flex justify-between items-center relative z-10">
        {Array.from({ length: 24 }).map((_, i) => {
          const bulb = bulbs[i % bulbs.length];
          return (
            <div key={i} className="flex flex-col items-center group cursor-pointer">
              {/* Wire socket */}
              <div className="w-1.5 h-1.5 bg-slate-800 border border-slate-600 rounded-t-sm z-10"></div>
              {/* Glowing Teardrop Bulb */}
              <div
                className={`w-3 h-4.5 rounded-b-full shadow-lg ring-1 transition-all animate-pulse transform group-hover:scale-125 ${bulb.color}`}
                style={{ animationDelay: bulb.delay, animationDuration: '1.6s' }}
              ></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ComingSoonLanding() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/clearance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMessage(data?.error || 'Clearance transmission failed. Please try again.');
      } else {
        setSubmitted(true);
      }
    } catch {
      setErrorMessage('Network transmission error. Check connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 selection:bg-rose-500 selection:text-white relative overflow-hidden">
      {/* Background Decorative Ambient Gradients (Warm Pine & Northern Lights) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-slate-950 to-slate-950 pointer-events-none"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[400px] bg-rose-500/10 blur-[140px] rounded-full pointer-events-none"></div>
      <div className="absolute top-1/4 right-10 w-[500px] h-[300px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none"></div>

      {/* Charlie Brown Christmas Light Strand */}
      <ChristmasLightsStrand />

      {/* Festive Header */}
      <header className="relative z-10 py-5 px-6 sm:px-12 max-w-7xl mx-auto w-full flex items-center justify-between border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎅</span>
          <div className="flex flex-col">
            <span className="font-mono text-xs text-rose-400 tracking-widest uppercase font-bold">
              KOVERT KLAUS // NORTH POLE SECTOR HQ
            </span>
            <span className="text-[10px] text-slate-400 font-medium">The Covert Holiday Gift Exchange</span>
          </div>
        </div>
        <div className="font-mono text-xs text-slate-300 border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 rounded-full shadow-inner flex items-center gap-2">
          <span className="text-amber-400 font-bold">kovertklaus.com</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            WORKSHOP READY
          </span>
        </div>
      </header>

      {/* Main Hero & Content Area */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 text-center my-auto space-y-9">
        
        {/* Festive Badge Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-mono text-xs shadow-lg shadow-emerald-950/50">
          <span>🎄 HOLIDAY 2026 • NORTH POLE WORKSHOP IN PROGRESS</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-tight">
            Covert Ops <br />
            <span className="bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
              Secret Santa Network
            </span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed">
            Turn your family, office, and friend gift exchanges into a fun holiday mission. Featuring smart match filters so spouses don't draw each other, smartphone target swapping, and 100% private wishlists.
          </p>
        </div>

        {/* Holiday Countdown HUD */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto font-mono text-xs">
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl shadow-xl">
            <div className="text-2xl font-black text-white">2026</div>
            <div className="text-slate-400 text-[10px] uppercase mt-0.5">TARGET SEASON</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl shadow-xl">
            <div className="text-2xl font-black text-rose-400">NOV 20</div>
            <div className="text-slate-400 text-[10px] uppercase mt-0.5">RECRUITING OPENS</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl shadow-xl">
            <div className="text-2xl font-black text-amber-400">DEC 25</div>
            <div className="text-slate-400 text-[10px] uppercase mt-0.5">GIFT EXCHANGE DAY</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl shadow-xl">
            <div className="text-2xl font-black text-emerald-400">BSL 1.1</div>
            <div className="text-slate-400 text-[10px] uppercase mt-0.5">FREE SELF-HOST</div>
          </div>
        </div>

        {/* Early Access / Nice List Form */}
        <div className="max-w-md mx-auto pt-2 space-y-3">
          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                disabled={loading}
                placeholder="Enter your email to join the early list..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-slate-900/90 border border-slate-800 text-white placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-medium disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900 text-white font-black px-6 py-3 rounded-xl transition-all shadow-lg shadow-rose-950/60 font-mono text-xs tracking-wider uppercase cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>🎁</span>
                <span>{loading ? 'Submitting...' : 'Join Nice List'}</span>
              </button>
            </form>
          ) : (
            <div className="p-5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-300 font-mono text-xs shadow-xl space-y-1.5 text-left">
              <div className="font-bold flex items-center gap-2 text-emerald-400 text-sm">
                <span>🎅</span> YOU'RE ON THE EARLY NICE LIST!
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Your operative profile is reserved. When the workshop opens public recruitment for Holiday 2026, we'll dispatch your secret invite code straight to your inbox.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-red-300 font-mono text-xs shadow-xl text-left">
              ⚠️ {errorMessage}
            </div>
          )}
        </div>

        {/* Festive Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left max-w-3xl mx-auto pt-6 border-t border-slate-800/80">
          <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2 hover:border-emerald-500/40 transition-colors">
            <div className="text-emerald-400 font-mono font-bold text-xs uppercase flex items-center gap-1.5">
              <span>🎯</span> Smart Match Filters
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              Keep the surprise intact! Automatic match rules make sure spouses, partners, and roommates never accidentally draw each other.
            </p>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2 hover:border-amber-500/40 transition-colors">
            <div className="text-amber-400 font-mono font-bold text-xs uppercase flex items-center gap-1.5">
              <span>📱</span> Easy Mobile Swapping
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              OpsLeaders can easily fine-tune pairings directly on their smartphone while keeping the 1-to-1 gift circle fair and balanced.
            </p>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2 hover:border-rose-500/40 transition-colors">
            <div className="text-rose-400 font-mono font-bold text-xs uppercase flex items-center gap-1.5">
              <span>🛡️</span> Zero-Spam Privacy
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              Carrier protection tracking, zero third-party ads, zero tracking telemetry, and 100% holiday cheer.
            </p>
          </div>
        </div>

      </main>

      {/* Production Footer */}
      <footer className="relative z-10 py-6 px-6 max-w-7xl mx-auto w-full text-center border-t border-slate-800/60 text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          © 2026 Joshua Simpson. All rights reserved. Registered domain <span className="text-slate-400">kovertklaus.com</span>.
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>Business Source License 1.1</span>
          <span>•</span>
          <span>GPLv3 Sunset Grant 2030</span>
        </div>
      </footer>
    </div>
  );
}
