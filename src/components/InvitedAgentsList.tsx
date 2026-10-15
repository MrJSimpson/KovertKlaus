'use client';

/**
 * @file InvitedAgentsList.tsx
 * @description The invited (not yet enrolled) section of the Head Elf's Elf Agents roster.
 *
 * Tier 1 (what): Lists the mission's emailed invitations (`GET /api/invitations?operationId=`)
 * with their status, and lets the Head Elf resend (`POST /api/invitations { invitationId }`) or
 * revoke (`PATCH /api/invitations`) them.
 * Tier 2 (why): Invitations used to be listed inside the Invite Agent modal, so the Head Elf had to
 * open a send form to see who was still outstanding. Keeping them on the roster shows the whole
 * team (enrolled and invited) in one place; the modal only sends.
 * Tier 3 (how): Accepted invitations are hidden because those agents already appear as enrolled
 * members above. `refreshKey` reloads the list after the modal sends an invite. The server enforces
 * the resend rules (Head Elf only, cooldown, cutoff/Late Pass; see `src/lib/invitations.ts`).
 */

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

/** One row of `GET /api/invitations?operationId=`. */
interface MissionInvitationRow {
  id: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED';
  isLatePass: boolean;
  createdAt: string;
  lastSentAt: string;
}

const STATUS_STYLE: Record<MissionInvitationRow['status'], string> = {
  PENDING: 'bg-kk-warning text-kk-on-warning border-kk-border-strong',
  ACCEPTED: 'bg-kk-success text-kk-on-success border-kk-on-success/30',
  DECLINED: 'bg-kk-inset text-kk-muted border-kk-border',
  REVOKED: 'bg-kk-inset text-kk-muted border-kk-border',
  EXPIRED: 'bg-kk-inset text-kk-muted border-kk-border',
};

const STATUS_LABEL: Record<MissionInvitationRow['status'], string> = {
  PENDING: 'Invited',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  REVOKED: 'Revoked',
  EXPIRED: 'Expired',
};

/**
 * The mission's invitations minus accepted ones (those agents are listed as enrolled), or `null`
 * on a failed request so the caller keeps its last list.
 */
async function fetchOpenInvitations(operationId: string): Promise<MissionInvitationRow[] | null> {
  try {
    const res = await fetch(`/api/invitations?operationId=${encodeURIComponent(operationId)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return ((json.invitations || []) as MissionInvitationRow[]).filter((r) => r.status !== 'ACCEPTED');
  } catch {
    return null;
  }
}

interface InvitedAgentsListProps {
  operationId: string;
  /** Bump to reload, e.g. after the Invite Agent modal sends an invitation. */
  refreshKey: number;
  /** Reports how many invitations are still pending, for the roster heading. */
  onPendingCountChange?: (count: number) => void;
}

export function InvitedAgentsList({ operationId, refreshKey, onPendingCountChange }: InvitedAgentsListProps) {
  const { theme } = useTheme();
  const [invitations, setInvitations] = useState<MissionInvitationRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const applyRows = useCallback((rows: MissionInvitationRow[]) => {
    setInvitations(rows);
    onPendingCountChange?.(rows.filter((r) => r.status === 'PENDING').length);
  }, [onPendingCountChange]);

  const loadInvitations = useCallback(async () => {
    const rows = await fetchOpenInvitations(operationId);
    if (rows) applyRows(rows);
  }, [operationId, applyRows]);

  useEffect(() => {
    if (!operationId) return;
    let cancelled = false;
    fetchOpenInvitations(operationId).then((rows) => {
      if (!cancelled && rows) applyRows(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [operationId, refreshKey, applyRows]);

  async function act(inv: MissionInvitationRow, kind: 'resend' | 'revoke') {
    setBusyId(inv.id);
    setNotice(null);
    try {
      const res = await fetch('/api/invitations', {
        method: kind === 'resend' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'resend' ? { invitationId: inv.id } : { invitationId: inv.id, action: 'revoke' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Failed to ${kind} invitation`);
      setNotice({
        ok: kind === 'revoke' || json.emailSent !== false,
        text: kind === 'revoke' ? `Invitation to ${inv.email} revoked.` : json.message || `Invitation resent to ${inv.email}.`,
      });
      await loadInvitations();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : `Failed to ${kind} invitation` });
    } finally {
      setBusyId(null);
    }
  }

  if (invitations.length === 0) return null;

  return (
    <div className="mt-5 pt-4 border-t border-kk-border">
      <span className="text-[10px] font-bold text-kk-muted uppercase tracking-wider">✉️ Invited</span>

      {notice && (
        <div className={`mt-2 p-2.5 rounded-xl text-[11px] font-semibold ${notice.ok
          ? 'bg-kk-success text-kk-on-success border border-kk-on-success/30'
          : theme.alertWarning}`}
        >
          {notice.ok ? '✅' : '⚠️'} {notice.text}
        </div>
      )}

      <ul className="mt-2 space-y-2">
        {invitations.map((inv) => {
          const canResend = inv.status === 'PENDING' || inv.status === 'EXPIRED' || inv.status === 'REVOKED';
          return (
            <li key={inv.id} className={`p-3 rounded-2xl border text-xs ${theme.cardInnerBg}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`truncate font-mono font-bold ${theme.textLabel}`} title={inv.email}>{inv.email}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {inv.isLatePass && <span className="text-[9px] font-bold text-kk-danger">LATE PASS</span>}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${STATUS_STYLE[inv.status]}`}>{STATUS_LABEL[inv.status]}</span>
                </span>
              </div>
              {inv.status === 'PENDING' && (
                <span className={`block mt-1 text-[10px] font-mono ${theme.textSubLabel}`}>
                  Last sent {new Date(inv.lastSentAt).toLocaleString()}
                </span>
              )}
              {canResend && (
                <div className="mt-2 pt-2 border-t border-kk-border flex items-center gap-1.5 flex-wrap">
                  {canResend && (
                    <button
                      type="button"
                      onClick={() => act(inv, 'resend')}
                      disabled={busyId === inv.id}
                      title="Email this invitation again"
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-kk-inset text-kk-accent border border-kk-border-strong hover:border-kk-border-strong transition-all cursor-pointer disabled:opacity-50"
                    >
                      {busyId === inv.id ? '⏳ Sending...' : '🔁 Resend'}
                    </button>
                  )}
                  {inv.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => act(inv, 'revoke')}
                      disabled={busyId === inv.id}
                      title="Withdraw this invitation"
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-kk-danger-soft text-kk-on-danger-soft border border-kk-danger/40 hover:brightness-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      ❌ Revoke
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
