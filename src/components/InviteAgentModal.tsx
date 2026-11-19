'use client';

/**
 * @file InviteAgentModal.tsx
 * @description The Head Elf's recruitment modal: share link and email invitations.
 *
 * Tier 1 (what): Sends an email invitation (`POST /api/invitations`) and shows the shareable
 * mission link and code.
 * Tier 2 (why): The modal only sends. Sent invitations, with their status, Resend and Revoke, live
 * on the mission's Elf Agents roster (`InvitedAgentsList`), so the whole team is managed in one
 * place. After the cutoff the API offers a Late Pass for registered users.
 * Tier 3 (how): New users receive a Join Exchange link to registration; existing users join from the
 * link in their invitation email (in-app invitations wait for email verification, see
 * `MATCH_INVITATIONS_BY_EMAIL` in `src/lib/invitations.ts`). `onSuccess`
 * lets the roster reload its invited list. Visual refresh (2.0.0-beta, design canvas "Invite agents
 * dialog / sheet"): centred dialog on desktop, bottom sheet on phones, Escape closes it.
 */

import { useEffect, useState } from 'react';
import { Icon } from '@/components/brand/Icon';

interface InviteAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationId: string;
  operationTitle: string;
  operationCode?: string;
  opsLeaderUserId: string;
  onSuccess?: () => void;
}

export function InviteAgentModal({
  isOpen,
  onClose,
  operationId,
  operationTitle,
  operationCode,
  onSuccess,
}: InviteAgentModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [canUseLatePass, setCanUseLatePass] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendInvite(false);
  }

  const linkHost = joinUrl.replace(/^https?:\/\//, '').replace(/[^/]+$/, '');
  const linkCode = joinUrl.split('/').pop() ?? '';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-h"
        className="kk-card w-full sm:max-w-[520px] max-h-[92dvh] overflow-y-auto flex flex-col gap-5 rounded-b-none sm:rounded-b-[var(--kk-radius-lg)] shadow-kk-raised pb-[max(24px,calc(env(safe-area-inset-bottom)+12px))] sm:pb-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="eyebrow m-0 uppercase text-kk-stamp break-words">{operationTitle}</p>
            <h2 id="invite-h" className="m-0 font-display text-[22px] leading-7 font-semibold text-kk-heading">
              Invite Elf Agents
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="kk-btn kk-btn--ghost kk-btn--sm !px-0 w-11 shrink-0">
            <Icon name="close" />
          </button>
        </div>

        {/* Share link */}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Share the invite link</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="kk-codename max-w-full break-all">
              {linkHost}
              <wbr />
              {linkCode}
            </span>
            <button type="button" onClick={handleCopyLink} className="kk-btn kk-btn--secondary kk-btn--sm" aria-live="polite">
              <Icon name={copied ? 'check' : 'send'} size={16} />
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <span className="text-[13px] leading-5 text-kk-muted">
            Anyone with the link can see the mission and ask to join; the Head Elf approves people who join with the code.
          </span>
        </div>

        {error && (
          <div role="alert" className="kk-banner kk-banner--warning flex-col items-start">
            <span>{error}</span>
            {canUseLatePass && (
              <button type="button" onClick={() => sendInvite(true)} disabled={loading} className="kk-btn kk-btn--secondary kk-btn--sm">
                Send as Late Pass
              </button>
            )}
          </div>
        )}
        {successMessage && (
          <div role="status" className="kk-banner kk-banner--success">
            <Icon name="check" size={20} />
            <span>{successMessage.replace(/^[^\p{L}\p{N}]+/u, '')}</span>
          </div>
        )}

        {/* Invite by email */}
        <form onSubmit={handleSubmit} className="kk-field">
          <label className="kk-field__label" htmlFor="invite-email">
            Or invite by email
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="invite-email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="kk-field__input flex-1 min-w-0"
              aria-describedby="invite-email-help"
            />
            <button type="submit" disabled={loading} className="kk-btn kk-btn--primary">
              <Icon name="send" />
              {loading ? 'Sending…' : 'Send invite'}
            </button>
          </div>
          <span id="invite-email-help" className="kk-field__help">
            New agents get a link that creates their account and joins them straight away. Each invite uses one email from today&apos;s sending limit. Resend or revoke invitations under Elf Agents.
          </span>
        </form>
      </div>
    </div>
  );
}
