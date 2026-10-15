'use client';

import { ADMIN_TOKEN_KEY } from '@/lib/constants/auth';

import { useState } from 'react';
import Link from 'next/link';

interface OperationRecord {
  id: string;
  title: string;
  code: string;
  status: string;
  giftingType: string;
  isWhiteElephant: boolean;
  isLocalOnly: boolean;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  inviteCutoffDate?: string | null;
  assignmentDate?: string | null;
  shippingDate?: string | null;
  executionDate?: string | null;
  organizer: {
    id: string;
    name: string;
    email: string;
    codename?: string;
  };
  membersCount: number;
  rulesCount: number;
  messagesCount: number;
  reportsCount: number;
  createdAt: string;
}

export default function NorthPoleOperationsPage() {
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  async function handleLookup(query = searchQuery, retryCount = 0) {
    const trimmed = query.trim();
    if (!trimmed) {
      setOperations([]);
      setHasSearched(true);
      return;
    }

    if (retryCount === 0) setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
      const res = await fetch(`/api/northpole/operations?q=${encodeURIComponent(trimmed)}`, {
        credentials: 'include',
        headers: token ? { 'x-admin-token': token } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setOperations(json.operations || []);
        if (json.totalCount !== undefined) setTotalCount(json.totalCount);
        setHasSearched(true);
        setLoading(false);
        return;
      }
      if (retryCount < 2) {
        setTimeout(() => handleLookup(query, retryCount + 1), 600 * (retryCount + 1));
        return;
      }
    } catch (error) {
      console.error('Failed to lookup operations:', error);
      if (retryCount < 2) {
        setTimeout(() => handleLookup(query, retryCount + 1), 600 * (retryCount + 1));
        return;
      }
    } finally {
      if (retryCount >= 2) {
        setLoading(false);
        setHasSearched(true);
      }
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleLookup(searchQuery);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-kk-border">
        <div>
          <h1 className="text-2xl font-black text-kk-heading flex items-center gap-2">
            <span>🎯 Platform Operations Oversight</span>
          </h1>
          <p className="text-xs text-kk-muted font-mono mt-1">
            Lookup-first operation inspector for global monitoring of Secret Santa and White Elephant holiday missions.
          </p>
        </div>
        {totalCount > 0 && (
          <div className="bg-kk-surface border border-kk-border px-3 py-1.5 rounded-xl font-mono text-xs text-kk-ink">
            <span className="text-kk-brand font-bold">{totalCount}</span> Total Operations
          </div>
        )}
      </div>

      {/* On-Demand Lookup HUD */}
      <div className="bg-kk-surface/80 border border-kk-border p-5 rounded-2xl space-y-4 shadow-xl">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by Operation Code (e.g. KOVERT-87WZ), title, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-kk-inset border border-kk-border focus:border-kk-focus rounded-xl pl-4 pr-10 py-3 text-xs text-kk-ink focus:outline-none font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setOperations([]);
                  setHasSearched(false);
                }}
                className="absolute right-3 top-3 text-kk-muted hover:text-kk-ink text-xs font-mono"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-kk-primary hover:bg-kk-primary-hover text-kk-on-primary rounded-xl text-xs font-mono font-bold transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <span>🔍 Lookup Operation</span>
            )}
          </button>
        </form>
      </div>

      {/* Results / Inspector Section */}
      {loading ? (
        <div className="py-20 text-center text-kk-muted font-mono text-xs flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-kk-danger/40 border-t-transparent animate-spin" />
          <span>Querying Operations Database...</span>
        </div>
      ) : !hasSearched ? (
        <div className="py-16 text-center text-kk-muted font-mono text-xs border border-dashed border-kk-border rounded-2xl space-y-2">
          <div className="text-3xl">🔎</div>
          <p className="text-kk-muted font-bold">Operation Lookup Console Idle</p>
          <p className="text-kk-muted max-w-md mx-auto">
            Zero initial DB payload. Enter an Operation Code or Title above to inspect mission parameters and status.
          </p>
        </div>
      ) : operations.length === 0 ? (
        <div className="py-16 text-center text-kk-muted font-mono text-xs border border-kk-border rounded-2xl space-y-2 bg-kk-surface/40">
          <div className="text-3xl">📭</div>
          <p className="text-kk-ink font-bold">No operations matched your lookup.</p>
          <p className="text-kk-muted">Verify the code or title and try again.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-mono text-kk-muted">
            Found {operations.length} Matching Operation{operations.length > 1 ? 's' : ''}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {operations.map((op) => (
              <div
                key={op.id}
                className="bg-kk-surface border border-kk-border rounded-2xl p-5 space-y-4 shadow-xl hover:border-kk-border-strong transition"
              >
                {/* Operation Title & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-kk-heading text-base flex items-center gap-2">
                      <span>{op.title}</span>
                      {op.isWhiteElephant && (
                        <span className="text-[10px] bg-kk-inset text-kk-accent border border-kk-border-strong px-1.5 py-0.5 rounded font-mono">
                          WHITE ELEPHANT
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-kk-on-danger-soft font-mono font-bold bg-kk-danger-soft px-2 py-0.5 rounded border border-kk-danger/40">
                        {op.code}
                      </span>
                      <span className="text-[11px] text-kk-muted font-mono">
                        by {op.organizer?.name || op.organizer?.email}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold border ${
                      op.status === 'COMPLETED'
                        ? 'bg-kk-success text-kk-on-success border-kk-on-success/30'
                        : op.status === 'RECRUITING'
                        ? 'bg-kk-inset text-kk-accent border-kk-border-strong'
                        : 'bg-kk-warning text-kk-on-warning border-kk-border-strong'
                    }`}
                  >
                    {op.status}
                  </span>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-4 gap-2 bg-kk-inset/80 p-3 rounded-xl border border-kk-border text-center font-mono">
                  <div>
                    <span className="text-[10px] text-kk-muted block">Operatives</span>
                    <span className="text-xs text-kk-ink font-bold">{op.membersCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-kk-muted block">Exclusions</span>
                    <span className="text-xs text-kk-ink font-bold">{op.rulesCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-kk-muted block">Reports</span>
                    <span className="text-xs text-kk-ink font-bold">{op.reportsCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-kk-muted block">Budget</span>
                    <span className="text-xs text-kk-brand font-bold">
                      {op.budgetMin > 0 ? `$${op.budgetMin}-$${op.budgetMax}` : `$${op.budgetMax}`}
                    </span>
                  </div>
                </div>

                {/* Timeline Dates */}
                <div className="text-[11px] font-mono text-kk-muted space-y-1 bg-kk-inset/40 p-2.5 rounded-lg border border-kk-border">
                  <div className="flex justify-between">
                    <span>Recruitment Cutoff:</span>
                    <span className="text-kk-ink">
                      {op.inviteCutoffDate ? new Date(op.inviteCutoffDate).toLocaleDateString() : 'Unset'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Draw Day:</span>
                    <span className="text-kk-ink">
                      {op.assignmentDate ? new Date(op.assignmentDate).toLocaleDateString() : 'Unset'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exchange Event:</span>
                    <span className="text-kk-ink">
                      {op.executionDate ? new Date(op.executionDate).toLocaleDateString() : 'Unset'}
                    </span>
                  </div>
                </div>

                {/* Direct Action Link */}
                <div className="pt-2 border-t border-kk-border flex items-center justify-between text-xs font-mono">
                  <span className="text-kk-muted text-[10px]">
                    Created {new Date(op.createdAt).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/exchange/${op.code}`}
                    target="_blank"
                    className="px-3 py-1.5 bg-kk-surface hover:border-kk-border-strong text-kk-accent border border-kk-border-strong rounded-lg text-[11px] transition flex items-center gap-1"
                  >
                    <span>Launch Command Center</span>
                    <span>↗</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
