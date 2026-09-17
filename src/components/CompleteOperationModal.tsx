'use client';

import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

interface CompleteOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationId: string;
  operationTitle: string;
  enforcePenalties?: boolean;
  userId: string;
  onSuccess?: () => void;
}

export function CompleteOperationModal({
  isOpen,
  onClose,
  operationId,
  operationTitle,
  enforcePenalties = true,
  userId,
  onSuccess,
}: CompleteOperationModalProps) {
  const { theme } = useTheme();
  const [applyDemerits, setApplyDemerits] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'endOperation',
          operationId,
          userId,
          applyDemerits: enforcePenalties ? applyDemerits : false,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to complete operation');
      }

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className={`relative w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl border ${theme.cardBg} border-slate-700/60 transition-all`}>
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
          title="Close modal"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🏁</span>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100">
              Complete Operation
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              {operationTitle}
            </p>
          </div>
        </div>

        {/* Informational Message */}
        <p className="text-xs text-slate-300 mb-5 leading-relaxed">
          Ending this operation transitions its status to <strong className="text-emerald-400 font-mono">COMPLETED</strong> and updates its execution date to today. This locks assignments and activates the post-event After-Action Report (AAR) debrief feed.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-700/60 text-red-200 text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleComplete} className="space-y-5">
          {/* Head-Elf Demerits Option Checkbox */}
          {enforcePenalties ? (
            <div
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                applyDemerits
                  ? 'bg-amber-950/40 border-amber-600/70'
                  : 'bg-stone-900/60 border-slate-800 hover:border-slate-700'
              }`}
              onClick={() => setApplyDemerits(!applyDemerits)}
            >
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyDemerits}
                  onChange={(e) => setApplyDemerits(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 h-4 w-4 rounded border-slate-600 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <span>⚖️</span>
                    <span>Assign Demerits & Process Auto-Rehabilitation</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Evaluate all operatives. Operatives with unfulfilled assignments and zero carrier tracking proof will be issued 1 Coal Citation. Operatives who fulfilled their mission will have 1 citation cleared.
                  </p>
                </div>
              </label>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/50 text-xs text-slate-400 flex items-center gap-2">
              <span>ℹ️</span>
              <span>Demerits are disabled for this operation. No penalties will be evaluated or assigned.</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="animate-spin inline-block">⏳</span>
                  <span>Completing Operation...</span>
                </>
              ) : (
                <>
                  <span>🏁</span>
                  <span>Confirm & Complete Operation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
