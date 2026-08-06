'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';

interface JoinOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onSuccess?: (operationCode: string) => void;
}

export function JoinOperationModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
}: JoinOperationModalProps) {
  const router = useRouter();
  const { theme } = useTheme();

  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const activeUserId = userId || localStorage.getItem('kovertklaus_user_id');
      if (!activeUserId) {
        throw new Error('Authentication required. Please sign in to join an operation.');
      }

      const cleanCode = inviteCode.trim().toUpperCase();
      if (!cleanCode) {
        throw new Error('Please enter an Operation Invite Code (e.g. K9X2-R7M4).');
      }

      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUserId,
          operationCode: cleanCode,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.error?.includes('already enrolled')) {
          onClose();
          router.push(`/exchange/${cleanCode}`);
          return;
        }
        throw new Error(json.error || 'Failed to join operation.');
      }

      onClose();

      if (onSuccess) {
        onSuccess(cleanCode);
      } else {
        router.push(`/exchange/${cleanCode}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join operation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full transition-all shadow-2xl ${theme.modalBg}`}>
        
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200 dark:border-slate-800">
          <div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${theme.badgeCode}`}>
              🕵️ Field Agent Recruitment
            </span>
            <h3 className="text-2xl font-black mt-1">Join Operation</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className={`p-4 mb-4 rounded-xl text-xs font-semibold ${theme.alertWarning}`}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          <div>
            <label className="block text-slate-500 mb-1">Operation Invite Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. K9X2-R7M4"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className={`w-full border rounded-xl px-3 py-3 text-base font-mono font-bold tracking-wider text-center focus:outline-none uppercase ${theme.inputModalBg}`}
            />
            <p className="text-[10px] text-slate-500 mt-1 text-center">
              Enter the 6-character encrypted invite code provided by your OpsLeader.
            </p>
          </div>

          <div className="flex gap-3 pt-3 border-t border-stone-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className={`w-1/2 font-semibold py-3 rounded-2xl text-xs cursor-pointer ${theme.btnNeutral}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`w-1/2 font-extrabold py-3 rounded-2xl text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${theme.btnPrimary}`}
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Enlisting...</span>
                </>
              ) : (
                <span>Enlist in Operation →</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
