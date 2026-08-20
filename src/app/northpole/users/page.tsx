'use client';

import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [workshopOnly, setWorkshopOnly] = useState(initialWorkshopFilter);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [workshopOnly]);

  async function fetchUsers(query = searchQuery) {
    setLoading(true);
    try {
      let url = `/api/northpole/users?q=${encodeURIComponent(query)}`;
      if (workshopOnly) {
        url += '&workshop=true';
      }
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.success) {
        setUsers(json.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch user roster:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchUsers(searchQuery);
  }

  async function handleToggleWorkshop(userId: string, currentStatus: boolean) {
    try {
      const res = await fetch('/api/northpole/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isWorkshop: !currentStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isWorkshop: !currentStatus } : u))
        );
        setActionMessage(
          `Security tag updated: ${json.user.name} workshop clearance is now ${!currentStatus ? 'ENABLED' : 'REVOKED'}`
        );
        setTimeout(() => setActionMessage(null), 3500);
      }
    } catch {
      alert('Failed to update workshop tag');
    }
  }

  async function handleDemeritChange(userId: string, newDemerits: number) {
    if (newDemerits < 0) return;
    try {
      const res = await fetch('/api/northpole/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, penaltyPoints: newDemerits }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? { ...u, demerits: json.user.demerits, accountStatus: json.user.accountStatus }
              : u
          )
        );
      }
    } catch {
      alert('Failed to update demerits');
    }
  }

  async function handleStatusChange(userId: string, newStatus: string) {
    try {
      const res = await fetch('/api/northpole/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, accountStatus: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, accountStatus: newStatus } : u))
        );
      }
    } catch {
      alert('Failed to update account status');
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>👥 Operative Roster & Security Governance</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Manage site users, demerit penalty points, account status, and grant hidden <code className="text-amber-400">workshop</code> testing clearance tags.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setWorkshopOnly(!workshopOnly)}
            className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
              workshopOnly
                ? 'bg-amber-950 text-amber-300 border-amber-500/50 shadow-md'
                : 'bg-slate-900 text-gray-300 border-slate-800 hover:text-white'
            }`}
          >
            <span>🧪</span>
            <span>{workshopOnly ? 'Showing Workshop Testers Only' : 'Filter Workshop Testers'}</span>
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold">
          ✓ {actionMessage}
        </div>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-3">
        <input
          type="text"
          placeholder="Search operatives by name, email, or codename..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none font-mono"
        />
        <button
          type="submit"
          className="bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs px-5 py-2.5 rounded-xl transition-colors font-bold cursor-pointer"
        >
          🔍 Search
        </button>
      </form>

      {/* Users Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Operative</th>
                <th className="py-3 px-4">Codename</th>
                <th className="py-3 px-4">Demerits</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Workshop Tag</th>
                <th className="py-3 px-4">Activity</th>
                <th className="py-3 px-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Loading operative records...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No operatives matching search criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    
                    {/* Name & Email */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{user.name}</div>
                      <div className="text-[11px] text-gray-400">{user.email}</div>
                    </td>

                    {/* Codename */}
                    <td className="py-3 px-4 text-emerald-400 font-bold">
                      {user.codename || '—'}
                    </td>

                    {/* Demerits (+ / - controls) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                            user.demerits === 0
                              ? 'bg-emerald-950 text-emerald-300'
                              : user.demerits < 3
                              ? 'bg-amber-950 text-amber-300'
                              : 'bg-red-950 text-red-300'
                          }`}
                        >
                          {user.demerits}/3
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleDemeritChange(user.id, user.demerits + 1)}
                            title="Add Demerit Citation"
                            className="text-[9px] bg-slate-800 hover:bg-red-900 text-gray-300 hover:text-white px-1 rounded cursor-pointer"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleDemeritChange(user.id, Math.max(0, user.demerits - 1))}
                            title="Remove Demerit Waiver"
                            className="text-[9px] bg-slate-800 hover:bg-emerald-900 text-gray-300 hover:text-white px-1 rounded cursor-pointer"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Account Status */}
                    <td className="py-3 px-4">
                      <select
                        value={user.accountStatus}
                        onChange={(e) => handleStatusChange(user.id, e.target.value)}
                        className={`bg-slate-950 border rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none ${
                          user.accountStatus === 'ACTIVE'
                            ? 'border-emerald-500/40 text-emerald-300'
                            : user.accountStatus === 'REMOTE_RESTRICTED'
                            ? 'border-amber-500/40 text-amber-300'
                            : 'border-red-500/40 text-red-300'
                        }`}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="REMOTE_RESTRICTED">RESTRICTED</option>
                        <option value="DISABLED">DISABLED</option>
                      </select>
                    </td>

                    {/* Workshop Security Tag Toggle */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleWorkshop(user.id, user.isWorkshop)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                          user.isWorkshop
                            ? 'bg-amber-950 text-amber-300 border-amber-500/50 shadow-xs'
                            : 'bg-slate-950 text-gray-500 border-slate-800 hover:border-gray-700'
                        }`}
                      >
                        <span>🧪</span>
                        <span>{user.isWorkshop ? 'Workshop Enabled' : 'No Workshop'}</span>
                      </button>
                    </td>

                    {/* Activity */}
                    <td className="py-3 px-4 text-gray-400 text-[11px]">
                      <div>Organized: <strong className="text-white">{user.organizedCount}</strong></div>
                      <div>Joined: <strong className="text-white">{user.joinedCount}</strong></div>
                    </td>

                    {/* Joined At */}
                    <td className="py-3 px-4 text-gray-500 text-[11px]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
