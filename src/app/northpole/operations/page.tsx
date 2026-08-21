'use client';

import { useState, useEffect } from 'react';
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
  executionDate: string;
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchOperations();
  }, []);

  async function fetchOperations(query = searchQuery, retryCount = 0) {
    if (retryCount === 0) setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('kovertklaus_admin_token') : null;
      const res = await fetch(`/api/northpole/operations?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
        headers: token ? { 'x-admin-token': token } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setOperations(json.operations || []);
        setLoading(false);
        return;
      }
      if (retryCount < 2) {
        setTimeout(() => fetchOperations(query, retryCount + 1), 600 * (retryCount + 1));
        return;
      }
    } catch (error) {
      console.error('Failed to load operations:', error);
      if (retryCount < 2) {
        setTimeout(() => fetchOperations(query, retryCount + 1), 600 * (retryCount + 1));
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
    fetchOperations(searchQuery);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>🎯 Platform Operations Oversight</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Global monitoring of all Secret Santa and White Elephant gift exchanges across the platform.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-3">
        <input
          type="text"
          placeholder="Search operations by title or code..."
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

      {/* Operations Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Operation Code / Title</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Phase Status</th>
                <th className="py-3 px-4">OpsLeader</th>
                <th className="py-3 px-4">Roster</th>
                <th className="py-3 px-4">Budget</th>
                <th className="py-3 px-4">Exchange Day</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    Loading operations...
                  </td>
                </tr>
              ) : operations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    No operations found.
                  </td>
                </tr>
              ) : (
                operations.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-800/40 transition-colors">
                    
                    {/* Title & Code */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{op.title}</span>
                      </div>
                      <div className="text-[11px] text-emerald-400 font-bold">
                        CODE: {op.code}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        op.isWhiteElephant
                          ? 'bg-purple-950 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {op.isWhiteElephant ? '🐘 White Elephant' : '🎁 Secret Santa'}
                      </span>
                    </td>

                    {/* Phase Status */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded text-[10px] border border-amber-500/30">
                        {op.status}
                      </span>
                    </td>

                    {/* OpsLeader */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{op.organizer.name}</div>
                      <div className="text-[10px] text-gray-500">{op.organizer.email}</div>
                    </td>

                    {/* Roster Counts */}
                    <td className="py-3 px-4 text-gray-300">
                      <div>Agents: <strong className="text-white">{op.membersCount}</strong></div>
                      <div className="text-[10px] text-gray-500">Rules: {op.rulesCount}</div>
                    </td>

                    {/* Budget */}
                    <td className="py-3 px-4 text-amber-400 font-bold">
                      ${op.budgetMin} – ${op.budgetMax} {op.currency}
                    </td>

                    {/* Exchange Day */}
                    <td className="py-3 px-4 text-gray-400">
                      {new Date(op.executionDate).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <Link
                        href={`/exchange/${op.code}`}
                        target="_blank"
                        className="text-xs text-sky-400 hover:text-sky-300 hover:underline font-bold"
                      >
                        Inspect →
                      </Link>
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
