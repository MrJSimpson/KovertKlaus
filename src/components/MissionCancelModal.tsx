'use client';

/**
 * @file MissionCancelModal.tsx
 * @description Confirmation dialog for cancelling or permanently deleting a Holiday Mission.
 *
 * Tier 1 (what): `mode="cancel"` takes an optional reason and cancels the mission; `mode="delete"`
 * asks the user to type the mission code, then deletes it for good. Used by the Head Elf on the
 * mission page and by North Pole admins.
 * Tier 2 (why): Both actions affect every agent and deletion cannot be undone, so each needs a
 * deliberate second step with the consequences spelled out.
 * Tier 3 (how): The parent supplies `onConfirm`, which calls the right endpoint and throws with
 * the server's message on failure; the dialog shows that message and stays open.
 */

import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { MAX_CANCEL_REASON_LENGTH } from '@/lib/mission-cancel';

interface MissionCancelModalProps {
  mode: 'cancel' | 'delete';
  missionTitle: string;
  missionCode: string;
  /** Before the draw (cancel mode): deletion is possible by hand after 48 hours. */
  cancelledBeforeDraw?: boolean;
  onClose: () => void;
  /** Performs the action; throw an Error with a message to show it. */
  onConfirm: (input: { reason: string }) => Promise<void>;
}

export function MissionCancelModal({ mode, missionTitle, missionCode, cancelledBeforeDraw = true, onClose, onConfirm }: MissionCancelModalProps) {
  const { theme } = useTheme();
  const [reason, setReason] = useState('');
  const [typedCode, setTypedCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isDelete = mode === 'delete';
  const canConfirm = !busy && (!isDelete || typedCode.trim().toUpperCase() === missionCode.toUpperCase());

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await onConfirm({ reason: reason.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex sm:items-center items-end justify-center p-0 sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={isDelete ? 'Delete mission' : 'Cancel mission'} className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden ${theme.cardBg}`}>
        <div className="p-5 border-b border-kk-border flex items-center justify-between">
          <h2 className={`text-xl font-black ${theme.textHeading}`}>{isDelete ? '🗑️ Delete Mission' : '🛑 Cancel Mission'}</h2>
          <button
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-kk-muted hover:text-kk-ink transition-all text-xl font-bold cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          {isDelete ? (
            <>
              <p className={theme.textLabel}>
                This permanently deletes <strong>{missionTitle}</strong> and all of its data: agents, wishlists, messages and reports.
              </p>
              <p className="font-bold text-kk-danger">Deleted missions cannot be recovered.</p>
              <label className="block">
                <span className={`text-xs font-bold ${theme.textSubLabel}`}>Type the mission code <span className="font-mono">{missionCode}</span> to confirm</span>
                <input
                  value={typedCode}
                  onChange={(e) => setTypedCode(e.target.value)}
                  className={`mt-1 w-full px-3 py-2.5 rounded-xl border font-mono text-base ${theme.cardInnerBg}`}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </>
          ) : (
            <>
              <p className={theme.textLabel}>
                Cancelling <strong>{missionTitle}</strong> stops it now. Every agent is notified and emailed, and the mission becomes read-only so they can save what they need. Nobody receives a Coal Citation.
              </p>
              <p className={theme.textSubLabel}>
                {cancelledBeforeDraw
                  ? 'Because the draw has not happened, you can delete it permanently 48 hours after cancelling. Otherwise it is deleted automatically after 90 days.'
                  : 'Because the draw has happened, it cannot be deleted by hand. It is deleted automatically 90 days after cancelling.'}
              </p>
              <p className="font-bold">Cancelling cannot be undone.</p>
              <label className="block">
                <span className={`text-xs font-bold ${theme.textSubLabel}`}>Reason (optional, shown to agents)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={MAX_CANCEL_REASON_LENGTH}
                  rows={3}
                  className={`mt-1 w-full px-3 py-2.5 rounded-xl border text-base ${theme.cardInnerBg}`}
                />
              </label>
            </>
          )}

          {error && <p className="text-xs font-bold text-kk-danger">⚠️ {error}</p>}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button onClick={onClose} className={`px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold cursor-pointer ${theme.btnNeutral}`}>
              Keep mission
            </button>
            <button
              onClick={submit}
              disabled={!canConfirm}
              className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-extrabold cursor-pointer bg-kk-danger-soft text-kk-on-danger-soft border-2 border-kk-danger disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? 'Working...' : isDelete ? 'Delete permanently' : 'Cancel mission'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
