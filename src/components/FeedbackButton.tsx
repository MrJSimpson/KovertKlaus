'use client';

/**
 * @file FeedbackButton.tsx
 * @description Floating "Feedback" button on every signed-in page, with a short report form.
 *
 * Tier 1 (what): A fixed button (bottom right) opens a pop-up where the agent picks Bug, Idea or
 * Other, writes up to 2,000 characters and sends it to `POST /api/feedback`.
 * Tier 2 (why): Alpha and beta testers had no in-app way to report problems (owner decisions
 * 2026-10-27: signed-in agents only, floating button on every page, no screenshot).
 * Tier 3 (how): Rendered once in the root layout. It shows only when browser storage holds a
 * signed-in user ID (`USER_ID_KEY`) and the page is a signed-in app page (`showsFeedbackButton`:
 * an allowlist, so the home page and other public pages never show it, owner decision
 * 2026-10-31); the server still checks the session. The page path is sent with the report; the
 * server adds the app version and browser. The pop-up is portaled to `<body>` so headers with
 * `backdrop-blur` cannot trap it.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { USER_ID_KEY } from '@/lib/constants/auth';
import { FEEDBACK_TYPES, MAX_FEEDBACK_LENGTH, showsFeedbackButton, type FeedbackType } from '@/lib/feedback';

const TYPE_LABEL: Record<FeedbackType, string> = { BUG: '🐞 Bug', IDEA: '💡 Idea', OTHER: '💬 Other' };

const TYPE_HINT: Record<FeedbackType, string> = {
  BUG: 'What happened, and what did you expect?',
  IDEA: 'What would make KovertKlaus better for you?',
  OTHER: 'Tell us anything.',
};

/** Whether browser storage says someone is signed in. Storage may be unavailable (private windows). */
function hasSignedInUser(): boolean {
  try {
    return Boolean(window.localStorage.getItem(USER_ID_KEY));
  } catch {
    return false;
  }
}

export function FeedbackButton() {
  const { theme } = useTheme();
  const pathname = usePathname() || '/';
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('BUG');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Re-check on every navigation: signing in or out changes storage without a reload.
  useEffect(() => {
    const timer = window.setTimeout(() => setSignedIn(hasSignedInUser()), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!signedIn || !showsFeedbackButton(pathname)) return null;

  function openForm() {
    setSent(false);
    setError(null);
    setOpen(true);
  }

  async function send() {
    if (!message.trim()) {
      setError('Write a message first.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, pageUrl: window.location.pathname }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 401 ? 'Your session ended. Sign in again to send feedback.' : json.error || 'Could not send. Please try again.');
        return;
      }
      setSent(true);
      setMessage('');
    } catch {
      setError('Could not reach KovertKlaus. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={openForm}
        className="fixed z-40 right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full bg-kk-primary hover:bg-kk-primary-hover text-kk-on-primary text-sm font-bold shadow-lg cursor-pointer transition-all"
        title="Send feedback to the KovertKlaus team"
      >
        <span aria-hidden>📝</span>
        <span>Feedback</span>
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex sm:items-center items-end justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Send feedback"
            className={`w-full max-w-lg max-h-[88dvh] rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col text-left font-normal ${theme.cardBg}`}
          >
            <div className="p-4 sm:p-5 border-b border-kk-border flex items-center justify-between shrink-0">
              <div>
                <h2 className={`text-xl sm:text-2xl font-black ${theme.textHeading}`}>📝 Send Feedback</h2>
                <p className={`text-xs ${theme.textSubLabel}`}>Goes straight to the KovertKlaus team. Thank you for testing!</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-kk-muted hover:text-kk-ink transition-all text-xl font-bold cursor-pointer"
                aria-label="Close feedback"
              >
                ✕
              </button>
            </div>

            {sent ? (
              <div className="p-5 sm:p-6 space-y-4 text-center">
                <div className="text-4xl" aria-hidden>🎁</div>
                <p className={`font-bold ${theme.textHeading}`}>Thanks! Your feedback reached the North Pole.</p>
                <div className="flex justify-center gap-2">
                  <button onClick={() => setSent(false)} className="px-4 min-h-[44px] rounded-xl border border-kk-border text-sm font-bold cursor-pointer">
                    Send another
                  </button>
                  <button onClick={() => setOpen(false)} className="px-4 min-h-[44px] rounded-xl bg-kk-primary hover:bg-kk-primary-hover text-kk-on-primary text-sm font-bold cursor-pointer">
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
                <div className="flex gap-2" role="radiogroup" aria-label="Feedback type">
                  {FEEDBACK_TYPES.map((t) => (
                    <button
                      key={t}
                      role="radio"
                      aria-checked={type === t}
                      onClick={() => setType(t)}
                      className={`flex-1 min-h-[44px] rounded-xl border text-sm font-bold cursor-pointer transition-all ${
                        type === t ? 'bg-kk-primary text-kk-on-primary border-kk-primary' : 'border-kk-border text-kk-ink hover:bg-kk-inset'
                      }`}
                    >
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
                <div>
                  <label htmlFor="feedback-message" className={`block text-xs font-bold mb-1 ${theme.textLabel}`}>
                    {TYPE_HINT[type]}
                  </label>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_FEEDBACK_LENGTH))}
                    rows={6}
                    className="w-full rounded-xl border border-kk-border bg-kk-surface text-kk-ink p-3 text-base focus:outline-none focus:border-kk-focus"
                  />
                  <p className={`text-[11px] mt-1 ${theme.textSubLabel}`}>
                    {message.length} / {MAX_FEEDBACK_LENGTH}. We also record which page you&apos;re on, the app version and your browser.
                  </p>
                </div>
                {error && <p className="text-sm font-semibold text-kk-danger" role="alert">{error}</p>}
                <button
                  onClick={send}
                  disabled={sending}
                  className="w-full min-h-[44px] rounded-xl bg-kk-primary hover:bg-kk-primary-hover text-kk-on-primary text-sm font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  {sending ? 'Sending…' : 'Send Feedback'}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
