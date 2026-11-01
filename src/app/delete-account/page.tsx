'use client';

/**
 * @file page.tsx (/delete-account)
 * @description Self-service account deletion: shows what blocks it and what goes, then deletes.
 *
 * Tier 1 (what): Loads `GET /api/users/delete-account` (missions to close first, missions the agent
 * will leave, closed missions deleted with the account). When nothing blocks, asks for the password
 * and the word DELETE and calls `POST /api/users/delete-account`.
 * Tier 2 (why): The Privacy Policy promised deletion by email only. Owner decisions (2026-11-01):
 * immediate and permanent; refused while the agent runs an open mission or is in a drawn mission.
 * Tier 3 (how): Linked from Account Preferences and the verify-email page. On success the server has
 * cleared the session cookie; the page clears the cached identity and offers the home page.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { USER_ID_KEY } from '@/lib/constants/auth';

interface MissionRef {
  id: string;
  code: string;
  title: string;
  status: string;
}

interface Preview {
  runningMissions: MissionRef[];
  lockedMissions: MissionRef[];
  leavingMissions: MissionRef[];
  closedMissionsRun: number;
  canDelete: boolean;
}

type Phase = 'loading' | 'signed-out' | 'ready' | 'deleted';

/** A list of missions, each linking to its page. */
function MissionList({ missions }: { missions: MissionRef[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm">
      {missions.map((m) => (
        <li key={m.id}>
          <a href={`/exchange/${encodeURIComponent(m.code)}`} className="font-bold text-kk-accent hover:underline">
            {m.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function DeleteAccountPage() {
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>('loading');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/users/delete-account');
        const json = (await res.json().catch(() => ({}))) as Partial<Preview> & { error?: string };
        if (res.status === 401) {
          setPhase('signed-out');
          return;
        }
        if (!res.ok) {
          setError(json.error || 'Could not check your account. Please try again.');
          setPhase('ready');
          return;
        }
        setPreview(json as Preview);
        setPhase('ready');
      } catch {
        setError('Could not reach KovertKlaus. Check your connection and try again.');
        setPhase('ready');
      }
    })();
  }, []);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/users/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirm: confirm.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<Preview> & { error?: string };
      if (res.ok) {
        localStorage.removeItem(USER_ID_KEY);
        localStorage.removeItem('kovertklaus_user_name');
        setPhase('deleted');
        return;
      }
      if (res.status === 409 && json.runningMissions) setPreview(json as Preview);
      setError(json.error || 'Could not delete your account. Please try again.');
    } catch {
      setError('Could not reach KovertKlaus. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass = `w-full border rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none ${theme.inputModalBg}`;
  const blocked = preview && !preview.canDelete;

  return (
    <main className={`min-h-dvh flex items-start sm:items-center justify-center px-4 py-10 ${theme.pageBg}`}>
      <div className={`w-full max-w-md rounded-2xl p-6 space-y-5 ${theme.cardBg}`}>
        <div className="space-y-1">
          <h1 className={`text-2xl ${theme.textHeading}`}>{phase === 'deleted' ? 'Account deleted' : 'Delete your account'}</h1>
          {phase === 'deleted' && (
            <p className={`text-sm ${theme.textSubLabel}`}>
              Your account and its data have been deleted. Thanks for being part of KovertKlaus. You can sign up again any time.
            </p>
          )}
          {phase === 'signed-out' && <p className={`text-sm ${theme.textSubLabel}`}>Sign in to delete your account.</p>}
        </div>

        {error && (
          <div role="alert" className={`p-3 rounded-xl text-sm font-semibold ${theme.alertError}`}>
            {error}
          </div>
        )}

        {phase === 'ready' && preview && blocked && (
          <div className="space-y-4">
            {preview.runningMissions.length > 0 && (
              <div className="space-y-2">
                <p className={`text-sm ${theme.textLabel}`}>
                  <strong>You&apos;re the Head Elf of these missions.</strong> Cancel or finish each one first, so your agents aren&apos;t left
                  without a Head Elf:
                </p>
                <MissionList missions={preview.runningMissions} />
              </div>
            )}
            {preview.lockedMissions.length > 0 && (
              <div className="space-y-2">
                <p className={`text-sm ${theme.textLabel}`}>
                  <strong>Names have been drawn in these missions.</strong> Someone is counting on your gift (or you on theirs), so you can
                  delete your account once they end:
                </p>
                <MissionList missions={preview.lockedMissions} />
              </div>
            )}
          </div>
        )}

        {phase === 'ready' && preview && !blocked && (
          <form onSubmit={handleDelete} className="space-y-4">
            <div className={`text-sm space-y-2 ${theme.textLabel}`}>
              <p>
                <strong>This can&apos;t be undone.</strong> Deleting removes your account, gift dossier, wishlists, messages, reports,
                notifications and Coal Citations right away, and signs you out everywhere.
              </p>
              {preview.leavingMissions.length > 0 && (
                <div className="space-y-1">
                  <p>You&apos;ll leave these missions (their names haven&apos;t been drawn yet), and their Head Elves will be told:</p>
                  <MissionList missions={preview.leavingMissions} />
                </div>
              )}
              {preview.closedMissionsRun > 0 && (
                <p>
                  {preview.closedMissionsRun === 1 ? 'The finished mission you ran is' : `The ${preview.closedMissionsRun} finished missions you ran are`}{' '}
                  deleted too, and their agents are told.
                </p>
              )}
              <p className={theme.textSubLabel}>Copies in our encrypted backups are gone within 30 days.</p>
            </div>
            <div>
              <label htmlFor="delete-password" className={`block text-sm mb-1 ${theme.textLabel}`}>Your password</label>
              <input
                id="delete-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="delete-confirm" className={`block text-sm mb-1 ${theme.textLabel}`}>
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                id="delete-confirm"
                type="text"
                required
                autoComplete="off"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={busy || confirm.trim() !== 'DELETE' || !password}
              className="w-full py-3 rounded-2xl text-sm font-bold bg-kk-danger-soft text-kk-on-danger-soft border-2 border-kk-danger/60 disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Permanently delete my account'}
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-kk-border text-sm">
          {phase === 'deleted' ? (
            <Link href="/" className="font-bold text-kk-accent hover:underline">Go to the home page →</Link>
          ) : phase === 'signed-out' ? (
            <Link href="/signin" className="font-bold text-kk-accent hover:underline">Sign in →</Link>
          ) : (
            <a href="/dashboard" className="font-bold text-kk-accent hover:underline">← Keep my account</a>
          )}
        </div>
      </div>
    </main>
  );
}
