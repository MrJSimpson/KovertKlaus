'use client';

import { USER_ID_KEY } from '@/lib/constants/auth';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function WorkshopLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authData, setAuthData] = useState<{
    authenticated: boolean;
    authorized: boolean;
    isAdmin: boolean;
    user: any;
  } | null>(null);

  // In-line Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    checkWorkshopAccess();
  }, []);

  async function checkWorkshopAccess() {
    setLoading(true);
    try {
      const res = await fetch('/api/workshop/auth');
      const json = await res.json();
      setAuthData(json);
    } catch {
      setAuthData({ authenticated: false, authorized: false, isAdmin: false, user: null });
    } finally {
      setLoading(false);
    }
  }

  async function handleWorkshopLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Authentication failed');
      }

      localStorage.setItem(USER_ID_KEY, json.user.id);
      localStorage.setItem('kovertklaus_user_name', json.user.name);

      await checkWorkshopAccess();
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-kk-inset flex items-center justify-center text-kk-gold-ink font-mono text-xs">
        Checking Workshop Security Clearance...
      </div>
    );
  }

  // State 1: Not Logged In
  if (!authData?.authenticated) {
    return (
      <div className="min-h-screen bg-kk-inset text-kk-ink flex flex-col justify-center items-center px-4 py-12">
        <div className="max-w-md w-full space-y-6 bg-kk-surface border-2 border-kk-border-strong p-8 rounded-3xl shadow-2xl shadow-black/20">
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-kk-warning border border-kk-border-strong text-3xl mb-4">
              🧪
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-kk-gold animate-pulse"></span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-kk-gold-ink font-bold">
                USER TESTING & QA BENCH
              </span>
            </div>
            <h1 className="text-2xl font-black text-kk-heading">
              Santa's Workshop Access
            </h1>
            <p className="text-xs text-kk-muted mt-1 font-mono">
              Sign in with your operative credentials to access the test facility.
            </p>
          </div>

          {loginError && (
            <div className="bg-kk-danger-soft border border-kk-danger/40 text-kk-on-danger-soft p-3.5 rounded-xl text-xs font-mono">
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleWorkshopLogin} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-kk-ink font-bold mb-1">OPERATIVE EMAIL</label>
              <input
                type="email"
                required
                placeholder="operative@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-kk-inset border border-kk-border focus:border-kk-focus rounded-xl px-3.5 py-2.5 text-kk-ink focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-kk-ink font-bold mb-1">PASSWORD</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-kk-inset border border-kk-border focus:border-kk-focus rounded-xl px-3.5 py-2.5 text-kk-ink focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-kk-gold hover:brightness-95 disabled:opacity-50 text-kk-on-gold font-black py-3 px-4 rounded-xl transition-all shadow-lg shadow-black/20 text-sm cursor-pointer"
            >
              {loggingIn ? 'Authenticating...' : '⚡ Unlock Workshop Bench'}
            </button>
          </form>

          <div className="pt-4 border-t border-kk-border text-center space-y-2 font-mono text-xs">
            <Link href="/" className="text-kk-muted hover:text-kk-ink">
              ← Return to Main Application
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Logged in, but lacks "workshop" security tag
  if (!authData.authorized) {
    return (
      <div className="min-h-screen bg-kk-inset text-kk-ink flex flex-col justify-center items-center px-4 py-12">
        <div className="max-w-md w-full space-y-6 bg-kk-surface border-2 border-kk-danger/40 p-8 rounded-3xl shadow-2xl text-center font-mono">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-kk-danger-soft border border-kk-danger/40 text-3xl mb-2">
            🚫
          </div>
          <h1 className="text-xl font-bold text-kk-danger">
            Workshop Clearance Required
          </h1>
          <p className="text-xs text-kk-muted leading-relaxed">
            Logged in as <strong className="text-kk-ink">{authData.user?.email}</strong>.
            Your operative record does not have the hidden <code className="text-kk-gold-ink bg-kk-inset px-1.5 py-0.5 rounded">workshop</code> security clearance tag enabled.
          </p>
          <div className="p-4 rounded-xl bg-kk-inset border border-kk-border text-left text-[11px] text-kk-muted space-y-2">
            <div className="text-kk-ink font-bold">How to obtain clearance:</div>
            <div>1. Contact a North Pole HQ administrator.</div>
            <div>2. An admin can grant you the <code className="text-kk-gold-ink">workshop</code> tag in the <strong className="text-kk-ink">/northpole/users</strong> console.</div>
          </div>
          <div className="flex gap-3 pt-2">
            <Link
              href="/dashboard"
              className="flex-1 bg-kk-surface hover:border-kk-border-strong text-kk-ink font-bold py-2.5 rounded-xl text-xs"
            >
              Operative Dashboard
            </Link>
            <Link
              href="/northpole"
              className="flex-1 bg-kk-primary hover:bg-kk-primary-hover text-kk-on-primary font-bold py-2.5 rounded-xl text-xs"
            >
              North Pole Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // State 3: Authorized Workshop Operative
  const navItems = [
    { label: '🧪 Hub', href: '/workshop' },
    { label: '🎯 Sattolo Draw', href: '/workshop/draw' },
    { label: '🏷️ White Elephant', href: '/workshop/party' },
    { label: '📸 AAR & WebP', href: '/workshop/aar' },
    { label: '🥷 Kovert Delivery', href: '/workshop/covert' },
    { label: '⏰ Timeline', href: '/workshop/lifecycle' },
    { label: '📋 Manifest', href: '/workshop/manifest' },
    { label: '🔎 Scraper', href: '/workshop/scraper' },
    { label: '📧 Email', href: '/workshop/email' },
    { label: '🎨 Themes', href: '/workshop/theme' },
  ];

  return (
    <div className="min-h-screen bg-kk-inset text-kk-ink font-sans flex flex-col">
      {/* Top Workshop Header */}
      <header className="border-b border-kk-border-strong bg-kk-surface/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <Link href="/workshop" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-kk-gold border border-kk-border-strong flex items-center justify-center text-kk-on-gold font-black text-lg shadow-md">
                🧪
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-kk-heading flex items-center gap-2">
                  <span>SANTA'S WORKSHOP</span>
                  <span className="text-[10px] font-mono bg-kk-warning text-kk-on-warning border border-kk-border-strong px-1.5 py-0.5 rounded font-bold">
                    QA LAB
                  </span>
                </span>
                <span className="text-[11px] text-kk-muted font-mono block">
                  User Testing & Experimental Sandboxes
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="flex items-center flex-wrap gap-1 text-xs font-mono">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg transition-colors font-bold ${
                    isActive
                      ? 'bg-kk-gold text-kk-on-gold shadow-sm'
                      : 'text-kk-ink hover:text-kk-ink hover:bg-kk-surface'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Status & Return Links */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-kk-muted hidden lg:inline">
              Tester: <strong className="text-kk-gold-ink">{authData.user?.name}</strong>
            </span>
            <Link
              href="/dashboard"
              className="bg-kk-surface hover:border-kk-border-strong text-kk-brand border border-kk-on-success/30 px-3 py-1.5 rounded-lg font-bold transition-colors"
            >
              🎁 Live App
            </Link>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
        {children}
      </main>

      <footer className="border-t border-kk-border bg-kk-inset py-6 text-center text-xs font-mono text-kk-muted">
        KovertKlaus Workshop User-Testing Site // Security Tag: <code className="text-kk-gold-ink">workshop</code>
      </footer>
    </div>
  );
}
