'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface OperationMission {
  id: string;
  title: string;
  code: string;
  budgetMin?: number;
  budgetMax: number;
  currency: string;
  executionDate: string;
  assignmentDate: string;
  inviteCutoffDate: string;
  shippingDate?: string;
  status: string;
  isWhiteElephant: boolean;
  opsLeader: {
    id: string;
    name: string;
    codename?: string;
  };
  _count?: {
    agents: number;
  };
}

interface UserParticipation {
  id: string;
  role: string;
  shippingStatus: string;
  mission: OperationMission;
}

export default function OperationCenterPage() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [participations, setParticipations] = useState<UserParticipation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OPS_LEADER' | 'FIELD_AGENT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchOperations();
  }, []);

  async function fetchOperations() {
    setLoading(true);
    try {
      const res = await fetch('/api/users/me');
      const json = await res.json();
      if (res.ok && json.authenticated && json.user) {
        setParticipations(json.user.participations || []);
      } else {
        const savedId = localStorage.getItem('kovertklaus_user_id');
        if (!savedId) router.push('/');
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }

  // Filter Operations
  const filteredParticipations = participations.filter((p) => {
    const matchesSearch = p.mission.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.mission.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || p.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || p.mission.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${
      isDarkMode
        ? 'bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950'
        : 'bg-stone-50 text-slate-900 selection:bg-red-600 selection:text-white'
    }`}>
      
      {/* Header */}
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
              <span className={`text-xs font-bold ${isDarkMode ? 'text-sky-400' : 'text-emerald-800'}`}>Operation Center Dashboard</span>
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
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        
        {/* Title Banner */}
        <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
        }`}>
          <div>
            <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
              isDarkMode ? 'bg-sky-500/20 text-sky-300' : 'bg-emerald-100 text-emerald-900'
            }`}>
              🎄 CENTRAL OPERATION COMMAND DASHBOARD
            </span>
            <h1 className="text-3xl font-black mt-2">Active Operations & Exchanges</h1>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Manage your Secret Santa and White Elephant holiday operations, roles (`OpsLeader` or `Agent`), and timelines.
            </p>
          </div>

          <Link
            href="/"
            className={`px-6 py-3 rounded-2xl font-bold text-xs shadow-md transition-all whitespace-nowrap cursor-pointer ${
              isDarkMode ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            + Organize New Operation
          </Link>
        </div>

        {/* Search & Filter Toolbar */}
        <div className={`p-4 rounded-2xl border shadow-md mb-8 grid grid-cols-1 sm:grid-cols-12 gap-4 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
        }`}>
          <div className="sm:col-span-6">
            <input
              type="text"
              placeholder="Search operations by title or code (e.g. KOVERT-87WZ)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:ring-sky-400' : 'bg-stone-50 border-stone-300 text-slate-900 focus:ring-red-600'
              }`}
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-stone-50 border-stone-300 text-slate-900'
              }`}
            >
              <option value="ALL">All Roles (OpsLeader & Agent)</option>
              <option value="OPS_LEADER">Role: OpsLeader Only</option>
              <option value="FIELD_AGENT">Role: Agent Only</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-stone-50 border-stone-300 text-slate-900'
              }`}
            >
              <option value="ALL">All Statuses</option>
              <option value="RECRUITING">RECRUITING (Open for Registration)</option>
              <option value="ASSIGNED">ASSIGNED (Targets Drawn)</option>
              <option value="SHIPPED">SHIPPED (Gifts En Route)</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </div>
        </div>

        {/* Operation Cards Directory */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-4xl animate-bounce mb-3">🎁</div>
            <p className="text-sm font-semibold">Loading Operations Directory...</p>
          </div>
        ) : filteredParticipations.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-slate-800 rounded-3xl">
            <div className="text-4xl mb-3">🎄</div>
            <h3 className="text-lg font-bold">No Operations Found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">You are not enrolled in any matching operations.</p>
            <Link
              href="/"
              className={`px-5 py-2.5 rounded-xl font-bold text-xs ${
                isDarkMode ? 'bg-sky-500 text-slate-950' : 'bg-red-600 text-white'
              }`}
            >
              Organize or Join an Operation
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredParticipations.map((p) => (
              <div
                key={p.id}
                className={`p-6 rounded-3xl border shadow-lg transition-all flex flex-col justify-between ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs px-3 py-1 rounded-full font-mono font-bold ${
                      isDarkMode ? 'bg-sky-500/20 text-sky-300' : 'bg-emerald-100 text-emerald-900'
                    }`}>
                      CODE: {p.mission.code}
                    </span>

                    <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
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
                      <strong className="text-slate-700 dark:text-slate-200">
                        {new Date(p.mission.executionDate).toLocaleDateString()}
                      </strong>
                    </div>

                    {p.mission.shippingDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Shipping Deadline:</span>
                        <span>{new Date(p.mission.shippingDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-slate-800">
                  <span className="text-xs text-slate-400 font-mono">
                    OpsLeader: <strong>{p.mission.opsLeader?.name}</strong>
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
