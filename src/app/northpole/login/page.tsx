'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NorthPoleLoginPage() {
  const router = useRouter();

  // Login Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Mandatory First-Time Password Reset State (NIST SP 800-63B)
  const [isResetRequired, setIsResetRequired] = useState(false);
  const [pendingAdminId, setPendingAdminId] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  useEffect(() => {
    async function checkAuth() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
        const res = await fetch('/api/northpole/me', {
          credentials: 'include',
          headers: token ? { 'x-admin-token': token } : {},
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.authenticated) {
          window.location.href = '/northpole';
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
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `Authentication failed (HTTP ${res.status})`);
      }

      if (json.requiresPasswordReset) {
        setPendingAdminId(json.adminId);
        setCurrentPassword(password);
        setIsResetRequired(true);
        setError('');
        return;
      }

      if (json.token) {
        localStorage.setItem('kovertklaus_admin_token', json.token);
      }
      if (json.admin) {
        localStorage.setItem('kovertklaus_admin_user', JSON.stringify(json.admin));
      }

      window.location.href = '/northpole';
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 12) {
      setError('NIST standard requires a minimum length of 12 characters.');
      return;
    }

    if (newPassword.toLowerCase() === '1secretdel!very') {
      setError('New password cannot be the initial default installation password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/northpole/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: pendingAdminId,
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Password update failed (HTTP ${res.status})`);
      }

      if (json.token) {
        localStorage.setItem('kovertklaus_admin_token', json.token);
      }
      if (json.admin) {
        localStorage.setItem('kovertklaus_admin_user', JSON.stringify(json.admin));
      }

      setResetSuccessMsg('✓ Password updated successfully! Activating clearance...');
      setTimeout(() => {
        window.location.href = '/northpole';
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Password update failed');
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
      <div className="max-w-md w-full space-y-6 bg-slate-900 border-2 border-red-500/40 p-8 rounded-3xl shadow-2xl shadow-red-950/30">
        
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-red-600 to-emerald-800 text-3xl shadow-lg mb-4">
            🎅
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-[11px] font-mono uppercase tracking-widest text-red-400 font-bold">
              {isResetRequired ? 'MANDATORY PASSWORD RESET // NIST SP 800-63B' : 'RESTRICTED ACCESS // LEVEL 5'}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {isResetRequired ? 'Create New Admin Passphrase' : 'North Pole Command Center'}
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            {isResetRequired
              ? 'First-time install detected. Replace default credentials before access is unlocked.'
              : 'Site Administration, Database Governance & System Controls'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-950/80 border border-red-800 text-red-200 p-3.5 rounded-xl text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        {/* Success Alert */}
        {resetSuccessMsg && (
          <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-300 p-3.5 rounded-xl text-xs font-mono font-bold">
            {resetSuccessMsg}
          </div>
        )}

        {/* VIEW 1: Standard Login Form */}
        {!isResetRequired ? (
          <form onSubmit={handleLogin} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-gray-300 font-bold mb-1">ADMINISTRATOR USERNAME OR EMAIL</label>
              <input
                type="text"
                required
                placeholder="Enter username or email..."
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-bold mb-1">CLEARANCE PASSWORD</label>
              <input
                type="password"
                required
                placeholder="Enter clearance password..."
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
        ) : (
          /* VIEW 2: Mandatory NIST Password Reset Form */
          <form onSubmit={handlePasswordReset} className="space-y-4 text-xs font-mono">
            <div className="p-3 bg-slate-950 border border-amber-500/40 rounded-xl text-[11px] text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <span>🛡️ NIST SP 800-63B Guidelines:</span>
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-gray-400">
                <li>Minimum length: 12 characters</li>
                <li>Cannot be the initial default password</li>
                <li>Cannot contain your username</li>
                <li>Passphrases, spaces, and special symbols are encouraged</li>
              </ul>
            </div>

            <div>
              <label className="block text-gray-300 font-bold mb-1">NEW ADMIN PASSPHRASE</label>
              <input
                type="password"
                required
                placeholder="Enter at least 12 characters..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none transition-colors"
              />
              <div className="flex justify-between items-center mt-1 text-[10px] text-gray-500">
                <span>Length: {newPassword.length}/12 min</span>
                <span className={newPassword.length >= 12 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {newPassword.length >= 12 ? '✓ Length Requirement Satisfied' : 'Requires 12+ characters'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 font-bold mb-1">CONFIRM NEW PASSPHRASE</label>
              <input
                type="password"
                required
                placeholder="Re-enter your new passphrase..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || newPassword.length < 12}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black py-3 px-4 rounded-xl transition-all shadow-lg shadow-amber-950/40 text-sm cursor-pointer"
            >
              {loading ? 'Verifying & Updating...' : '🔒 Set Passphrase & Activate Clearance'}
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-slate-800 text-center space-y-2 font-mono">
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
