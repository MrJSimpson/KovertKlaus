'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  codename?: string;
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [editingCodenameUser, setEditingCodenameUser] = useState<UserRecord | null>(null);
  const [newCodename, setNewCodename] = useState('');
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
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
                  codename: json.user.codename ?? u.codename,
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
      setEditingCodenameUser(null);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>👥 Operative Lookup & Security Roster</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Lookup-first operative inspector for real-time clearance tags, Coal Citations, and standing modifications.
          </p>
        </div>
        {totalCount > 0 && (
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs text-slate-300">
            <span className="text-emerald-400 font-bold">{totalCount}</span> Total Registered Operatives
          </div>
        )}
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div className="p-4 rounded-xl border bg-emerald-950/80 border-emerald-500/50 text-emerald-200 text-xs font-mono flex items-center justify-between shadow-lg">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="opacity-70 hover:opacity-100 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* On-Demand Lookup HUD */}
      <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by exact User ID, email, codename, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl pl-4 pr-10 py-3 text-xs text-white focus:outline-none font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setUsers([]);
                  setHasSearched(false);
                }}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 text-xs font-mono"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleToggleWorkshopFilter}
            className={`px-4 py-3 rounded-xl border text-xs font-mono transition flex items-center gap-2 ${
              workshopOnly
                ? 'bg-amber-950/60 border-amber-500/60 text-amber-300 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🛠️ Workshop Only</span>
            {workshopOnly && <span className="text-amber-400 font-bold">●</span>}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
        <div className="py-20 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
          <span>Querying Operative Database...</span>
        </div>
      ) : !hasSearched ? (
        <div className="py-16 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-2xl space-y-2">
          <div className="text-3xl">🔎</div>
          <p className="text-slate-400 font-bold">Lookup Console Idle</p>
          <p className="text-slate-600 max-w-md mx-auto">
            Zero initial DB payload. Enter a User ID, email, codename, or toggle filters above to inspect records on demand.
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center text-slate-400 font-mono text-xs border border-slate-800/80 rounded-2xl space-y-2 bg-slate-900/40">
          <div className="text-3xl">📭</div>
          <p className="text-slate-300 font-bold">No operative records matched your lookup.</p>
          <p className="text-slate-500">Verify the ID or search term and try again.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>Found {users.length} Matching Operative{users.length > 1 ? 's' : ''}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl hover:border-slate-700 transition"
              >
                {/* Operative Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <span>{user.name || 'Anonymous Operative'}</span>
                      {user.isWorkshop && (
                        <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-600/40 px-1.5 py-0.5 rounded font-mono">
                          WORKSHOP
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-sky-400 font-mono mt-0.5">{user.email}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {user.id}</p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold border ${
                      user.accountStatus === 'ACTIVE'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600/40'
                        : user.accountStatus === 'REMOTE_RESTRICTED'
                        ? 'bg-amber-950 text-amber-300 border-amber-600/40'
                        : 'bg-red-950 text-red-300 border-red-600/40'
                    }`}
                  >
                    {user.accountStatus}
                  </span>
                </div>

                {/* Codename & Metrics */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-center font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Codename</span>
                    <span className="text-xs text-slate-200 font-bold truncate block">
                      {user.codename || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Coal Citations</span>
                    <span
                      className={`text-xs font-bold ${
                        user.demerits > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {user.demerits}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Operations</span>
                    <span className="text-xs text-slate-200 font-bold">
                      {user.organizedCount + user.joinedCount}
                    </span>
                  </div>
                </div>

                {/* Live Modification Controls */}
                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  {/* Workshop Toggle */}
                  <button
                    onClick={() => handleUpdateUser(user.id, { isWorkshop: !user.isWorkshop })}
                    disabled={updatingId === user.id}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] transition ${
                      user.isWorkshop
                        ? 'bg-amber-950/60 border-amber-600/50 text-amber-300 hover:bg-amber-900'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {user.isWorkshop ? 'Revoke Workshop' : 'Grant Workshop'}
                  </button>

                  {/* Penalty Points Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        handleUpdateUser(user.id, { penaltyPoints: Math.max(0, user.demerits - 1) })
                      }
                      disabled={updatingId === user.id || user.demerits <= 0}
                      className="px-2 py-1 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/40 rounded text-[10px] disabled:opacity-30"
                      title="Forgive 1 Coal Citation"
                    >
                      -1 Coal
                    </button>
                    <button
                      onClick={() => handleUpdateUser(user.id, { penaltyPoints: user.demerits + 1 })}
                      disabled={updatingId === user.id}
                      className="px-2 py-1 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-700/40 rounded text-[10px] disabled:opacity-30"
                      title="Issue 1 Coal Citation"
                    >
                      +1 Coal
                    </button>
                  </div>

                  {/* Edit Codename */}
                  <button
                    onClick={() => {
                      setEditingCodenameUser(user);
                      setNewCodename(user.codename || '');
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-700/40 rounded-lg text-[11px]"
                  >
                    ✏️ Codename
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Codename Modal */}
      {editingCodenameUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white">Modify Operative Codename</h3>
            <p className="text-xs text-slate-400 font-mono">
              Update callsign for operative: <strong className="text-white">{editingCodenameUser.email}</strong>
            </p>
            <input
              type="text"
              placeholder="e.g. Agent-Klaus, Chewbacca, Frosty..."
              value={newCodename}
              onChange={(e) => setNewCodename(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none font-mono"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingCodenameUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateUser(editingCodenameUser.id, { codename: newCodename.trim() })}
                disabled={updatingId === editingCodenameUser.id}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg disabled:opacity-50"
              >
                {updatingId === editingCodenameUser.id ? 'Saving...' : 'Save Codename'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
