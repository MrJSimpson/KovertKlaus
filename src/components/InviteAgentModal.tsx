'use client';

/**
 * @file InviteAgentModal.tsx
 * @description The Head Elf's recruitment modal: share link, email invitations, invitation status.
 *
 * Tier 1 (what): Sends an email invitation (`POST /api/invitations`), lists the mission's
 * invitations with their status (`GET /api/invitations?operationId=`) and revokes pending ones.
 * Tier 2 (why): Invites are tracked records, so the Head Elf can see who is still pending and
 * withdraw an invite; after the cutoff the API offers a Late Pass for registered users.
 * Tier 3 (how): New users receive a Join Exchange link to registration; existing users accept or
 * decline from the mission page or their dashboard (see `src/lib/invitations.ts`).
 */

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

interface InviteAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationId: string;
  operationTitle: string;
  operationCode?: string;
  opsLeaderUserId: string;
  onSuccess?: () => void;
}

/** One row of `GET /api/invitations?operationId=`. */
interface MissionInvitationRow {
  id: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED';
  isLatePass: boolean;
  createdAt: string;
}

const STATUS_STYLE: Record<MissionInvitationRow['status'], string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  ACCEPTED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  DECLINED: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
  REVOKED: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
  EXPIRED: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
};

export function InviteAgentModal({
  isOpen,
  onClose,
  operationId,
  operationTitle,
  operationCode,
  onSuccess,
}: InviteAgentModalProps) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [canUseLatePass, setCanUseLatePass] = useState(false);
  const [invitations, setInvitations] = useState<MissionInvitationRow[]>([]);

  const loadInvitations = useCallback(async () => {
    try {
      const res = await fetch(`/api/invitations?operationId=${encodeURIComponent(operationId)}`);
      if (!res.ok) return;
      const json = await res.json();
      setInvitations(json.invitations || []);
    } catch {
      // Keep the last list on a network blip
    }
  }, [operationId]);

  useEffect(() => {
    if (!isOpen || !operationId) return;
    let cancelled = false;
    fetch(`/api/invitations?operationId=${encodeURIComponent(operationId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setInvitations(json.invitations || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, operationId]);

  if (!isOpen) return null;

  const joinUrl = typeof window !== 'undefined' && operationCode
    ? `${window.location.origin}/exchange/${operationCode}`
    : `https://kovertklaus.com/exchange/${operationCode || ''}`;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  async function sendInvite(isLatePass: boolean) {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    setCanUseLatePass(false);

    try {
      if (!email.trim()) {
        throw new Error('Recipient email address is required.');
      }

      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId, recipientEmail: email.trim(), isLatePass }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setCanUseLatePass(Boolean(json.canUseLatePass));
        throw new Error(json.error || 'Failed to send invitation');
      }

      const successText = json.data?.kdmToken
        ? `🕶️ Kovert Delivery Invitation & Single-Use Key (${json.data.kdmToken}) dispatched to ${email.trim()}!`
        : (json.message || `Invitation dispatched to ${email.trim()}!`);

      setSuccessMessage(successText);
      setEmail('');
      await loadInvitations();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    setError('');
    try {
      const res = await fetch('/api/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, action: 'revoke' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to revoke invitation');
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invitation');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendInvite(false);
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto transition-all shadow-2xl ${theme.modalBg}`}>

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

        <p className={`text-xs mb-3 ${theme.textSubLabel}`}>
          Invite an operative to join <strong className={theme.textLabel}>&quot;{operationTitle}&quot;</strong>.
        </p>

        {/* 1-Click Shareable Mission Link & Code */}
        <div className="mb-4 p-3.5 rounded-2xl border bg-stone-50 dark:bg-slate-900/60 border-stone-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Shareable Mission Link & Code
            </span>
            {operationCode && (
              <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                Code: {operationCode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={joinUrl}
              className="flex-1 bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] font-mono select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-xl font-bold text-[11px] bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow-sm shrink-0"
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
        </div>

        {error && (
          <div className={`p-4 mb-4 rounded-xl text-xs font-semibold ${theme.alertWarning}`}>
            ⚠️ {error}
            {canUseLatePass && (
              <button
                type="button"
                onClick={() => sendInvite(true)}
                disabled={loading}
                className={`block mt-2 px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer ${theme.btnSecondary}`}
              >
                🚨 Send as Late Pass
              </button>
            )}
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
              New operatives get a Join Exchange link that creates their profile (clearing them for the alpha) and enrolls them. Existing operatives can accept or decline from this mission page or their dashboard.
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

        {/* Sent invitations */}
        {invitations.length > 0 && (
          <div className="mt-5 pt-4 border-t border-stone-200 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sent Invitations</span>
            <ul className="mt-2 space-y-1.5">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate font-mono" title={inv.email}>{inv.email}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {inv.isLatePass && <span className="text-[9px] font-bold text-red-500">LATE PASS</span>}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${STATUS_STYLE[inv.status]}`}>{inv.status}</span>
                    {inv.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(inv.id)}
                        className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}
