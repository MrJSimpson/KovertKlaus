'use client';

import { USER_ID_KEY } from '@/lib/constants/auth';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCodename, formatDateString, getNextMilestoneCountdown } from '@/lib/security';
import { countdownBadgeClass, statusBadgeClass } from '@/lib/stage-colors';
import { useTheme } from '@/context/ThemeContext';
import { CreateOperationModal } from '@/components/CreateOperationModal';
import { JoinOperationModal } from '@/components/JoinOperationModal';

interface ExchangeData {
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
  organizer?: {
    id: string;
    name: string;
    codename?: string;
  };
  opsLeader?: {
    id: string;
    name: string;
    codename?: string;
  };
}

interface OperationItem {
  id: string;
  role: string;
  exchange?: ExchangeData;
  mission?: ExchangeData;
}

/** Which ExchangeStatus values each Mission Center status filter shows. */
const STATUS_FILTER_GROUPS: Record<'RECRUITING' | 'ASSIGNED' | 'COMPLETED', string[]> = {
  RECRUITING: ['RECRUITING', 'SETUP'],
  ASSIGNED: ['MATCHED', 'SHIPPED', 'EXECUTED'],
  COMPLETED: ['COMPLETED'],
};

export default function OperationCenterPage() {
  const { isDarkMode, toggleTheme, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [operations, setOperations] = useState<OperationItem[]>([]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ORGANIZER' | 'MEMBER' | 'OPS_LEADER' | 'AGENT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RECRUITING' | 'ASSIGNED' | 'COMPLETED'>('ALL');

  useEffect(() => {
    fetchOperations();
  }, []);

  async function fetchOperations() {
    setLoading(true);
    let activeUserId = localStorage.getItem(USER_ID_KEY);

    try {
      const meRes = await fetch('/api/users/me');
      const meJson = await meRes.json();
      if (meRes.ok && meJson.authenticated && meJson.user) {
        activeUserId = meJson.user.id;
        localStorage.setItem(USER_ID_KEY, meJson.user.id);
        localStorage.setItem('kovertklaus_user_name', meJson.user.name);
      } else if (meRes.status === 401) {
        // Session expired or signed out: drop the cached identity.
        activeUserId = null;
        localStorage.removeItem(USER_ID_KEY);
        localStorage.removeItem('kovertklaus_user_name');
      }
    } catch {
      // Fall back to localStorage if /api/users/me network check fails
    }

    if (!activeUserId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/operations?userId=${activeUserId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mapped = json.data.map((op: any) => {
          const userMember = op.members?.find((m: any) => m.userId === activeUserId) || op.agents?.find((a: any) => a.userId === activeUserId);
          const organizerIdVal = op.organizerId || op.opsLeaderId;
          return {
            id: op.id,
            // One Head Elf per mission: the organizer. The stored member role is not trusted.
            role: organizerIdVal === activeUserId ? 'ORGANIZER' : 'MEMBER',
            exchange: op,
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
    const ex = item.exchange || item.mission;
    if (!ex) return false;

    const titleMatch = ex.title.toLowerCase().includes(searchQuery.toLowerCase());
    const codeMatch = ex.code.toLowerCase().includes(searchQuery.toLowerCase());
    const roleMatch =
      roleFilter === 'ALL' ||
      item.role === roleFilter ||
      (roleFilter === 'ORGANIZER' && item.role === 'OPS_LEADER') ||
      (roleFilter === 'MEMBER' && item.role === 'FIELD_AGENT');
    // Filters group the real ExchangeStatus values: Recruiting covers setup, Assigned covers drawn missions.
    const statusMatch = statusFilter === 'ALL' || STATUS_FILTER_GROUPS[statusFilter].includes(ex.status);
    return (titleMatch || codeMatch) && roleMatch && statusMatch;
  });

  async function handleSignOut() {
    try {
      await fetch('/api/users/me', { method: 'DELETE' });
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem(USER_ID_KEY);
      localStorage.removeItem('kovertklaus_user_name');
      window.location.href = '/';
    }
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${theme.pageBg}`}>
      
      {/* Navigation Header */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md ${theme.headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl flex items-center justify-center font-extrabold text-lg sm:text-xl shadow-md bg-kk-primary text-kk-on-primary border border-kk-border-strong">
              🎁
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black tracking-tight block">KovertKlaus</span>
              <span className={`text-[10px] sm:text-xs font-bold hidden sm:block ${theme.textGoldOnDark}`}>
                Exchange Workspace
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={toggleTheme}
              className={`p-2 min-h-[44px] min-w-[44px] rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center ${theme.btnToggle}`}
              title={isDarkMode ? 'Switch to Klaus Mode' : 'Switch to Kovert Mode'}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="sm:hidden text-base">{isDarkMode ? '🎅' : '🕶️'}</span>
              <span className="hidden sm:inline">{isDarkMode ? '🎅 Klaus Mode' : '🕶️ Kovert Mode'}</span>
            </button>

            <Link
              href="/dashboard"
              className={`text-xs font-bold px-3 sm:px-4 py-2 min-h-[44px] flex items-center whitespace-nowrap rounded-xl transition-all shadow-sm ${theme.btnPrimary}`}
            >
              <span className="sm:hidden">← Back</span>
              <span className="hidden sm:inline">← Back to Dashboard</span>
            </Link>

            <button
              onClick={handleSignOut}
              className={`text-xs font-bold px-3 sm:px-4 py-2 min-h-[44px] flex items-center rounded-xl transition-all shadow-sm cursor-pointer ${theme.btnNeutral}`}
            >
              <span className="sm:hidden">Exit</span>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
        
        {/* Banner */}
        <div className={`p-8 rounded-3xl border shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${theme.cardBg}`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${theme.badgeCode}`}>
                🗺️ Holiday Mission Control
              </span>
              <span className={`text-xs ${theme.textSubLabel}`}>Active Missions & Secret Santa Groups</span>
            </div>
            <h1 className="text-3xl font-black">Holiday Mission Center</h1>
            <p className={`text-xs mt-1 max-w-2xl ${theme.textSubLabel}`}>
              Manage your active Secret Santa and White Elephant holiday missions. Track participant enrollment, target assignments, and gift shipping deadlines in real time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setJoinModalOpen(true)}
              className={`px-5 py-3.5 rounded-2xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${theme.btnSecondary}`}
            >
              <span>🕵️ Join Mission</span>
            </button>

            <button
              onClick={() => setCreateModalOpen(true)}
              className={`px-6 py-3.5 rounded-2xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${theme.btnPrimary}`}
            >
              <span>+ New Mission</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between ${theme.cardBg}`}>
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by mission name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl px-4 py-2 text-xs focus:outline-none ${theme.inputBg}`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto text-xs font-semibold">
            {/* Role Filter */}
            <div className={`flex flex-wrap items-center gap-1 p-1 rounded-xl border bg-kk-inset border-kk-border`}>
              <button
                onClick={() => setRoleFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                  roleFilter === 'ALL'
                    ? theme.btnPrimary
                    : 'text-kk-muted hover:text-kk-ink'
                }`}
              >
                All Roles
              </button>
              <button
                onClick={() => setRoleFilter('ORGANIZER')}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                  roleFilter === 'ORGANIZER' || roleFilter === 'OPS_LEADER'
                    ? theme.btnPrimary
                    : 'text-kk-muted hover:text-kk-ink'
                }`}
              >
                Head Elf
              </button>
              <button
                onClick={() => setRoleFilter('MEMBER')}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                  roleFilter === 'MEMBER' || roleFilter === 'AGENT'
                    ? theme.btnPrimary
                    : 'text-kk-muted hover:text-kk-ink'
                }`}
              >
                Elf Agent
              </button>
            </div>

            {/* Status Filter */}
            <div className={`flex flex-wrap items-center gap-1 p-1 rounded-xl border bg-kk-inset border-kk-border`}>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                  statusFilter === 'ALL'
                    ? theme.btnPrimary
                    : 'text-kk-muted hover:text-kk-ink'
                }`}
              >
                All Statuses
              </button>
              <button
                onClick={() => setStatusFilter('RECRUITING')}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                  statusFilter === 'RECRUITING'
                    ? theme.btnPrimary
                    : 'text-kk-muted hover:text-kk-ink'
                }`}
              >
                Recruiting
              </button>
              <button
                onClick={() => setStatusFilter('ASSIGNED')}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                  statusFilter === 'ASSIGNED'
                    ? theme.btnPrimary
                    : 'text-kk-muted hover:text-kk-ink'
                }`}
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
            <p className="text-sm font-semibold">Loading Exchange Workspace...</p>
          </div>
        ) : filteredOperations.length === 0 ? (
          <div className={`p-12 text-center rounded-3xl border ${theme.cardBg}`}>
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-lg font-bold mb-1">No Active Exchanges Found</h3>
            <p className={`text-xs mb-6 ${theme.textSubLabel}`}>
              You aren't currently enrolled in any exchanges matching your filter criteria.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setCreateModalOpen(true)}
                className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-md cursor-pointer ${theme.btnPrimary}`}
              >
                + Organize New Exchange
              </button>
              <button
                onClick={() => setJoinModalOpen(true)}
                className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-md cursor-pointer ${theme.btnSecondary}`}
              >
                🕵️ Join via Invite Code
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOperations.map((p) => {
              const ex = p.exchange || p.mission;
              if (!ex) return null;
              const organizerData = ex.organizer || ex.opsLeader;
              const countdown = getNextMilestoneCountdown(ex);
              return (
                <div
                  key={p.id}
                  className={`p-6 rounded-3xl border shadow-md flex flex-col justify-between transition-all hover:shadow-xl ${theme.cardBg}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${theme.badgeCode}`}>
                        CODE: {ex.code}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${statusBadgeClass(countdown)}`}>
                        ● {countdown.phaseStatusLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{ex.isWhiteElephant ? '🐘' : '🎁'}</span>
                      <h3 className="text-xl font-black">{ex.title}</h3>
                    </div>

                    <p className={`text-xs mb-4 ${theme.textSubLabel}`}>
                      Type: <strong className={theme.textLabel}>{ex.isWhiteElephant ? 'White Elephant (Single Brought Gift)' : 'Secret Santa Gifting'}</strong>
                    </p>

                    <div className={`p-4 rounded-2xl border space-y-2 text-xs mb-6 ${theme.cardInnerBg}`}>
                      <div className="flex justify-between items-center">
                        <span className={theme.textLabel}>Budget Range:</span>
                        <strong className={theme.textAccent}>
                          ${ex.budgetMin || 0} – ${ex.budgetMax} {ex.currency}
                        </strong>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className={theme.textLabel}>Your Role:</span>
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                          p.role === 'ORGANIZER' || p.role === 'OPS_LEADER'
                            ? theme.badgeAmber
                            : 'bg-kk-inset text-kk-ink border border-kk-border'
                        }`}>
                          {p.role === 'ORGANIZER' || p.role === 'OPS_LEADER' ? 'Head Elf' : 'Elf Agent'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-kk-border">
                        <span className={`flex items-center gap-1 ${theme.textLabel}`}>
                          ⏳ {countdown.milestoneLabel}:
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${countdownBadgeClass(countdown)}`}>
                          {countdown.formattedText}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className={theme.textLabel}>Exchange Execution Date:</span>
                        <strong className={theme.textDate}>
                          {formatDateString(ex.executionDate)}
                        </strong>
                      </div>
                    </div>

                    {ex.shippingDate && (
                      <div className="text-xs mb-4 flex justify-between">
                        <span className={theme.textLabel}>Shipping Deadline:</span>
                        <strong className={theme.textDate}>{formatDateString(ex.shippingDate)}</strong>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-kk-border">
                    <span className={`text-xs truncate shrink-0 ${theme.textSubLabel}`}>
                      Head Elf: <strong className={theme.textLabel}>{organizerData?.name || 'Organizer'}</strong>
                    </span>

                    <Link
                      href={`/exchange/${ex.code}`}
                      className={`text-[11px] font-extrabold px-3 py-2 rounded-xl transition-all shadow-sm whitespace-nowrap shrink-0 ${theme.btnPrimary}`}
                    >
                      Command Center →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* MODAL: CREATE OPERATION */}
      <CreateOperationModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => fetchOperations()}
      />

      {/* MODAL: JOIN OPERATION */}
      <JoinOperationModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onSuccess={() => fetchOperations()}
      />

    </div>
  );
}
