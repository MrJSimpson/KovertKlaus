'use client';

import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

interface InviteAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationId: string;
  operationTitle: string;
  opsLeaderUserId: string;
  onSuccess?: () => void;
}

export function InviteAgentModal({
  isOpen,
  onClose,
  operationId,
  operationTitle,
  opsLeaderUserId,
  onSuccess,
}: InviteAgentModalProps) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      if (!email.trim()) {
        throw new Error('Recipient email address is required.');
      }

      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId,
          requesterUserId: opsLeaderUserId,
          recipientEmail: email.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to send invitation');
      }

      setSuccessMessage(json.message || `Invitation dispatched to ${email.trim()}!`);
      setEmail('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full transition-all shadow-2xl ${theme.modalBg}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200 dark:border-slate-800">
          <div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${theme.badgeCode}`}>
              ✉️ Field Recruitment
            </span>
            <h3 className="text-2xl font-black mt-1">Recruit Field Agent</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        <p className={`text-xs mb-4 ${theme.textSubLabel}`}>
          Invite an operative to join <strong className={theme.textLabel}>"{operationTitle}"</strong>.
        </p>

        {error && (
          <div className={`p-4 mb-4 rounded-xl text-xs font-semibold ${theme.alertWarning}`}>
            ⚠️ {error}
          </div>
        )}

        {successMessage && (
          <div className="p-4 mb-4 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
            ✅ {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          <div>
            <label className="block text-slate-500 mb-1">Recipient Email Address *</label>
            <input
              type="email"
              required
              placeholder="e.g. agent.klaus@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none ${theme.inputModalBg}`}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              An invitation email will be dispatched. If the agent already has a KovertKlaus account, an alert banner will also appear on their dashboard!
            </p>
          </div>

          <div className="flex gap-3 pt-3 border-t border-stone-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className={`w-1/2 font-semibold py-3 rounded-2xl text-xs cursor-pointer ${theme.btnNeutral}`}
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`w-1/2 font-extrabold py-3 rounded-2xl text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${theme.btnPrimary}`}
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Sending...</span>
                </>
              ) : (
                <span>✉️ Dispatch Invite</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
