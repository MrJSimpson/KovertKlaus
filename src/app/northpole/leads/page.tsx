'use client';

import { useState, useEffect } from 'react';

interface ClearanceLeadRecord {
  id: string;
  email: string;
  name?: string | null;
  source: string;
  status: string;
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
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

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>🎟️ Clearance Queue & Reservations</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Real-time management of operatives on the early-access waitlist and launch reservation roster.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs text-slate-300">
          <span className="text-emerald-400 font-bold">{totalCount}</span> Total Reservations
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono flex items-center justify-between transition-all shadow-lg ${
            isError
              ? 'bg-red-950/80 border-red-500/50 text-red-200'
              : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
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
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-mono font-bold transition shadow-md"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-mono">
          {['ALL', 'PENDING', 'APPROVED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition text-[11px] ${
                statusFilter === st
                  ? 'bg-slate-800 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
            <span>Scanning Clearance Waitlist...</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-mono text-xs space-y-2">
            <div className="text-3xl">📭</div>
            <p className="text-slate-300 font-bold">No clearance reservations match your query.</p>
            <p className="text-slate-500">Waitlist signups from the coming-soon page appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Operative / Email</th>
                  <th className="py-3 px-4">Source Channel</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-xs">{lead.email}</div>
                      {lead.name && <div className="text-[11px] text-slate-400 mt-0.5">Operative: {lead.name}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block bg-slate-800 text-sky-300 border border-sky-800/40 px-2 py-0.5 rounded text-[10px]">
                        {lead.source}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                          lead.status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-600/40'
                            : lead.status === 'PENDING'
                            ? 'bg-amber-950 text-amber-300 border-amber-600/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(lead.createdAt).toLocaleDateString()}{' '}
                      <span className="text-slate-500 text-[10px]">{new Date(lead.createdAt).toLocaleTimeString()}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleResendConfirmation(lead)}
                        disabled={resendingId === lead.id}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-700/40 rounded-lg text-[11px] font-mono transition disabled:opacity-50"
                        title="Re-dispatch confirmation briefing"
                      >
                        {resendingId === lead.id ? 'Sending...' : '✉️ Resend'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteLead(lead)}
                        disabled={deletingId === lead.id}
                        className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-700/40 rounded-lg text-[11px] font-mono transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-900/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-bold text-base text-white">Purge Clearance Reservation?</h3>
            </div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Are you sure you want to permanently delete the reservation for:
              <br />
              <strong className="text-white text-sm block mt-1">{confirmDeleteLead.email}</strong>
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              This action cannot be undone. The operative will be removed from the waitlist launch queue.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteLead(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLead(confirmDeleteLead)}
                disabled={deletingId === confirmDeleteLead.id}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg disabled:opacity-50"
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
