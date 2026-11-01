'use client';

/**
 * @file page.tsx (/verify-email)
 * @description Email verification: confirm the emailed link, or wait for it with a resend button.
 *
 * Tier 1 (what): Opened from the emailed link (`?token=…`) it calls
 * `POST /api/users/verify-email/confirm` and then offers the dashboard. Opened without a token (the
 * dashboard and mission page send unverified agents here) it shows the address the link went to, a
 * resend button (`POST /api/users/verify-email`), a "check again" button and sign out.
 * Tier 2 (why): Owner decision (2026-11-01): new agents verify their email before the dashboard,
 * because open beta sign-up let anyone register with someone else's address.
 * Tier 3 (how): Query values are read from `window.location` after mount (the SaaS edition is a
 * static export). The token is removed from the address bar once read. `next` is honoured only as a
 * same-site path (starts with one `/`), so the page cannot be used to redirect off-site.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { USER_ID_KEY } from '@/lib/constants/auth';

type Notice = { kind: 'success' | 'warning' | 'error'; text: string } | null;
type Phase = 'loading' | 'confirming' | 'verified' | 'waiting' | 'signed-out';

/** A same-site path to continue to, or the dashboard. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
}

export default function VerifyEmailPage() {
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>('loading');
  const [email, setEmail] = useState('');
  const [next, setNext] = useState('/dashboard');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  /** Reads the session: verified agents continue, unverified ones wait here, others are signed out. */
  const checkSession = useCallback(async (continueTo: string, quiet = false) => {
    try {
      const res = await fetch('/api/users/me');
      const json = (await res.json().catch(() => ({}))) as { authenticated?: boolean; emailVerified?: boolean; user?: { email?: string } };
      if (res.ok && json.authenticated) {
        window.location.href = continueTo;
        return;
      }
      if (res.status === 403 && json.authenticated && json.emailVerified === false) {
        setEmail(json.user?.email || '');
        setPhase('waiting');
        if (!quiet) setNotice(null);
        else setNotice({ kind: 'warning', text: "Your email isn't verified yet. Open the link in the email we sent you." });
        return;
      }
      setPhase('signed-out');
    } catch {
      setPhase('signed-out');
      setNotice({ kind: 'error', text: 'Could not reach KovertKlaus. Check your connection and try again.' });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const continueTo = safeNext(params.get('next'));
    // Read once after mount (static export has no server-side query).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNext(continueTo);
    if (!token) {
      void checkSession(continueTo);
      return;
    }
    window.history.replaceState(null, '', window.location.pathname);
    setPhase('confirming');
    void (async () => {
      try {
        const res = await fetch('/api/users/verify-email/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        if (res.ok) {
          setPhase('verified');
          setNotice({ kind: 'success', text: json.message || 'Your email is verified.' });
        } else {
          setNotice({ kind: 'error', text: json.error || 'This verification link is invalid or expired.' });
          await checkSession(continueTo, false);
        }
      } catch {
        setPhase('signed-out');
        setNotice({ kind: 'error', text: 'Could not reach KovertKlaus. Check your connection and try again.' });
      }
    })();
  }, [checkSession]);

  async function handleResend() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/users/verify-email', { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string; queued?: boolean; alreadyVerified?: boolean };
      if (json.alreadyVerified) {
        window.location.href = next;
        return;
      }
      if (!res.ok) setNotice({ kind: 'error', text: json.error || 'Could not send the email. Please try again.' });
      else setNotice({ kind: json.queued ? 'warning' : 'success', text: json.message || 'Check your email for a new link.' });
    } catch {
      setNotice({ kind: 'error', text: 'Could not reach KovertKlaus. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      await fetch('/api/users/me', { method: 'DELETE' });
    } catch {
      // Ignore network errors on sign out
    }
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem('kovertklaus_user_name');
    window.location.href = '/';
  }

  const noticeClass = notice?.kind === 'error' ? theme.alertError : notice?.kind === 'warning' ? theme.alertWarning : theme.alertSuccess;
  const heading =
    phase === 'verified' ? 'Email verified' : phase === 'waiting' ? 'Check your email' : phase === 'confirming' ? 'Verifying…' : 'Verify your email';

  return (
    <main className={`min-h-dvh flex items-start sm:items-center justify-center px-4 py-10 ${theme.pageBg}`}>
      <div className={`w-full max-w-md rounded-2xl p-6 space-y-5 ${theme.cardBg}`}>
        <div className="space-y-1">
          <h1 className={`text-2xl ${theme.textHeading}`}>{heading}</h1>
          {phase === 'waiting' && (
            <p className={`text-sm ${theme.textSubLabel}`}>
              We sent a verification link to <strong>{email || 'your email address'}</strong>. Open it to start using KovertKlaus. Check
              your spam folder if it isn&apos;t in your inbox.
            </p>
          )}
          {phase === 'signed-out' && <p className={`text-sm ${theme.textSubLabel}`}>Sign in to send yourself a new verification link.</p>}
        </div>

        {notice && (
          <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`p-3 rounded-xl text-sm font-semibold ${noticeClass}`}>
            {notice.text}
          </div>
        )}

        {phase === 'verified' && (
          <a href={next} className={`block w-full text-center py-3 rounded-2xl text-sm ${theme.btnPrimary}`}>
            Continue to KovertKlaus →
          </a>
        )}

        {phase === 'waiting' && (
          <div className="space-y-3">
            <button type="button" onClick={handleResend} disabled={busy} className={`w-full py-3 rounded-2xl text-sm disabled:opacity-50 ${theme.btnPrimary}`}>
              {busy ? 'Sending…' : 'Email me a new link'}
            </button>
            <button
              type="button"
              onClick={() => void checkSession(next, true)}
              className="w-full py-2 text-sm font-bold text-kk-accent hover:underline"
            >
              I&apos;ve verified, continue
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-kk-border text-sm flex flex-wrap justify-between gap-2">
          {phase === 'waiting' ? (
            <>
              <span className="text-kk-muted">Wrong address? Sign out and create a new account.</span>
              <button type="button" onClick={handleSignOut} className="font-bold text-kk-accent hover:underline">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/signin" className="font-bold text-kk-accent hover:underline">
              {phase === 'signed-out' ? 'Sign in →' : '← Back to sign in'}
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
