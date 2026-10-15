'use client';

import { ADMIN_TOKEN_KEY } from '@/lib/constants/auth';

import { useState, useEffect } from 'react';

interface ClearanceLeadRecord {
  id: string;
  email: string;
  name?: string | null;
  source: string;
  status: string;
  inviteCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function NorthPoleLeadsPage() {
  const [leads, setLeads] = useState<ClearanceLeadRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteLead, setConfirmDeleteLead] = useState<ClearanceLeadRecord | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLeads();
  }, [statusFilter]);

  async function fetchLeads(query = searchQuery, retryCount = 0) {
    if (retryCount === 0) setLoading(true);
    try {
      let url = `/api/northpole/leads?q=${encodeURIComponent(query)}`;
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
      const res = await fetch(url, {
        credentials: 'include',
        headers: token ? { 'x-admin-token': token } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setLeads(json.leads || []);
        setTotalCount(json.totalCount || (json.leads ? json.leads.length : 0));
        setLoading(false);
        return;
      }
      if (retryCount < 2) {
        setTimeout(() => fetchLeads(query, retryCount + 1), 600 * (retryCount + 1));
        return;
      }
    } catch (error) {
      console.error('Failed to fetch clearance leads:', error);
      if (retryCount < 2) {
        setTimeout(() => fetchLeads(query, retryCount + 1), 600 * (retryCount + 1));
        return;
      }
    } finally {
      if (retryCount >= 2) {
        setLoading(false);
      }
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchLeads(searchQuery);
  }

  async function handleDeleteLead(lead: ClearanceLeadRecord) {
    setDeletingId(lead.id);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
      const res = await fetch(`/api/northpole/leads?id=${encodeURIComponent(lead.id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { 'x-admin-token': token } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setLeads((prev) => prev.filter((l) => l.id !== lead.id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setConfirmDeleteLead(null);
        setIsError(false);
        setActionMessage(`Purged reservation: ${lead.email}`);
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        setIsError(true);
        setActionMessage(json.error || 'Failed to delete clearance reservation');
      }
    } catch (err: any) {
      setIsError(true);
      setActionMessage(err?.message || 'Network error during reservation deletion');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleResendConfirmation(lead: ClearanceLeadRecord) {
    setResendingId(lead.id);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
      const res = await fetch('/api/northpole/leads', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-admin-token': token } : {}),
        },
        body: JSON.stringify({ action: 'resend_confirmation', id: lead.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setIsError(false);
        setActionMessage(json.message || `Confirmation email dispatched to ${lead.email}`);
        setTimeout(() => setActionMessage(null), 4500);
      } else {
        setIsError(true);
        setActionMessage(json.error || 'Email dispatch failed');
      }
    } catch (err: any) {
      setIsError(true);
      setActionMessage(err?.message || 'Failed to trigger confirmation email');
    } finally {
      setResendingId(null);
    }
  }

  async function handleApproveLead(lead: ClearanceLeadRecord) {
    setApprovingId(lead.id);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
      const res = await fetch('/api/northpole/leads', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-admin-token': token } : {}),
        },
        body: JSON.stringify({ action: 'approve', id: lead.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, status: 'APPROVED', inviteCode: json.inviteCode } : l))
        );
        setIsError(false);
        setActionMessage(json.message || `Alpha clearance granted! Activation cipher ${json.inviteCode} dispatched to ${lead.email}`);
        setTimeout(() => setActionMessage(null), 6000);
      } else {
        setIsError(true);
        setActionMessage(json.error || 'Failed to approve clearance lead');
      }
    } catch (err: any) {
      setIsError(true);
      setActionMessage(err?.message || 'Network error during clearance approval');
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-kk-border">
        <div>
          <h1 className="text-2xl font-black text-kk-heading flex items-center gap-2">
            <span>🎟️ Clearance Queue & Reservations</span>
          </h1>
          <p className="text-xs text-kk-muted font-mono mt-1">
            Real-time management of operatives on the early-access waitlist and launch reservation roster.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-kk-surface border border-kk-border px-3 py-1.5 rounded-xl font-mono text-xs text-kk-ink">
          <span className="text-kk-brand font-bold">{totalCount}</span> Total Reservations
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono flex items-center justify-between transition-all shadow-lg ${
            isError
              ? 'bg-kk-danger-soft border-kk-danger/40 text-kk-on-danger-soft'
              : 'bg-kk-success border-kk-on-success/30 text-kk-on-success'
          }`}
        >
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="opacity-70 hover:opacity-100 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Search & Filter HUD */}
      <div className="flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Search by email, name, or source..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-kk-surface border border-kk-border focus:border-kk-focus rounded-xl px-4 py-2.5 text-xs text-kk-ink focus:outline-none font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-kk-primary hover:bg-kk-primary-hover text-kk-on-primary rounded-xl text-xs font-mono font-bold transition shadow-md"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-1.5 bg-kk-surface border border-kk-border p-1 rounded-xl text-xs font-mono">
          {['ALL', 'PENDING', 'APPROVED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition text-[11px] ${
                statusFilter === st
                  ? 'bg-kk-surface text-kk-ink font-bold shadow'
                  : 'text-kk-muted hover:text-kk-ink'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-kk-surface/60 border border-kk-border rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
        {loading ? (
          <div className="py-20 text-center text-kk-muted font-mono text-xs flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-kk-danger/40 border-t-transparent animate-spin" />
            <span>Scanning Clearance Waitlist...</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center text-kk-muted font-mono text-xs space-y-2">
            <div className="text-3xl">📭</div>
            <p className="text-kk-ink font-bold">No clearance reservations match your query.</p>
            <p className="text-kk-muted">Waitlist signups from the coming-soon page appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-kk-inset/80 border-b border-kk-border text-kk-muted uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Operative / Email</th>
                  <th className="py-3 px-4">Source Channel</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Pre-Launch Cipher</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kk-border text-kk-ink">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-kk-inset transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-kk-ink text-xs">{lead.email}</div>
                      {lead.name && <div className="text-[11px] text-kk-muted mt-0.5">Operative: {lead.name}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block bg-kk-surface text-kk-accent border border-kk-border-strong px-2 py-0.5 rounded text-[10px]">
                        {lead.source}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                          lead.status === 'APPROVED'
                            ? 'bg-kk-success text-kk-on-success border-kk-on-success/30'
                            : lead.status === 'PENDING'
                            ? 'bg-kk-warning text-kk-on-warning border-kk-border-strong'
                            : 'bg-kk-surface text-kk-muted border-kk-border'
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {lead.inviteCode ? (
                        <div className="flex items-center gap-1.5">
                          <code className="text-kk-on-success bg-kk-success border border-kk-on-success/30 px-2 py-0.5 rounded text-[11px] font-bold select-all">
                            {lead.inviteCode}
                          </code>
                        </div>
                      ) : (
                        <span className="text-kk-muted text-[10px] italic">Awaiting Approval</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-kk-muted text-[11px]">
                      {new Date(lead.createdAt).toLocaleDateString()}{' '}
                      <span className="text-kk-muted text-[10px]">{new Date(lead.createdAt).toLocaleTimeString()}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleApproveLead(lead)}
                        disabled={approvingId === lead.id}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition disabled:opacity-50 font-bold border ${
                          lead.status === 'APPROVED'
                            ? 'bg-kk-surface hover:border-kk-border-strong text-kk-brand border-kk-on-success/30'
                            : 'bg-kk-success hover:brightness-95 text-kk-on-success border-kk-on-success/30 shadow-sm'
                        }`}
                        title={lead.status === 'APPROVED' ? 'Regenerate cipher & re-dispatch approval email' : 'Approve clearance & dispatch activation cipher'}
                      >
                        {approvingId === lead.id
                          ? 'Generating...'
                          : lead.status === 'APPROVED'
                          ? '🔄 Re-Approve'
                          : '✓ Approve Alpha'}
                      </button>
                      <button
                        onClick={() => handleResendConfirmation(lead)}
                        disabled={resendingId === lead.id}
                        className="px-2.5 py-1 bg-kk-surface hover:border-kk-border-strong text-kk-accent border border-kk-border-strong rounded-lg text-[11px] font-mono transition disabled:opacity-50"
                        title="Re-dispatch confirmation briefing"
                      >
                        {resendingId === lead.id ? 'Sending...' : '✉️ Resend'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteLead(lead)}
                        disabled={deletingId === lead.id}
                        className="px-2.5 py-1 bg-kk-danger-soft hover:brightness-95 text-kk-on-danger-soft border border-kk-danger/40 rounded-lg text-[11px] font-mono transition disabled:opacity-50"
                        title="Purge reservation record"
                      >
                        {deletingId === lead.id ? 'Deleting...' : '🗑️ Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-kk-surface border border-kk-danger/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-kk-danger">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-bold text-base text-kk-heading">Purge Clearance Reservation?</h3>
            </div>
            <p className="text-xs text-kk-ink font-mono leading-relaxed">
              Are you sure you want to permanently delete the reservation for:
              <br />
              <strong className="text-kk-ink text-sm block mt-1">{confirmDeleteLead.email}</strong>
            </p>
            <p className="text-[11px] text-kk-muted font-mono">
              This action cannot be undone. The operative will be removed from the waitlist launch queue.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteLead(null)}
                className="px-4 py-2 bg-kk-surface hover:border-kk-border-strong text-kk-ink rounded-xl text-xs font-mono font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLead(confirmDeleteLead)}
                disabled={deletingId === confirmDeleteLead.id}
                className="px-4 py-2 bg-kk-primary hover:bg-kk-primary-hover text-kk-on-primary rounded-xl text-xs font-mono font-bold transition shadow-lg disabled:opacity-50"
              >
                {deletingId === confirmDeleteLead.id ? 'Purging...' : 'Confirm Purge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
