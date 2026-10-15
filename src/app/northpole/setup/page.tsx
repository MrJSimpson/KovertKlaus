'use client';

/**
 * @file page.tsx (/northpole/setup)
 * @description First-run administrator setup screen for self-hosted installations.
 *
 * Tier 1 (what): Collects the one-time console setup token and the first administrator's
 * identity and passphrase, then activates North Pole Command.
 * Tier 2 (why): No default admin password ships with KovertKlaus. Proof of server-console
 * access replaces it.
 * Tier 3 (how): Redirects to /northpole/login when setup is not required. Server-side
 * validation in /api/northpole/setup is authoritative; the client checks are convenience only.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ADMIN_TOKEN_KEY, ADMIN_USER_KEY } from '@/lib/constants/auth';
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_USERNAME } from '@/lib/constants/adminDefaults';

const inputClass =
  'w-full bg-kk-inset border border-kk-border focus:border-kk-focus rounded-xl px-3.5 py-2.5 text-kk-ink focus:outline-none transition-colors';

export default function NorthPoleSetupPage() {
  const [checking, setChecking] = useState(true);
  const [setupToken, setSetupToken] = useState('');
  const [username, setUsername] = useState(DEFAULT_ADMIN_USERNAME);
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [name, setName] = useState('Santa Claus');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch('/api/northpole/setup', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.setupRequired === false) {
          window.location.href = '/northpole/login';
          return;
        }
        if (!res.ok) setError(json.error || 'First-run setup is not available on this deployment.');
      } catch {
        setError('First-run setup is not available on this deployment.');
      } finally {
        setChecking(false);
      }
    }
    checkSetup();
  }, []);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passphrase and confirmation do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/northpole/setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken: setupToken.trim(), username, email, name, password, confirmPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || `Setup failed (HTTP ${res.status})`);

      if (json.token) localStorage.setItem(ADMIN_TOKEN_KEY, json.token);
      if (json.admin) localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(json.admin));
      setSuccess('✓ Administrator created. Activating North Pole Command...');
      setTimeout(() => {
        window.location.href = '/northpole';
      }, 1000);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-kk-inset flex items-center justify-center text-kk-muted font-mono text-xs">
        Checking North Pole installation state...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kk-inset text-kk-ink flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full space-y-6 bg-kk-surface border-2 border-kk-border-strong p-8 rounded-3xl shadow-2xl shadow-black/20">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-kk-primary text-kk-on-primary border border-kk-border-strong text-3xl shadow-lg mb-4">
            🎅
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-kk-gold animate-ping"></span>
            <span className="text-[11px] font-mono uppercase tracking-widest text-kk-gold-ink font-bold">
              FIRST-RUN SETUP // NIST SP 800-63B
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-kk-heading">Initialize North Pole Command</h1>
          <p className="text-xs text-kk-muted mt-1 font-mono">
            Create the first administrator. The setup token is printed in the server console
            (e.g. <code className="text-kk-gold-ink">docker logs kovertklaus-app</code>).
          </p>
        </div>

        {error && (
          <div className="bg-kk-danger-soft border border-kk-danger/40 text-kk-on-danger-soft p-3.5 rounded-xl text-xs font-mono">⚠️ {error}</div>
        )}
        {success && (
          <div className="bg-kk-success border border-kk-on-success/30 text-kk-on-success p-3.5 rounded-xl text-xs font-mono font-bold">{success}</div>
        )}

        <form onSubmit={handleSetup} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-kk-ink font-bold mb-1">ONE-TIME SETUP TOKEN</label>
            <input type="text" required autoComplete="off" spellCheck={false} placeholder="Paste the token from the server console..."
              value={setupToken} onChange={(e) => setSetupToken(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-kk-ink font-bold mb-1">USERNAME</label>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-kk-ink font-bold mb-1">DISPLAY NAME</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-kk-ink font-bold mb-1">EMAIL</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>

          <div className="p-3 bg-kk-inset border border-kk-border-strong rounded-xl text-[11px] text-kk-gold-ink">
            <div className="font-bold">🛡️ NIST SP 800-63B Guidelines:</div>
            <ul className="list-disc pl-4 space-y-0.5 text-kk-muted">
              <li>Minimum length: 12 characters</li>
              <li>Cannot contain your username</li>
              <li>Passphrases, spaces, and special symbols are encouraged</li>
            </ul>
          </div>
          <div>
            <label className="block text-kk-ink font-bold mb-1">ADMIN PASSPHRASE</label>
            <input type="password" required autoComplete="new-password" placeholder="Enter at least 12 characters..."
              value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-kk-ink font-bold mb-1">CONFIRM PASSPHRASE</label>
            <input type="password" required autoComplete="new-password" placeholder="Re-enter your passphrase..."
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
          </div>

          <button type="submit" disabled={loading || password.length < 12}
            className="w-full bg-kk-primary hover:bg-kk-primary-hover disabled:opacity-50 text-kk-on-primary font-black py-3 px-4 rounded-xl transition-all shadow-lg shadow-black/20 text-sm cursor-pointer">
            {loading ? 'Initializing...' : '🔒 Create Administrator & Activate'}
          </button>
        </form>

        <div className="pt-4 border-t border-kk-border text-center font-mono">
          <Link href="/" className="text-xs text-kk-brand hover:underline">← Return to Main Application</Link>
        </div>
      </div>
    </div>
  );
}
