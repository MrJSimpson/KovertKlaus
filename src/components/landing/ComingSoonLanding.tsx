'use client';

import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { SeasonalLightsStrand } from '@/components/ui/SeasonalLightsStrand';


export function ComingSoonLanding() {
  const { lightsType, bannerText, bannerActive } = useTheme();
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit clearance request');
      }

      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Transmission error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 selection:bg-rose-500 selection:text-white relative overflow-hidden">
      {/* Background Decorative Ambient Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-slate-950 to-slate-950 pointer-events-none"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[400px] bg-rose-500/10 blur-[140px] rounded-full pointer-events-none"></div>
      <div className="absolute top-1/4 right-10 w-[500px] h-[300px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none"></div>

      {/* Dynamic Seasonal Lights Strand */}
      <SeasonalLightsStrand type={lightsType} isDarkMode={true} />

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
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white drop-shadow-md">
            Secret Santa, <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
              Stealth Operations.
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            No more accidental gift match leaks or spreadsheet chaos. KovertKlaus pairs your family, friends, and teams with secret wishlists, dead-drop countdowns, and festive anti-spoiler cryptography.
          </p>
        </div>

        {/* Launch Countdown HUD */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-xl mx-auto font-mono">
          <div className="bg-slate-900/90 border border-slate-800/80 p-3.5 rounded-2xl shadow-xl backdrop-blur-sm">
            <span className="block text-2xl sm:text-3xl font-black text-rose-400">74</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Days to Launch</span>
          </div>
          <div className="bg-slate-900/90 border border-slate-800/80 p-3.5 rounded-2xl shadow-xl backdrop-blur-sm">
            <span className="block text-2xl sm:text-3xl font-black text-amber-300">NOV 01</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Live Date</span>
          </div>
          <div className="bg-slate-900/90 border border-slate-800/80 p-3.5 rounded-2xl shadow-xl backdrop-blur-sm">
            <span className="block text-2xl sm:text-3xl font-black text-emerald-400">100%</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Free Tier</span>
          </div>
          <div className="bg-slate-900/90 border border-slate-800/80 p-3.5 rounded-2xl shadow-xl backdrop-blur-sm">
            <span className="block text-2xl sm:text-3xl font-black text-sky-400">&lt; 60s</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Setup Time</span>
          </div>
        </div>

        {/* Early Access / Clearance Signup Form */}
        <div className="max-w-md mx-auto pt-2">
          {submitted ? (
            <div className="bg-emerald-950/70 border border-emerald-500/50 p-6 rounded-2xl text-center space-y-2.5 shadow-2xl backdrop-blur-md">
              <span className="text-3xl block">🎁</span>
              <h3 className="font-bold text-emerald-300 text-lg">Clearance Request Logged</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                Your dispatch frequency is locked. We will notify you the moment the workshop doors open for early holiday setup.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your operative email..."
                className="flex-1 bg-slate-900/90 border border-slate-800 px-4 py-3.5 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all font-mono"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-rose-950/60 disabled:opacity-50 flex items-center justify-center gap-2 group whitespace-nowrap cursor-pointer"
              >
                {loading ? (
                  <span>Transmitting...</span>
                ) : (
                  <>
                    <span>Get Early Access</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </>
                )}
              </button>
            </form>
          )}

          {errorMessage && (
            <p className="mt-3 text-xs text-rose-400 font-mono">{errorMessage}</p>
          )}

          <p className="mt-3 text-[11px] text-slate-400 font-medium">
            🔒 Strictly zero spam. Early operatives get priority exchange access for the 2026 season.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-6 text-left">
          <div className="bg-slate-900/60 border border-slate-800/60 p-4 rounded-xl space-y-1.5">
            <span className="text-xl">🕵️‍♂️</span>
            <h4 className="font-bold text-slate-200 text-sm">Covert Wishlists</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Auto-fetch wishlist images and pricing from any major retailer with zero tracking leaks.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/60 p-4 rounded-xl space-y-1.5">
            <span className="text-xl">🔀</span>
            <h4 className="font-bold text-slate-200 text-sm">Derangement Logic</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cryptographic Sattolo cyclic draws guarantee no self-draws and enforce exclusion blocks.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/60 p-4 rounded-xl space-y-1.5">
            <span className="text-xl">📦</span>
            <h4 className="font-bold text-slate-200 text-sm">Dead-Drop Logistics</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Built-in tracking ciphers, shipping milestone alerts, and anti-ghosting waivers.
            </p>
          </div>
        </div>

      </main>

      {/* Modern Compact Footer */}
      <footer className="relative z-10 py-6 px-6 max-w-7xl mx-auto w-full border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span>🎄</span>
          <span>© 2026 KovertKlaus Inc. All Rights Reserved.</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-slate-400">North Pole Logistics Sector</span>
          <span className="text-emerald-400 font-semibold">Self-Hostable Open-Core</span>
        </div>
      </footer>
    </div>
  );
}
