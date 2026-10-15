'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { SeasonalLightsStrand } from '@/components/ui/SeasonalLightsStrand';
import { APP_VERSION_LABEL } from '@/lib/version';

const TARGET_LAUNCH_DATE = new Date('2026-11-01T00:00:00');

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isMounted: boolean;
}

function calculateTimeRemaining(): CountdownState {
  const now = new Date();
  const diffMs = Math.max(0, TARGET_LAUNCH_DATE.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  return {
    days: Math.floor(totalSeconds / (3600 * 24)),
    hours: Math.floor((totalSeconds % (3600 * 24)) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isMounted: true,
  };
}

export function ComingSoonLanding() {
  const { lightsType, isDarkMode } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic live countdown
  const [timeLeft, setTimeLeft] = useState<CountdownState>({
    days: 72,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isMounted: false,
  });

  useEffect(() => {
    setTimeLeft(calculateTimeRemaining());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
    <div className="min-h-screen flex flex-col justify-between bg-kk-page text-kk-ink selection:bg-kk-primary selection:text-kk-on-primary relative overflow-hidden">
      {/* Background Decorative Ambient Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[400px] bg-kk-danger-soft opacity-60 blur-[140px] rounded-full pointer-events-none"></div>
      <div className="absolute top-1/4 right-10 w-[500px] h-[300px] bg-kk-success opacity-30 blur-[130px] rounded-full pointer-events-none"></div>

      {/* Dynamic Seasonal Lights Strand */}
      <SeasonalLightsStrand type={lightsType} isDarkMode={isDarkMode} />

      {/* Festive Header */}
      <header className="relative z-10 py-4 sm:py-5 px-4 sm:px-12 max-w-7xl mx-auto w-full flex items-center justify-between gap-3 border-b border-kk-border">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-xl">🎅</span>
          <div className="flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-xs text-kk-accent tracking-widest uppercase font-bold">
                KOVERT KLAUS // NORTH POLE SECTOR HQ
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-kk-surface text-kk-accent border border-kk-border-strong">
                {APP_VERSION_LABEL}
              </span>
            </div>
            <span className="text-[10px] text-kk-muted font-medium">The Covert Holiday Gift Exchange</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
        {/* Approved operatives sign in here: the pre-launch page has no other sign-in entry point. */}
        <a
          href="/signin"
          className="min-h-11 inline-flex items-center whitespace-nowrap font-mono text-xs font-bold text-kk-on-secondary bg-kk-secondary hover:bg-kk-secondary-hover px-3.5 py-1.5 rounded-full shadow-md shadow-black/20 transition-colors"
        >
          🔑 Operative Sign In
        </a>
        <div className="font-mono text-xs text-kk-ink border border-kk-border bg-kk-surface/80 px-3.5 py-1.5 rounded-full shadow-inner hidden md:flex items-center gap-2">
          <span className="text-kk-gold-ink font-bold">kovertklaus.com</span>
          <span className="text-kk-muted">|</span>
          <span className="text-kk-brand flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-kk-secondary animate-pulse"></span>
            WORKSHOP READY
          </span>
        </div>
        </div>
      </header>

      {/* Main Hero & Content Area */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12 text-center my-auto space-y-9">
        
        {/* Festive Badge Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-kk-success border border-kk-on-success/30 text-kk-on-success font-mono text-xs shadow-lg shadow-black/20">
          <span>🎄 HOLIDAY 2026 • NORTH POLE WORKSHOP IN PROGRESS</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-kk-heading">
            Secret Santa, <br className="hidden sm:inline" />
            <span className="text-kk-accent">
              Stealth Operations.
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-kk-ink leading-relaxed font-normal">
            No more accidental gift match leaks or spreadsheet chaos. KovertKlaus pairs your family, friends, and teams with secret wishlists, dead-drop countdowns, and festive anti-spoiler cryptography.
          </p>
        </div>

        {/* Launch Countdown HUD */}
        <div className="space-y-3.5 max-w-xl mx-auto font-mono">
          <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5">
            <div className="bg-kk-surface/90 border border-kk-border p-3 sm:p-4 rounded-2xl shadow-xl backdrop-blur-sm">
              <span className="block text-2xl sm:text-4xl font-black text-kk-danger">
                {timeLeft.days}
              </span>
              <span className="text-[9px] sm:text-[10px] text-kk-muted uppercase tracking-widest font-semibold">
                Days
              </span>
            </div>
            <div className="bg-kk-surface/90 border border-kk-border p-3 sm:p-4 rounded-2xl shadow-xl backdrop-blur-sm">
              <span className="block text-2xl sm:text-4xl font-black text-kk-gold-ink">
                {String(timeLeft.hours).padStart(2, '0')}
              </span>
              <span className="text-[9px] sm:text-[10px] text-kk-muted uppercase tracking-widest font-semibold">
                Hours
              </span>
            </div>
            <div className="bg-kk-surface/90 border border-kk-border p-3 sm:p-4 rounded-2xl shadow-xl backdrop-blur-sm">
              <span className="block text-2xl sm:text-4xl font-black text-kk-brand">
                {String(timeLeft.minutes).padStart(2, '0')}
              </span>
              <span className="text-[9px] sm:text-[10px] text-kk-muted uppercase tracking-widest font-semibold">
                Minutes
              </span>
            </div>
            <div className="bg-kk-surface/90 border border-kk-border p-3 sm:p-4 rounded-2xl shadow-xl backdrop-blur-sm">
              <span className="block text-2xl sm:text-4xl font-black text-kk-accent">
                {String(timeLeft.seconds).padStart(2, '0')}
              </span>
              <span className="text-[9px] sm:text-[10px] text-kk-muted uppercase tracking-widest font-semibold">
                Seconds
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2.5 text-[11px] text-kk-muted font-mono pt-1">
            <span className="inline-flex items-center gap-1.5 bg-kk-surface/60 border border-kk-border px-3 py-1 rounded-full">
              🎯 <span className="text-kk-ink font-bold">Target Launch: Nov 1, 2026</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-kk-surface/60 border border-kk-border px-3 py-1 rounded-full">
              🎁 <span className="text-kk-brand font-bold">100% Free for Families (4+ Operatives)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-kk-surface/60 border border-kk-border px-3 py-1 rounded-full">
              ⚡ <span className="text-kk-accent font-bold">&lt; 60s Setup</span>
            </span>
          </div>
        </div>

        {/* Early Access / Clearance Signup Form */}
        <div className="max-w-md mx-auto pt-2">
          {submitted ? (
            <div className="bg-kk-surface border-2 border-kk-border-strong p-6 rounded-2xl text-center space-y-2.5 shadow-2xl">
              <span className="text-3xl block">🎁</span>
              <h3 className="font-bold text-kk-brand text-lg">Clearance Request Logged</h3>
              <p className="text-xs text-kk-ink leading-relaxed font-mono">
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
                className="flex-1 bg-kk-surface/90 border border-kk-border px-4 py-3.5 rounded-xl text-sm text-kk-ink placeholder:text-kk-muted focus:outline-none focus:ring-2 focus:ring-kk-focus focus:border-kk-focus transition-all font-mono"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-kk-primary hover:bg-kk-primary-hover text-kk-on-primary font-bold px-6 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-black/20 disabled:opacity-50 flex items-center justify-center gap-2 group whitespace-nowrap cursor-pointer"
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
            <p className="mt-3 text-xs text-kk-danger font-mono">{errorMessage}</p>
          )}

          <p className="mt-3 text-[11px] text-kk-muted font-medium">
            🔒 Strictly zero spam. Early operatives get priority exchange access for the 2026 season.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-6 text-left">
          <div className="bg-kk-surface/60 border border-kk-border p-4 rounded-xl space-y-1.5">
            <span className="text-xl">🕵️‍♂️</span>
            <h4 className="font-bold text-kk-ink text-sm">Covert Wishlists</h4>
            <p className="text-xs text-kk-muted leading-relaxed">
              Auto-fetch wishlist images and pricing from any major retailer with zero tracking leaks.
            </p>
          </div>
          <div className="bg-kk-surface/60 border border-kk-border p-4 rounded-xl space-y-1.5">
            <span className="text-xl">🔀</span>
            <h4 className="font-bold text-kk-ink text-sm">Derangement Logic (4+ Groups)</h4>
            <p className="text-xs text-kk-muted leading-relaxed">
              Cryptographic Sattolo cyclic draws guarantee no self-draws and enforce exclusion blocks for groups of 4+.
            </p>
          </div>
          <div className="bg-kk-surface/60 border border-kk-border p-4 rounded-xl space-y-1.5">
            <span className="text-xl">📦</span>
            <h4 className="font-bold text-kk-ink text-sm">Dead-Drop Logistics</h4>
            <p className="text-xs text-kk-muted leading-relaxed">
              Built-in tracking ciphers, shipping milestone alerts, and anti-ghosting waivers.
            </p>
          </div>
        </div>

      </main>

      {/* Modern Compact Footer */}
      <footer className="relative z-10 py-6 px-6 max-w-7xl mx-auto w-full border-t border-kk-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-kk-muted font-mono">
        <div className="flex items-center gap-2">
          <span>🎄</span>
          <span>© 2026 KovertKlaus Inc. All Rights Reserved.</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-kk-muted">North Pole Logistics Sector</span>
          <span className="text-kk-brand font-semibold">Self-Hostable Open-Core</span>
        </div>
      </footer>
    </div>
  );
}
