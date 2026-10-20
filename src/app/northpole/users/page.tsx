'use client';

import { ADMIN_TOKEN_KEY } from '@/lib/constants/auth';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  demerits: number;
  accountStatus: string;
  isWorkshop: boolean;
  createdAt: string;
  organizedCount: number;
  joinedCount: number;
  wishlistsCount: number;
}

export default function NorthPoleUsersPage() {
  const searchParams = useSearchParams();
  const initialWorkshopFilter = searchParams.get('workshop') === 'true';

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [workshopOnly, setWorkshopOnly] = useState(initialWorkshopFilter);
  // Workshop controls are self-hosted only (SaaS physically excludes /workshop). Hidden until the edition is known.
  const [isSelfHosted, setIsSelfHosted] = useState(false);
  useEffect(() => {
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setIsSelfHosted(json?.edition === 'selfhosted'))
      .catch(() => {});
  }, []);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleLookup(query = searchQuery, isWorkshop = workshopOnly, retryCount = 0) {
    const trimmed = query.trim();
    if (!trimmed && !isWorkshop) {
      setUsers([]);
      setHasSearched(true);
      return;
    }

    if (retryCount === 0) setLoading(true);
    try {
      let url = `/api/northpole/users?q=${encodeURIComponent(trimmed)}`;
      if (isWorkshop) {
        url += '&workshop=true';
      }
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
      const res = await fetch(url, {
        credentials: 'include',
        headers: token ? { 'x-admin-token': token } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setUsers(json.users || []);
        if (json.totalCount !== undefined) setTotalCount(json.totalCount);
        setHasSearched(true);
        setLoading(false);
        return;
      }
      if (retryCount < 2) {
        setTimeout(() => handleLookup(query, isWorkshop, retryCount + 1), 600 * (retryCount + 1));
        return;
      }
    } catch (error) {
      console.error('Failed to lookup user:', error);
      if (retryCount < 2) {
        setTimeout(() => handleLookup(query, isWorkshop, retryCount + 1), 600 * (retryCount + 1));
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
    handleLookup(searchQuery, workshopOnly);
  }

  function handleToggleWorkshopFilter() {
    const nextVal = !workshopOnly;
    setWorkshopOnly(nextVal);
    handleLookup(searchQuery, nextVal);
  }

  async function handleUpdateUser(userId: string, patchData: Record<string, any>) {
    setUpdatingId(userId);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
      const res = await fetch('/api/northpole/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-admin-token': token } : {}),
        },
        body: JSON.stringify({ userId, ...patchData }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.user) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  demerits: json.user.demerits ?? u.demerits,
                  accountStatus: json.user.accountStatus ?? u.accountStatus,
                  isWorkshop: json.user.isWorkshop ?? u.isWorkshop,
                }
              : u
          )
        );
        setActionMessage(`Operative record updated: ${json.user.name || json.user.email}`);
        setTimeout(() => setActionMessage(null), 3500);
      } else {
        alert(json.error || 'Failed to update operative');
      }
    } catch (err: any) {
      alert(err?.message || 'Network error updating operative');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-kk-border">
        <div>
          <h1 className="text-2xl font-black text-kk-heading flex items-center gap-2">
            <span>👥 Operative Lookup & Security Roster</span>
          </h1>
          <p className="text-xs text-kk-muted font-mono mt-1">
            Lookup-first operative inspector for real-time clearance tags, Coal Citations, and standing modifications.
          </p>
        </div>
        {totalCount > 0 && (
          <div className="bg-kk-surface border border-kk-border px-3 py-1.5 rounded-xl font-mono text-xs text-kk-ink">
            <span className="text-kk-brand font-bold">{totalCount}</span> Total Registered Operatives
          </div>
        )}
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div className="p-4 rounded-xl border bg-kk-success border-kk-on-success/30 text-kk-on-success text-xs font-mono flex items-center justify-between shadow-lg">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="opacity-70 hover:opacity-100 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* On-Demand Lookup HUD */}
      <div className="bg-kk-surface/80 border border-kk-border p-5 rounded-2xl space-y-4 shadow-xl">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by exact User ID, email, name, or mission codename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-kk-inset border border-kk-border focus:border-kk-focus rounded-xl pl-4 pr-10 py-3 text-xs text-kk-ink focus:outline-none font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setUsers([]);
                  setHasSearched(false);
                }}
                className="absolute right-3 top-3 text-kk-muted hover:text-kk-ink text-xs font-mono"
              >
                ✕
              </button>
            )}
          </div>
          {isSelfHosted && (
            <button
              type="button"
              onClick={handleToggleWorkshopFilter}
              className={`px-4 py-3 rounded-xl border text-xs font-mono transition flex items-center gap-2 ${
                workshopOnly
                  ? 'bg-kk-warning border-kk-border-strong text-kk-on-warning font-bold'
                  : 'bg-kk-inset border-kk-border text-kk-muted hover:text-kk-ink'
              }`}
            >
              <span>🛠️ Workshop Only</span>
              {workshopOnly && <span className="text-kk-gold-ink font-bold">●</span>}
            </button>
          )}
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
              <span>🔍 Lookup Record</span>
            )}
          </button>
        </form>
      </div>

      {/* Results / Inspector Section */}
      {loading ? (
        <div className="py-20 text-center text-kk-muted font-mono text-xs flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-kk-danger/40 border-t-transparent animate-spin" />
          <span>Querying Operative Database...</span>
        </div>
      ) : !hasSearched ? (
        <div className="py-16 text-center text-kk-muted font-mono text-xs border border-dashed border-kk-border rounded-2xl space-y-2">
          <div className="text-3xl">🔎</div>
          <p className="text-kk-muted font-bold">Lookup Console Idle</p>
          <p className="text-kk-muted max-w-md mx-auto">
            Zero initial DB payload. Enter a User ID, email, mission codename, or toggle filters above to inspect records on demand.
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center text-kk-muted font-mono text-xs border border-kk-border rounded-2xl space-y-2 bg-kk-surface/40">
          <div className="text-3xl">📭</div>
          <p className="text-kk-ink font-bold">No operative records matched your lookup.</p>
          <p className="text-kk-muted">Verify the ID or search term and try again.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-mono text-kk-muted flex items-center justify-between">
            <span>Found {users.length} Matching Operative{users.length > 1 ? 's' : ''}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="bg-kk-surface border border-kk-border rounded-2xl p-5 space-y-4 shadow-xl hover:border-kk-border-strong transition"
              >
                {/* Operative Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-kk-heading text-base flex items-center gap-2">
                      <span>{user.name || 'Anonymous Operative'}</span>
                      {user.isWorkshop && (
                        <span className="text-[10px] bg-kk-warning text-kk-on-warning border border-kk-border-strong px-1.5 py-0.5 rounded font-mono">
                          WORKSHOP
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-kk-accent font-mono mt-0.5">{user.email}</p>
                    <p className="text-[10px] text-kk-muted font-mono mt-0.5">ID: {user.id}</p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold border ${
                      user.accountStatus === 'ACTIVE'
                        ? 'bg-kk-success text-kk-on-success border-kk-on-success/30'
                        : user.accountStatus === 'REMOTE_RESTRICTED'
                        ? 'bg-kk-warning text-kk-on-warning border-kk-border-strong'
                        : 'bg-kk-danger-soft text-kk-on-danger-soft border-kk-danger/40'
                    }`}
                  >
                    {user.accountStatus}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 bg-kk-inset/80 p-3 rounded-xl border border-kk-border text-center font-mono">
                  <div>
                    <span className="text-[10px] text-kk-muted block">Coal Citations</span>
                    <span
                      className={`text-xs font-bold ${
                        user.demerits > 0 ? 'text-kk-danger' : 'text-kk-brand'
                      }`}
                    >
                      {user.demerits}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-kk-muted block">Operations</span>
                    <span className="text-xs text-kk-ink font-bold">
                      {user.organizedCount + user.joinedCount}
                    </span>
                  </div>
                </div>

                {/* Live Modification Controls */}
                <div className="pt-2 border-t border-kk-border flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  {/* Workshop Toggle (self-hosted only) */}
                  {isSelfHosted && (
                    <button
                      onClick={() => handleUpdateUser(user.id, { isWorkshop: !user.isWorkshop })}
                      disabled={updatingId === user.id}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] transition ${
                        user.isWorkshop
                          ? 'bg-kk-warning border-kk-border-strong text-kk-on-warning hover:brightness-95'
                          : 'bg-kk-surface border-kk-border text-kk-ink hover:border-kk-border-strong'
                      }`}
                    >
                      {user.isWorkshop ? 'Revoke Workshop' : 'Grant Workshop'}
                    </button>
                  )}

                  {/* Penalty Points Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        handleUpdateUser(user.id, { penaltyPoints: Math.max(0, user.demerits - 1) })
                      }
                      disabled={updatingId === user.id || user.demerits <= 0}
                      className="px-2 py-1 bg-kk-success hover:brightness-95 text-kk-on-success border border-kk-on-success/30 rounded text-[10px] disabled:opacity-30"
                      title="Forgive 1 Coal Citation"
                    >
                      -1 Coal
                    </button>
                    <button
                      onClick={() => handleUpdateUser(user.id, { penaltyPoints: user.demerits + 1 })}
                      disabled={updatingId === user.id}
                      className="px-2 py-1 bg-kk-danger-soft hover:brightness-95 text-kk-on-danger-soft border border-kk-danger/40 rounded text-[10px] disabled:opacity-30"
                      title="Issue 1 Coal Citation"
                    >
                      +1 Coal
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
