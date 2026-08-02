'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCodename, formatDateString } from '@/lib/security';

interface OperationItem {
  id: string;
  role: string;
  mission: {
    id: string;
    title: string;
    code: string;
    description?: string;
    status: string;
    isWhiteElephant: boolean;
    budgetMin?: number;
    budgetMax: number;
    currency: string;
    inviteCutoffDate: string;
    assignmentDate: string;
    shippingDate?: string;
    executionDate: string;
    opsLeader: {
      id: string;
      name: string;
      codename?: string;
    };
  };
}

export default function OperationCenterPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [operations, setOperations] = useState<OperationItem[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OPS_LEADER' | 'AGENT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RECRUITING' | 'ASSIGNED' | 'COMPLETED'>('ALL');

  useEffect(() => {
    fetchOperations();
  }, []);

  async function fetchOperations() {
    setLoading(true);
    const userId = localStorage.getItem('kovertklaus_user_id');
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/operations?userId=${userId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mapped = json.data.map((op: any) => {
          const userAgent = op.agents?.find((a: any) => a.userId === userId);
          return {
            id: op.id,
            role: userAgent?.role || (op.opsLeaderId === userId ? 'OPS_LEADER' : 'AGENT'),
            mission: op,
          };
        });
        setOperations(mapped);
      }
    } catch {
      console.error('Failed to load operations');
    } finally {
      setLoading(false);
    }
  }

  // Filter Operations List
  const filteredOperations = operations.filter((item) => {
    const titleMatch = item.mission.title.toLowerCase().includes(searchQuery.toLowerCase());
    const codeMatch = item.mission.code.toLowerCase().includes(searchQuery.toLowerCase());
    const roleMatch = roleFilter === 'ALL' || item.role === roleFilter;
    const statusMatch = statusFilter === 'ALL' || item.mission.status === statusFilter;
    return (titleMatch || codeMatch) && roleMatch && statusMatch;
  });

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${
      isDarkMode
        ? 'bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950'
        : 'bg-stone-50 text-slate-900 selection:bg-red-600 selection:text-white'
    }`}>
      
      {/* Navigation Header */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md ${
        isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-stone-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-white text-xl shadow-md ${
              isDarkMode ? 'bg-gradient-to-br from-sky-400 to-slate-700' : 'bg-gradient-to-br from-red-600 to-emerald-800'
            }`}>
              🎁
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block">KovertKlaus</span>
              <span className={`text-xs font-bold ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>
                Operation Center (Exchanges Workspace)
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isDarkMode ? 'bg-slate-900 border-slate-700 text-sky-300' : 'bg-stone-100 border-stone-300 text-slate-700'
              }`}
            >
              {isDarkMode ? '🎄 Light' : '❄️ Dark (Icy)'}
            </button>

            <Link
              href="/dashboard"
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${
                isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
        
        {/* Banner */}
        <div className={`p-8 rounded-3xl border shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                isDarkMode ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-emerald-100 text-emerald-900'
              }`}>
                🗺️ Operation Control Center
              </span>
              <span className="text-xs text-slate-500">Active Operations & Secret Santa Exchanges</span>
            </div>
            <h1 className="text-3xl font-black">Operation Center Dashboard</h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Manage your active Secret Santa and White Elephant gift exchanges. Track participant enrollment, target assignments, and gift shipping deadlines in real time.
            </p>
          </div>

          <Link
            href="/dashboard"
            className={`px-6 py-3.5 rounded-2xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${
              isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            <span>+ New Exchange</span>
          </Link>
        </div>

        {/* Filter Controls Bar */}
        <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
        }`}>
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by operation name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:ring-sky-400' : 'bg-stone-50 border-stone-300 text-slate-900 focus:ring-red-600'
              }`}
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto text-xs font-semibold">
            {/* Role Filter */}
            <div className="flex items-center gap-1 bg-stone-100 dark:bg-slate-950 p-1 rounded-xl border border-stone-200 dark:border-slate-800">
              <button
                onClick={() => setRoleFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition-all ${roleFilter === 'ALL' ? (isDarkMode ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-red-600 text-white font-bold') : 'text-slate-500'}`}
              >
                All Roles
              </button>
              <button
                onClick={() => setRoleFilter('OPS_LEADER')}
                className={`px-3 py-1 rounded-lg transition-all ${roleFilter === 'OPS_LEADER' ? (isDarkMode ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-red-600 text-white font-bold') : 'text-slate-500'}`}
              >
                OpsLeader
              </button>
              <button
                onClick={() => setRoleFilter('AGENT')}
                className={`px-3 py-1 rounded-lg transition-all ${roleFilter === 'AGENT' ? (isDarkMode ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-red-600 text-white font-bold') : 'text-slate-500'}`}
              >
                Agent
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-stone-100 dark:bg-slate-950 p-1 rounded-xl border border-stone-200 dark:border-slate-800">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'ALL' ? (isDarkMode ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-red-600 text-white font-bold') : 'text-slate-500'}`}
              >
                All Statuses
              </button>
              <button
                onClick={() => setStatusFilter('RECRUITING')}
                className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'RECRUITING' ? (isDarkMode ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-red-600 text-white font-bold') : 'text-slate-500'}`}
              >
                Recruiting
              </button>
              <button
                onClick={() => setStatusFilter('ASSIGNED')}
                className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'ASSIGNED' ? (isDarkMode ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-red-600 text-white font-bold') : 'text-slate-500'}`}
              >
                Assigned
              </button>
            </div>
          </div>
        </div>

        {/* Operations Directory Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-4xl animate-bounce mb-3">🎁</div>
            <p className="text-sm font-semibold">Loading Operations Directory Stream...</p>
          </div>
        ) : filteredOperations.length === 0 ? (
          <div className={`p-12 text-center rounded-3xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
          }`}>
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-lg font-bold mb-1">No Active Operations Found</h3>
            <p className="text-xs text-slate-500 mb-6">
              You aren't currently enrolled in any operations matching your filter criteria.
            </p>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 bg-red-600 text-white font-bold text-xs rounded-xl shadow-md"
            >
              Organize or Join an Exchange
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOperations.map((p) => (
              <div
                key={p.id}
                className={`p-6 rounded-3xl border shadow-md flex flex-col justify-between transition-all hover:shadow-xl ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-slate-800">
                      CODE: {p.mission.code}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                      p.mission.status === 'RECRUITING'
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : p.mission.status === 'ASSIGNED'
                        ? 'bg-purple-100 text-purple-900 dark:bg-purple-500/20 dark:text-purple-300'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
                    }`}>
                      ● {p.mission.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{p.mission.isWhiteElephant ? '🐘' : '🎁'}</span>
                    <h3 className="text-xl font-black">{p.mission.title}</h3>
                  </div>

                  <p className="text-xs text-slate-500 mb-4">
                    Type: <strong>{p.mission.isWhiteElephant ? 'White Elephant (Single Brought Gift)' : 'Secret Santa Gifting'}</strong>
                  </p>

                  <div className={`p-4 rounded-2xl border space-y-2 text-xs mb-6 ${
                    isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-stone-50 border-stone-200'
                  }`}>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Budget Range:</span>
                      <strong className={isDarkMode ? 'text-sky-400' : 'text-red-600'}>
                        ${p.mission.budgetMin || 0} – ${p.mission.budgetMax} {p.mission.currency}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Your Assigned Role:</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                        p.role === 'OPS_LEADER'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
                          : 'bg-stone-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                      }`}>
                        {p.role === 'OPS_LEADER' ? 'OpsLeader (Organizer)' : 'Agent (Participant)'}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Exchange Execution Date:</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-bold">
                        {formatDateString(p.mission.executionDate)}
                      </strong>
                    </div>

                    {p.mission.shippingDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Shipping Deadline:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-bold">
                          {formatDateString(p.mission.shippingDate)}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-slate-800">
                  <span className="text-xs text-slate-400 font-mono">
                    OpsLeader: <strong>{formatCodename(p.mission.opsLeader?.codename, p.mission.opsLeader?.name)}</strong>
                  </span>

                  <Link
                    href={`/exchange/${p.mission.code}`}
                    className={`px-5 py-2.5 rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer ${
                      isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    Open Command Center →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

    </div>
  );
}
