'use client';

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

      localStorage.setItem('kovertklaus_user_id', json.user.id);
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-300 font-mono text-xs">
        Checking Workshop Security Clearance...
      </div>
    );
  }

  // State 1: Not Logged In
  if (!authData?.authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12">
        <div className="max-w-md w-full space-y-6 bg-slate-900 border-2 border-amber-500/40 p-8 rounded-3xl shadow-2xl shadow-amber-950/30">
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-3xl mb-4">
              🧪
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                USER TESTING & QA BENCH
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">
              Santa's Workshop Access
            </h1>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              Sign in with your operative credentials to access the test facility.
            </p>
          </div>

          {loginError && (
            <div className="bg-red-950/80 border border-red-800 text-red-200 p-3.5 rounded-xl text-xs font-mono">
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleWorkshopLogin} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-gray-300 font-bold mb-1">OPERATIVE EMAIL</label>
              <input
                type="email"
                required
                placeholder="operative@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-bold mb-1">PASSWORD</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black py-3 px-4 rounded-xl transition-all shadow-lg shadow-amber-950/40 text-sm cursor-pointer"
            >
              {loggingIn ? 'Authenticating...' : '⚡ Unlock Workshop Bench'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800 text-center space-y-2 font-mono text-xs">
            <Link href="/" className="text-gray-400 hover:text-white">
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12">
        <div className="max-w-md w-full space-y-6 bg-slate-900 border-2 border-red-500/40 p-8 rounded-3xl shadow-2xl text-center font-mono">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-red-950/80 border border-red-500/40 text-3xl mb-2">
            🚫
          </div>
          <h1 className="text-xl font-bold text-red-300">
            Workshop Clearance Required
          </h1>
          <p className="text-xs text-gray-400 leading-relaxed">
            Logged in as <strong className="text-white">{authData.user?.email}</strong>.
            Your operative record does not have the hidden <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded">workshop</code> security clearance tag enabled.
          </p>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left text-[11px] text-gray-400 space-y-2">
            <div className="text-white font-bold">How to obtain clearance:</div>
            <div>1. Contact a North Pole HQ administrator.</div>
            <div>2. An admin can grant you the <code className="text-amber-400">workshop</code> tag in the <strong className="text-white">/northpole/users</strong> console.</div>
          </div>
          <div className="flex gap-3 pt-2">
            <Link
              href="/dashboard"
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs"
            >
              Operative Dashboard
            </Link>
            <Link
              href="/northpole"
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs"
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
    { label: '🧪 Workshop Hub', href: '/workshop' },
    { label: '🎯 Sattolo & Swap Bench', href: '/workshop/draw' },
    { label: '⏰ Schedule Simulator', href: '/workshop/lifecycle' },
    { label: '🔎 Scraper Bench', href: '/workshop/scraper' },
    { label: '📧 Email Simulator', href: '/workshop/email' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Workshop Header */}
      <header className="border-b border-amber-500/30 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <Link href="/workshop" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center text-slate-950 font-black text-lg shadow-md">
                🧪
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                  <span>SANTA'S WORKSHOP</span>
                  <span className="text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold">
                    QA LAB
                  </span>
                </span>
                <span className="text-[11px] text-gray-400 font-mono block">
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
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Status & Return Links */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-gray-400 hidden lg:inline">
              Tester: <strong className="text-amber-300">{authData.user?.codename || authData.user?.name}</strong>
            </span>
            <Link
              href="/dashboard"
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-bold transition-colors"
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

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs font-mono text-gray-600">
        KovertKlaus Workshop User-Testing Site // Security Tag: <code className="text-amber-500">workshop</code>
      </footer>
    </div>
  );
}
