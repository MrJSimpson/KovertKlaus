'use client';

/**
 * @file page.tsx
 * @description North Pole feedback triage: every report agents sent from the Feedback button.
 *
 * Tier 1 (what): Lists feedback newest first (`GET /api/northpole/feedback`), filtered by status
 * and type; each card can be marked New / Reviewed / Done (`PATCH`) or deleted (`DELETE`).
 * Tier 2 (why): Feedback is stored instead of emailed (owner decision 2026-10-27, saves the Brevo
 * daily quota), so this page is where it is read.
 * Tier 3 (how): Same admin token header and look as the Reservations page. Deleting asks for a
 * second click on the same card instead of opening a modal.
 */

import { useCallback, useEffect, useState } from 'react';
import { ADMIN_TOKEN_KEY } from '@/lib/constants/auth';
import { FEEDBACK_STATUSES, FEEDBACK_TYPES, type FeedbackStatus, type FeedbackType } from '@/lib/feedback';

/** One row of `GET /api/northpole/feedback`. */
interface FeedbackRow {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  message: string;
  pagePath: string | null;
  appVersion: string | null;
  userAgent: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string;
}

const TYPE_LABEL: Record<FeedbackType, string> = { BUG: '🐞 Bug', IDEA: '💡 Idea', OTHER: '💬 Other' };

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  NEW: 'bg-kk-warning text-kk-on-warning border-kk-border-strong',
  REVIEWED: 'bg-kk-inset text-kk-ink border-kk-border',
  DONE: 'bg-kk-success text-kk-on-success border-kk-on-success/30',
};

/** Headers for admin API calls (token header for the edge worker, cookie for self-hosted). */
function adminHeaders(json = false): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
  return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { 'x-admin-token': token } : {}) };
}

export default function NorthPoleFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | FeedbackStatus>('NEW');
  const [typeFilter, setTypeFilter] = useState<'ALL' | FeedbackType>('ALL');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      const res = await fetch(`/api/northpole/feedback?${params}`, { credentials: 'include', headers: adminHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load feedback');
      setRows(json.feedback || []);
      setTotalCount(json.totalCount || 0);
      setNewCount(json.newCount || 0);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Failed to load feedback', isError: true });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function setStatus(row: FeedbackRow, status: FeedbackStatus) {
    setBusyId(row.id);
    try {
      const res = await fetch('/api/northpole/feedback', {
        method: 'PATCH',
        credentials: 'include',
        headers: adminHeaders(true),
        body: JSON.stringify({ id: row.id, status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Update failed');
      await load();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Update failed', isError: true });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: FeedbackRow) {
    if (confirmDeleteId !== row.id) {
      setConfirmDeleteId(row.id);
      return;
    }
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/northpole/feedback?id=${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: adminHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      setMessage({ text: 'Feedback deleted.', isError: false });
      await load();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Delete failed', isError: true });
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-kk-border">
        <div>
          <h1 className="text-2xl font-black text-kk-heading flex items-center gap-2">📝 Agent Feedback</h1>
          <p className="text-xs text-kk-muted font-mono mt-1">Reports sent from the Feedback button, newest first.</p>
        </div>
        <div className="flex items-center gap-2 bg-kk-surface border border-kk-border px-3 py-1.5 rounded-xl font-mono text-xs text-kk-ink">
          <span className="text-kk-brand font-bold">{newCount}</span> New
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono flex items-center justify-between shadow-lg ${
            message.isError ? 'bg-kk-danger-soft border-kk-danger/40 text-kk-on-danger-soft' : 'bg-kk-success border-kk-on-success/30 text-kk-on-success'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100 font-bold ml-4">✕</button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-kk-surface border border-kk-border p-1 rounded-xl text-xs font-mono">
          {(['ALL', ...FEEDBACK_STATUSES] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition text-[11px] ${statusFilter === st ? 'bg-kk-inset text-kk-ink font-bold shadow' : 'text-kk-muted hover:text-kk-ink'}`}
            >
              {st}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 bg-kk-surface border border-kk-border p-1 rounded-xl text-xs font-mono">
          {(['ALL', ...FEEDBACK_TYPES] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg transition text-[11px] ${typeFilter === t ? 'bg-kk-inset text-kk-ink font-bold shadow' : 'text-kk-muted hover:text-kk-ink'}`}
            >
              {t === 'ALL' ? 'ALL TYPES' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-kk-muted font-mono text-xs flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-kk-danger/40 border-t-transparent animate-spin" />
          Loading feedback…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-kk-muted font-mono text-xs space-y-2">
          <div className="text-3xl">📭</div>
          <p className="text-kk-ink font-bold">No feedback matches these filters.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="bg-kk-surface/60 border border-kk-border rounded-2xl p-4 shadow-md space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="font-bold text-kk-ink">{TYPE_LABEL[row.type] ?? row.type}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLE[row.status] ?? ''}`}>{row.status}</span>
                <span className="text-kk-muted">{new Date(row.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-kk-ink whitespace-pre-wrap break-words">{row.message}</p>
              <div className="text-[11px] font-mono text-kk-muted space-y-0.5 break-all">
                <div>
                  From {row.userName || 'Unnamed agent'} ·{' '}
                  <a href={`mailto:${row.userEmail}`} className="underline hover:text-kk-ink">{row.userEmail}</a>
                </div>
                <div>Page {row.pagePath || 'unknown'} · v{row.appVersion || '?'}</div>
                {row.userAgent && <div title={row.userAgent} className="truncate">{row.userAgent}</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_STATUSES.filter((s) => s !== row.status).map((s) => (
                  <button
                    key={s}
                    disabled={busyId === row.id}
                    onClick={() => setStatus(row, s)}
                    className="px-3 py-1.5 rounded-lg border border-kk-border text-[11px] font-mono font-bold text-kk-ink hover:bg-kk-inset transition disabled:opacity-50"
                  >
                    Mark {s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
                <button
                  disabled={busyId === row.id}
                  onClick={() => remove(row)}
                  className="px-3 py-1.5 rounded-lg border border-kk-danger/40 text-[11px] font-mono font-bold text-kk-danger hover:bg-kk-danger-soft transition disabled:opacity-50"
                >
                  {confirmDeleteId === row.id ? 'Click again to delete' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] font-mono text-kk-muted">{totalCount} matching report{totalCount === 1 ? '' : 's'}{totalCount > rows.length ? `, newest ${rows.length} shown` : ''}.</p>
    </div>
  );
}
