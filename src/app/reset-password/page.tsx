'use client';

/**
 * @file page.tsx (/reset-password)
 * @description Agent password reset: request a link, then choose a new password from it.
 *
 * Tier 1 (what): Without a `token` in the URL the page asks for the account email and calls
 * `POST /api/users/password-reset`. Opened from the emailed link (`?token=…`) it asks for a new
 * password and calls `POST /api/users/password-reset/confirm`.
 * Tier 2 (why): Agents had no way back into an account after forgetting a password (owner request,
 * 2026-10-30). The reply never says whether an email has an account.
 * Tier 3 (how): The token is read from `window.location` after mount, because the SaaS edition is a
 * static export served by the Worker. The token is removed from the address bar once read, so it
 * does not linger in history or get copied along with the URL.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';

const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 10 characters', test: (p) => p.length >= 10 },
  { label: 'An uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { label: 'A number (0-9)', test: (p) => /[0-9]/.test(p) },
  { label: 'A special character (!@#$%^&*)', test: (p) => /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(p) },
];

type Notice = { kind: 'success' | 'warning' | 'error'; text: string } | null;

export default function ResetPasswordPage() {
  const { theme } = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromLink = params.get('token');
    if (fromLink) {
      // Read once after mount (static export has no server-side query); the URL is then cleared.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(fromLink);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setReady(true);
  }, []);

  async function post(path: string, body: Record<string, string>) {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string; queued?: boolean };
    return { ok: res.ok, json };
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const { ok, json } = await post('/api/users/password-reset', { email: email.trim() });
      if (!ok) setNotice({ kind: 'error', text: json.error || 'Could not send the reset email. Please try again.' });
      else setNotice({ kind: json.queued ? 'warning' : 'success', text: json.message || 'Check your email for a reset link.' });
    } catch {
      setNotice({ kind: 'error', text: 'Could not reach KovertKlaus. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setNotice({ kind: 'error', text: "The two passwords don't match." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const { ok, json } = await post('/api/users/password-reset/confirm', { token: token || '', password });
      if (!ok) setNotice({ kind: 'error', text: json.error || 'Could not change the password. Please try again.' });
      else {
        setDone(true);
        setNotice({ kind: 'success', text: json.message || 'Your password has been changed.' });
      }
    } catch {
      setNotice({ kind: 'error', text: 'Could not reach KovertKlaus. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  const noticeClass = notice?.kind === 'error' ? theme.alertError : notice?.kind === 'warning' ? theme.alertWarning : theme.alertSuccess;
  const inputClass = `w-full border rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none ${theme.inputModalBg}`;

  return (
    <main className={`min-h-dvh flex items-start sm:items-center justify-center px-4 py-10 ${theme.pageBg}`}>
      <div className={`w-full max-w-md rounded-2xl p-6 space-y-5 ${theme.cardBg}`}>
        <div className="space-y-1">
          <h1 className={`text-2xl ${theme.textHeading}`}>{token ? 'Choose a new password' : 'Reset your password'}</h1>
          <p className={`text-sm ${theme.textSubLabel}`}>
            {token
              ? 'Your new password signs you out on every device.'
              : "Enter the email you sign in with. We'll email you a link to choose a new password."}
          </p>
        </div>

        {notice && (
          <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`p-3 rounded-xl text-sm font-semibold ${noticeClass}`}>
            {notice.text}
          </div>
        )}

        {ready && !token && (
          <form onSubmit={handleRequest} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className={`block text-sm mb-1 ${theme.textLabel}`}>Email address</label>
              <input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <button type="submit" disabled={busy} className={`w-full py-3 rounded-2xl text-sm disabled:opacity-50 ${theme.btnPrimary}`}>
              {busy ? 'Sending…' : 'Email me a reset link'}
            </button>
          </form>
        )}

        {ready && token && !done && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <div>
              <label htmlFor="reset-new" className={`block text-sm mb-1 ${theme.textLabel}`}>New password</label>
              <input
                id="reset-new"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="reset-rules"
                className={inputClass}
              />
              <ul id="reset-rules" className="mt-2 space-y-0.5 text-xs">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <li key={rule.label} className={met ? 'text-kk-brand font-bold' : 'text-kk-muted'}>
                      {met ? '✓' : '○'} {rule.label}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <label htmlFor="reset-confirm" className={`block text-sm mb-1 ${theme.textLabel}`}>Confirm new password</label>
              <input
                id="reset-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>
            <button type="submit" disabled={busy} className={`w-full py-3 rounded-2xl text-sm disabled:opacity-50 ${theme.btnPrimary}`}>
              {busy ? 'Saving…' : 'Change password'}
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-kk-border text-sm flex flex-wrap justify-between gap-2">
          <Link href="/signin" className="font-bold text-kk-accent hover:underline">
            {done ? 'Sign in with your new password →' : '← Back to sign in'}
          </Link>
          {token && !done && (
            <Link href="/reset-password" onClick={() => { setToken(null); setNotice(null); }} className="text-kk-muted hover:underline">
              Need a new link?
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
