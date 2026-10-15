'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ADMIN_TOKEN_KEY, ADMIN_USER_KEY } from '@/lib/constants/auth';

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
        const setupRes = await fetch('/api/northpole/setup', { cache: 'no-store' });
        const setupJson = await setupRes.json().catch(() => ({}));
        if (setupRes.ok && setupJson.setupRequired) {
          window.location.href = '/northpole/setup';
          return;
        }
      } catch {
        // Setup endpoint unavailable (e.g. SaaS edge): continue to normal login.
      }
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
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
      if (json.setupRequired) {
        window.location.href = '/northpole/setup';
        return;
      }
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
        localStorage.setItem(ADMIN_TOKEN_KEY, json.token);
      }
      if (json.admin) {
        localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(json.admin));
      }

      window.location.href = '/northpole';
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Login failed');
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
        localStorage.setItem(ADMIN_TOKEN_KEY, json.token);
      }
      if (json.admin) {
        localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(json.admin));
      }

      setResetSuccessMsg('✓ Password updated successfully! Activating clearance...');
      setTimeout(() => {
        window.location.href = '/northpole';
      }, 1000);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Password update failed');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-kk-inset flex items-center justify-center text-kk-muted font-mono text-xs">
        Checking North Pole Clearance...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kk-inset text-kk-ink flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full space-y-6 bg-kk-surface border-2 border-kk-danger/40 p-8 rounded-3xl shadow-2xl shadow-black/20">
        
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-kk-primary text-kk-on-primary border border-kk-border-strong text-3xl shadow-lg mb-4">
            🎅
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-kk-primary animate-ping"></span>
            <span className="text-[11px] font-mono uppercase tracking-widest text-kk-danger font-bold">
              {isResetRequired ? 'MANDATORY PASSWORD RESET // NIST SP 800-63B' : 'RESTRICTED ACCESS // LEVEL 5'}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-kk-heading">
            {isResetRequired ? 'Create New Admin Passphrase' : 'North Pole Command Center'}
          </h1>
          <p className="text-xs text-kk-muted mt-1 font-mono">
            {isResetRequired
              ? 'Initial credentials detected. Choose your own passphrase before access is unlocked.'
              : 'Site Administration, Database Governance & System Controls'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-kk-danger-soft border border-kk-danger/40 text-kk-on-danger-soft p-3.5 rounded-xl text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        {/* Success Alert */}
        {resetSuccessMsg && (
          <div className="bg-kk-success border border-kk-on-success/30 text-kk-on-success p-3.5 rounded-xl text-xs font-mono font-bold">
            {resetSuccessMsg}
          </div>
        )}

        {/* VIEW 1: Standard Login Form */}
        {!isResetRequired ? (
          <form onSubmit={handleLogin} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-kk-ink font-bold mb-1">ADMINISTRATOR USERNAME OR EMAIL</label>
              <input
                type="text"
                required
                placeholder="Enter username or email..."
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-kk-inset border border-kk-border focus:border-kk-focus rounded-xl px-3.5 py-2.5 text-kk-ink focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-kk-ink font-bold mb-1">CLEARANCE PASSWORD</label>
              <input
                type="password"
                required
                placeholder="Enter clearance password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-kk-inset border border-kk-border focus:border-kk-focus rounded-xl px-3.5 py-2.5 text-kk-ink focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-kk-primary hover:bg-kk-primary-hover disabled:opacity-50 text-kk-on-primary font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-black/20 text-sm cursor-pointer"
            >
              {loading ? 'Authenticating Clearance...' : '⚡ Unlock North Pole Command'}
            </button>
          </form>
        ) : (
          /* VIEW 2: Mandatory NIST Password Reset Form */
          <form onSubmit={handlePasswordReset} className="space-y-4 text-xs font-mono">
            <div className="p-3 bg-kk-inset border border-kk-border-strong rounded-xl text-[11px] text-kk-gold-ink space-y-1">
              <div className="font-bold flex items-center gap-1">
                <span>🛡️ NIST SP 800-63B Guidelines:</span>
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-kk-muted">
                <li>Minimum length: 12 characters</li>
                <li>Cannot be the initial password or a known default</li>
                <li>Cannot contain your username</li>
                <li>Passphrases, spaces, and special symbols are encouraged</li>
              </ul>
            </div>

            <div>
              <label className="block text-kk-ink font-bold mb-1">NEW ADMIN PASSPHRASE</label>
              <input
                type="password"
                required
                placeholder="Enter at least 12 characters..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-kk-inset border border-kk-border focus:border-kk-focus rounded-xl px-3.5 py-2.5 text-kk-ink focus:outline-none transition-colors"
              />
              <div className="flex justify-between items-center mt-1 text-[10px] text-kk-muted">
                <span>Length: {newPassword.length}/12 min</span>
                <span className={newPassword.length >= 12 ? 'text-kk-brand font-bold' : 'text-kk-gold-ink'}>
                  {newPassword.length >= 12 ? '✓ Length Requirement Satisfied' : 'Requires 12+ characters'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-kk-ink font-bold mb-1">CONFIRM NEW PASSPHRASE</label>
              <input
                type="password"
                required
                placeholder="Re-enter your new passphrase..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-kk-inset border border-kk-border focus:border-kk-focus rounded-xl px-3.5 py-2.5 text-kk-ink focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || newPassword.length < 12}
              className="w-full bg-kk-primary hover:bg-kk-primary-hover disabled:opacity-50 text-kk-on-primary font-black py-3 px-4 rounded-xl transition-all shadow-lg shadow-black/20 text-sm cursor-pointer"
            >
              {loading ? 'Verifying & Updating...' : '🔒 Set Passphrase & Activate Clearance'}
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-kk-border text-center space-y-2 font-mono">
          <div>
            <Link href="/" className="text-xs text-kk-brand hover:underline font-mono">
              ← Return to Main Application
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
