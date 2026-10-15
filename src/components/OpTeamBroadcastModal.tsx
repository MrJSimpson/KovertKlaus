'use client';

import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

interface OpTeamBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationId: string;
  operationTitle: string;
  opsLeaderUserId: string;
  onSuccess?: () => void;
}

export function OpTeamBroadcastModal({
  isOpen,
  onClose,
  operationId,
  operationTitle,
  opsLeaderUserId,
  onSuccess,
}: OpTeamBroadcastModalProps) {
  const { theme } = useTheme();
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!messageText.trim()) {
      setError('Broadcast message text is required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendOpTeamBroadcast',
          operationId,
          userId: opsLeaderUserId,
          messageText: messageText.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to dispatch OpTeam broadcast');
      }

      setSuccessMessage('📢 OpTeam Broadcast dispatched to all enrolled agents!');
      setMessageText('');
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Broadcast failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full transition-all shadow-2xl ${theme.modalBg}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-kk-border">
          <div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${theme.badgeCode}`}>
              📢 OpTeam Communication
            </span>
            <h3 className="text-xl font-black mt-1">OpTeam Broadcast Alert</h3>
          </div>
          <button
            onClick={onClose}
            className="text-kk-muted hover:text-kk-ink font-bold text-xl cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        <p className={`text-xs mb-4 ${theme.textSubLabel}`}>
          Dispatch an urgent broadcast alert to all enrolled operatives in <strong className={theme.textLabel}>"{operationTitle}"</strong>.
        </p>

        {error && (
          <div className={`p-4 mb-4 rounded-xl text-xs font-semibold ${theme.alertWarning}`}>
            ⚠️ {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3 mb-4 rounded-xl text-xs font-bold bg-kk-success text-kk-on-success border border-kk-on-success/30">
            ✅ {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          <div>
            <label className="block text-kk-muted mb-1">Broadcast Message Text *</label>
            <textarea
              rows={4}
              required
              placeholder="e.g. Attention Agents! Please attach your Wishlist Manifests before the Go/No-Go cutoff date!"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className={`w-full border rounded-xl p-3 text-xs focus:outline-none ${theme.inputModalBg}`}
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-kk-border">
            <button
              type="button"
              onClick={onClose}
              className={`w-1/2 font-semibold py-3 rounded-2xl text-xs cursor-pointer ${theme.btnNeutral}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !messageText.trim()}
              className={`w-1/2 font-extrabold py-3 rounded-2xl text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${theme.btnPrimary}`}
            >
              {loading ? (
                <span>⏳ Dispatching...</span>
              ) : (
                <span>📢 Send Broadcast</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
