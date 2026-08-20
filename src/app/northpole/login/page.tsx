'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NorthPoleLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/northpole/me');
        const json = await res.json();
        if (res.ok && json.authenticated) {
          router.push('/northpole');
          return;
        }
      } catch {
        // Not logged in
      } finally {
        setCheckingSession(false);
      }
    }
    checkAuth();
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/northpole/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Authentication failed');
      }

      router.push('/northpole');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono text-xs">
        Checking North Pole Clearance...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-slate-900 border-2 border-red-500/40 p-8 rounded-3xl shadow-2xl shadow-red-950/30">
        
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-red-600 to-emerald-800 text-3xl shadow-lg mb-4">
            🎅
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-[11px] font-mono uppercase tracking-widest text-red-400 font-bold">
              RESTRICTED ACCESS // LEVEL 5
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            North Pole Command Center
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Site Administration, Database Governance & System Controls
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-950/80 border border-red-800 text-red-200 p-3.5 rounded-xl text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-gray-300 font-bold mb-1">ADMINISTRATOR EMAIL</label>
            <input
              type="email"
              required
              placeholder="admin@kovertklaus.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-bold mb-1">CLEARANCE PASSWORD</label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-red-950/40 text-sm cursor-pointer"
          >
            {loading ? 'Authenticating Clearance...' : '⚡ Unlock North Pole Command'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center space-y-2">
          <p className="text-[11px] text-gray-500 font-mono">
            Default bootstrap credentials: <code className="text-gray-400">admin@kovertklaus.com</code>
          </p>
          <div>
            <Link href="/" className="text-xs text-emerald-400 hover:underline font-mono">
              ← Return to Main Application
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
