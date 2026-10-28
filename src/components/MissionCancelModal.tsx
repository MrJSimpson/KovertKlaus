'use client';

/**
 * @file MissionCancelModal.tsx
 * @description Confirmation dialog for cancelling or permanently deleting a Holiday Mission.
 *
 * Tier 1 (what): `mode="cancel"` takes a reason and cancels the mission; `mode="delete"` deletes it
 * for good. Both show a warning banner and stay disabled until the user types the mission title.
 * Used by the Head Elf on the mission page and by North Pole admins.
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
  /** Before the draw (cancel mode): deletion is possible by hand after 48 hours. */
  cancelledBeforeDraw?: boolean;
  onClose: () => void;
  /** Admins may cancel without a reason; the Head Elf must give one (the server enforces it too). */
  reasonRequired?: boolean;
  /** Performs the action; throw an Error with a message to show it. */
  onConfirm: (input: { reason: string }) => Promise<void>;
}

export function MissionCancelModal({ mode, missionTitle, cancelledBeforeDraw = true, reasonRequired = true, onClose, onConfirm }: MissionCancelModalProps) {
  const { theme } = useTheme();
  const [reason, setReason] = useState('');
  const [typedTitle, setTypedTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isDelete = mode === 'delete';
  // Case and surrounding spaces do not matter; the words do.
  const titleMatches = typedTitle.trim().toLowerCase() === missionTitle.trim().toLowerCase();
  const reasonOk = isDelete || !reasonRequired || reason.trim().length > 0;
  const canConfirm = !busy && titleMatches && reasonOk;

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
          <div role="alert" className="p-4 rounded-2xl border-2 border-kk-danger bg-kk-danger-soft text-kk-on-danger-soft">
            <p className="text-lg font-black">⚠️ {isDelete ? 'This deletes the mission forever' : 'This ends the mission for everyone'}</p>
            <p className="mt-1 font-bold">{isDelete ? 'Deleted missions cannot be recovered.' : 'Cancelling cannot be undone.'}</p>
          </div>
          {isDelete ? (
            <>
              <p className={theme.textLabel}>
                This permanently deletes <strong>{missionTitle}</strong> and all of its data: agents, wishlists, messages and reports.
              </p>
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
              <label className="block">
                <span className={`text-xs font-bold ${theme.textSubLabel}`}>Reason{reasonRequired ? '' : ' (optional)'}, shown to every agent</span>
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

          <label className="block">
            <span className={`text-xs font-bold ${theme.textSubLabel}`}>
              Type the mission name <strong className={theme.textHeading}>{missionTitle}</strong> to confirm
            </span>
            <input
              value={typedTitle}
              onChange={(e) => setTypedTitle(e.target.value)}
              className={`mt-1 w-full px-3 py-2.5 rounded-xl border text-base ${theme.cardInnerBg}`}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

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
