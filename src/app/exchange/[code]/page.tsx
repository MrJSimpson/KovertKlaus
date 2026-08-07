'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCodename, formatDateString } from '@/lib/security';
import { useTheme } from '@/context/ThemeContext';
import { InviteAgentModal } from '@/components/InviteAgentModal';
import { PreventativeMatchModal, OperationExclusionRule } from '@/components/PreventativeMatchModal';
import { ManageAssignmentsModal } from '@/components/ManageAssignmentsModal';
import { OpTeamBroadcastModal } from '@/components/OpTeamBroadcastModal';
import { AfterActionReportSection, AARReportEntry } from '@/components/AfterActionReportSection';


interface OperationAgent {
  id: string;
  userId: string;
  role: string;
  shippingStatus: string;
  trackingNumber?: string;
  targetUserId?: string;
  user?: {
    id: string;
    name: string;
    codename?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  targetUser?: {
    id: string;
    name: string;
    codename?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

interface OperationData {
  id: string;
  title: string;
  code: string;
  description?: string;
  budgetMin?: number;
  budgetMax: number;
  currency: string;
  inviteCutoffDate: string; // Go/No-Go Date
  assignmentDate: string;   // Target Assignment Date
  shippingDate: string;     // Gift Shipping Deadline
  executionDate: string;    // Exchange Execution Date
  status: string;
  isWhiteElephant: boolean;
  isLocalOnly: boolean;
  eventLocation?: string;
  maxParticipants?: number;
  opsLeaderId: string;
  opsLeader: {
    id: string;
    name: string;
    codename?: string;
  };
  agents: OperationAgent[];
  exclusionRules?: OperationExclusionRule[];
  opsLeaderAssistedDraw?: boolean;
  afterActionReports?: AARReportEntry[];
}

export default function OperationCommandCenterPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string)?.toUpperCase() || '';

  const { isDarkMode, toggleTheme, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<OperationData | null>(null);

  // Current User Session
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  // Invite Agent Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [preventativeModalOpen, setPreventativeModalOpen] = useState(false);
  const [manageAssignmentsModalOpen, setManageAssignmentsModalOpen] = useState(false);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);

  // OpsLeader Control Panel State
  const [drawingTargets, setDrawingTargets] = useState(false);
  const [drawSuccessMessage, setDrawSuccessMessage] = useState('');

  // OpsLeader Date Editor Modal State
  const [editDatesModalOpen, setEditDatesModalOpen] = useState(false);
  const [editCutoffDate, setEditCutoffDate] = useState('');
  const [editAssignDate, setEditAssignDate] = useState('');
  const [editShipDate, setEditShipDate] = useState('');
  const [editExecDate, setEditExecDate] = useState('');
  const [savingDates, setSavingDates] = useState(false);
  const [dateError, setDateError] = useState('');

  // OpsLeader Settings Editor Modal State
  const [editSettingsModalOpen, setEditSettingsModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBudgetMin, setEditBudgetMin] = useState(0);
  const [editBudgetMax, setEditBudgetMax] = useState(50);
  const [editMaxParticipants, setEditMaxParticipants] = useState<number | undefined>(undefined);
  const [editIsLocalOnly, setEditIsLocalOnly] = useState(false);
  const [editEventLocation, setEditEventLocation] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // OpKit & OpTools Scraper State
  const [opToolUrl, setOpToolUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [userOpKit, setUserOpKit] = useState<Array<{ id: string; title: string; price?: number; url: string; thumbnail?: string }>>([]);
  const [validationError, setValidationError] = useState('');

  // Anonymous Intel Messaging State
  const [intelMessageText, setIntelMessageText] = useState('');
  const [sendingIntel, setSendingIntel] = useState(false);
  const [intelLogs, setIntelLogs] = useState<Array<{ id: string; sender: string; text: string; time: string }>>([
    { id: '1', sender: 'Agent-KovertKlaus', text: 'Operation initialized. All agents stand by for target assignment.', time: '10:00 AM' },
  ]);

  useEffect(() => {
    async function initSession() {
      try {
        const res = await fetch('/api/users/me');
        const json = await res.json();
        if (res.ok && json.authenticated && json.user) {
          setUserId(json.user.id);
          setUserName(json.user.name);
          localStorage.setItem('kovertklaus_user_id', json.user.id);
          localStorage.setItem('kovertklaus_user_name', json.user.name);
        } else {
          const savedUserId = localStorage.getItem('kovertklaus_user_id');
          const savedUserName = localStorage.getItem('kovertklaus_user_name');
          if (savedUserId) setUserId(savedUserId);
          if (savedUserName) setUserName(savedUserName);
        }
      } catch {
        const savedUserId = localStorage.getItem('kovertklaus_user_id');
        const savedUserName = localStorage.getItem('kovertklaus_user_name');
        if (savedUserId) setUserId(savedUserId);
        if (savedUserName) setUserName(savedUserName);
      }
      fetchExchangeDetails();
    }

    initSession();
  }, [code]);

  async function fetchExchangeDetails() {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/operations?code=${code}`);
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        setError(json.error || 'Operation not found');
      } else {
        setOperation(json.data);
        populateForms(json.data);
      }
    } catch {
      setError('Failed to load operation details');
    } finally {
      setLoading(false);
    }
  }

  function populateForms(op: OperationData) {
    setEditCutoffDate(new Date(op.inviteCutoffDate).toISOString().split('T')[0]);
    setEditAssignDate(new Date(op.assignmentDate).toISOString().split('T')[0]);
    setEditShipDate(op.shippingDate ? new Date(op.shippingDate).toISOString().split('T')[0] : '');
    setEditExecDate(new Date(op.executionDate).toISOString().split('T')[0]);

    setEditTitle(op.title);
    setEditDescription(op.description || '');
    setEditBudgetMin(op.budgetMin || 0);
    setEditBudgetMax(op.budgetMax);
    setEditMaxParticipants(op.maxParticipants);
    setEditIsLocalOnly(op.isLocalOnly);
    setEditEventLocation(op.eventLocation || '');
  }

  // Handle Save Operation Settings (OpsLeader Only)
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!operation || !userId) return;

    setSavingSettings(true);
    setSettingsError('');

    try {
      const res = await fetch('/api/operations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          operationId: operation.id,
          action: 'update_settings',
          settings: {
            title: editTitle,
            description: editDescription,
            budgetMin: Number(editBudgetMin),
            budgetMax: Number(editBudgetMax),
            maxParticipants: editMaxParticipants ? Number(editMaxParticipants) : undefined,
            isLocalOnly: editIsLocalOnly,
            eventLocation: editEventLocation,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update operation settings');
      }

      setEditSettingsModalOpen(false);
      fetchExchangeDetails();
    } catch (err: any) {
      setSettingsError(err.message || 'Update failed');
    } finally {
      setSavingSettings(false);
    }
  }

  // Handle Save Dates (OpsLeader Only)
  async function handleSaveDates(e: React.FormEvent) {
    e.preventDefault();
    if (!operation || !userId) return;

    setSavingDates(true);
    setDateError('');

    try {
      const res = await fetch('/api/operations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          operationId: operation.id,
          action: 'update_dates',
          dates: {
            inviteCutoffDate: editCutoffDate,
            assignmentDate: editAssignDate,
            shippingDate: editShipDate,
            executionDate: editExecDate,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const detailMsg = json.details?.join(' ') || json.error;
        throw new Error(detailMsg || 'Failed to update timeline dates');
      }

      setEditDatesModalOpen(false);
      fetchExchangeDetails();
    } catch (err: any) {
      setDateError(err.message || 'Update failed');
    } finally {
      setSavingDates(false);
    }
  }

  // Handle Target Draw (OpsLeader Only)
  async function handleTriggerDraw() {
    if (!operation || !userId) return;
    if (!confirm('Are you sure you want to trigger Secret Santa target assignments now using Sattolo\'s derangement algorithm?')) return;

    setDrawingTargets(true);
    setDrawSuccessMessage('');
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draw', operationId: operation.id, userId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to execute target draw');
      }
      setDrawSuccessMessage('🎯 Target assignments successfully executed! All agents have been secretly assigned.');
      fetchExchangeDetails();
    } catch (err: any) {
      alert(err.message || 'Target draw failed');
    } finally {
      setDrawingTargets(false);
    }
  }

  // Handle Close Recruitment (OpsLeader Only)
  async function handleCloseRecruitment() {
    if (!operation || !userId) return;
    if (!confirm('Close recruitment for this operation now? The invite cutoff date will be updated to today.')) return;

    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'closeRecruitment', operationId: operation.id, userId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to close recruitment');
      alert('🔒 Recruitment closed! Invite cutoff date updated to today.');
      fetchExchangeDetails();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      alert(msg);
    }
  }

  // Handle End Operation (OpsLeader Only)
  async function handleEndOperation() {
    if (!operation || !userId) return;
    if (!confirm('Are you sure you want to end this operation now? Execution date will be updated to today and status marked as COMPLETED.')) return;

    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'endOperation', operationId: operation.id, userId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to end operation');
      alert('🏁 Operation completed! Status updated to COMPLETED.');
      fetchExchangeDetails();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      alert(msg);
    }
  }

  // Handle URL Scraper for OpTools
  async function handleScrapeUrl(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');
    if (!opToolUrl.trim()) return;

    // Strict White Elephant 1-Gift Limit Check
    if (operation?.isWhiteElephant && userOpKit.length >= 1) {
      setValidationError('🐘 White Elephant OpKits are strictly limited to 1 brought gift item per operative!');
      return;
    }

    setScraping(true);
    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: opToolUrl.trim() }),
      });
      const json = await res.json();

      const newItem = {
        id: Math.random().toString(36).substring(2, 9),
        title: json.success && json.metadata?.title ? json.metadata.title : opToolUrl.trim(),
        price: json.metadata?.price,
        thumbnail: json.metadata?.thumbnail,
        url: opToolUrl.trim(),
      };
      setUserOpKit((prev) => [...prev, newItem]);
      setOpToolUrl('');
    } catch {
      setUserOpKit((prev) => [
        ...prev,
        { id: Math.random().toString(36).substring(2, 9), title: opToolUrl.trim(), url: opToolUrl.trim() },
      ]);
      setOpToolUrl('');
    } finally {
      setScraping(false);
    }
  }

  // Handle Intel Message Dispatch
  function handleSendIntel(e: React.FormEvent) {
    e.preventDefault();
    if (!intelMessageText.trim()) return;

    setSendingIntel(true);
    const newMsg = {
      id: Math.random().toString(36).substring(2, 9),
      sender: userName ? formatCodename(undefined, userName) : 'Agent-Secret',
      text: intelMessageText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setIntelLogs((prev) => [...prev, newMsg]);
    setIntelMessageText('');
    setSendingIntel(false);
  }

  // Handle OpsLeader Agent Management Actions
  async function handleAgentAction(
    actionType: 'update_agent_role' | 'remove_agent' | 'issue_demerit' | 'nudge_agent',
    agent: any,
    extra?: any
  ) {
    if (!operation || !userId) return;

    if (actionType === 'remove_agent') {
      if (!confirm(`Are you sure you want to disenroll ${agent.user?.name || 'this agent'} from the operation?`)) return;
    } else if (actionType === 'issue_demerit') {
      if (agent.deliveredConfirmed) {
        alert(`🛡️ Demerit Waiver Active: ${agent.user?.name || 'This agent'} has verified receipt of a gift for this operation. Demerit citations cannot be issued.`);
        return;
      }
      if (!confirm(`Issue a 1-point Demerit citation to ${agent.user?.name || 'this agent'} for deadline non-compliance?`)) return;
    }

    try {
      const res = await fetch('/api/operations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          operationId: operation.id,
          action: actionType,
          agentId: agent.id,
          targetUserId: agent.userId,
          newRole: extra?.newRole,
          demeritPoints: 1,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Action failed');
      }
      alert(json.message || 'Agent action executed successfully!');
      fetchExchangeDetails();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  }

  // Determine User Role & Target in this Operation
  const currentAgent = operation?.agents.find((a) => a.userId === userId);
  const isOpsLeader = operation?.opsLeaderId === userId || currentAgent?.role === 'OPS_LEADER';
  const assignedTarget = currentAgent?.targetUser;
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${theme.pageBg}`}>
      
      {/* Top Header Navigation */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md ${theme.headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <Link href="/operations" className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-white text-xl shadow-md ${
              isDarkMode ? 'bg-gradient-to-br from-sky-400 to-slate-700' : 'bg-gradient-to-br from-red-600 to-emerald-800'
            }`}>
              🎁
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block">KovertKlaus</span>
              <span className={`text-xs font-bold ${theme.textBrand}`}>
                Operation Command Center
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${theme.btnToggle}`}
            >
              {isDarkMode ? '🎄 Light' : '❄️ Dark (Icy)'}
            </button>

            <Link
              href="/operations"
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${theme.btnPrimary}`}
            >
              ← Operations Center
            </Link>
          </div>
        </div>
      </header>

      {/* Main Command Center Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        
        {loading ? (
          <div className="text-center py-20">
            <div className="text-4xl animate-bounce mb-3">🎁</div>
            <p className="text-sm font-semibold">Initializing Command Center Data Stream...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-xl font-bold mb-2">Operation Access Denied</h2>
            <p className="text-xs text-slate-500 mb-6">{error}</p>
            <Link href="/operations" className={`px-6 py-3 font-bold text-xs rounded-xl ${theme.btnPrimary}`}>
              Return to Operations Center
            </Link>
          </div>
        ) : operation ? (
          <div className="space-y-8">
            
            {/* Primary Operation Banner */}
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${theme.cardBg}`}>
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className={`text-xs px-3 py-1 rounded-full font-mono font-bold ${theme.badgeCode}`}>
                    CODE: {operation.code}
                  </span>

                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                    operation.isWhiteElephant ? theme.badgeWhiteElephant : theme.badgeSecretSanta
                  }`}>
                    {operation.isWhiteElephant ? '🐘 White Elephant' : '🎁 Secret Santa'}
                  </span>

                  {operation.isLocalOnly && (
                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${theme.badgeAmber}`}>
                      📍 Local In-Person Event
                    </span>
                  )}

                  <span className={`text-xs font-semibold ${theme.textSubLabel}`}>
                    OpsLeader: <strong className={theme.textLabel}>{operation.opsLeader.name} ({formatCodename(operation.opsLeader.codename, operation.opsLeader.name)})</strong>
                  </span>
                </div>

                <h1 className="text-3xl font-black">{operation.title}</h1>
                
                {operation.description && (
                  <p className={`text-xs mt-1 italic ${theme.textSubLabel}`}>
                    "{operation.description}"
                  </p>
                )}

                <div className={`text-xs mt-2 space-y-0.5 ${theme.textSubLabel}`}>
                  <p>
                    Budget Limit: <strong className={theme.textAccent}>${operation.budgetMin || 0} – ${operation.budgetMax} {operation.currency}</strong>
                  </p>
                  {operation.isLocalOnly && operation.eventLocation && (
                    <p className={`font-bold ${theme.textLabel}`}>
                      📍 Event Location: {operation.eventLocation}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(operation.code);
                    alert(`Copied Invite Code to clipboard: ${operation.code}`);
                  }}
                  className={`px-5 py-3 rounded-2xl font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${theme.btnPrimary}`}
                >
                  <span>📋 Copy Invite Code ({operation.code})</span>
                </button>
              </div>
            </div>

            {/* 4-Stage Operational Timeline Cards */}
            <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-bold uppercase tracking-wider block ${theme.textLabel}`}>
                  📅 4-Stage Operational Timeline
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold">
                <div className={`p-4 rounded-2xl border ${theme.cardInnerBg}`}>
                  <span className={`text-xs uppercase font-mono font-extrabold block ${isDarkMode ? 'text-amber-300' : 'text-amber-800'}`}>
                    STAGE 1
                  </span>
                  <span className={`font-bold block text-sm mt-0.5 ${theme.textLabel}`}>Go/No-Go Date</span>
                  <span className={`text-[11px] block mt-0.5 ${theme.textSubLabel}`}>(Invite Cutoff)</span>
                  <strong className={`text-base font-black block mt-2 ${theme.textDate}`}>
                    {formatDateString(operation.inviteCutoffDate)}
                  </strong>
                </div>

                <div className={`p-4 rounded-2xl border ${theme.cardInnerBg}`}>
                  <span className={`text-xs uppercase font-mono font-extrabold block ${isDarkMode ? 'text-sky-300' : 'text-sky-800'}`}>
                    STAGE 2
                  </span>
                  <span className={`font-bold block text-sm mt-0.5 ${theme.textLabel}`}>Target Assignment</span>
                  <span className={`text-[11px] block mt-0.5 ${theme.textSubLabel}`}>(Sattolo Draw)</span>
                  <strong className={`text-base font-black block mt-2 ${theme.textDate}`}>
                    {formatDateString(operation.assignmentDate)}
                  </strong>
                </div>

                <div className={`p-4 rounded-2xl border ${theme.cardInnerBg}`}>
                  <span className={`text-xs uppercase font-mono font-extrabold block ${isDarkMode ? 'text-purple-300' : 'text-purple-800'}`}>
                    STAGE 3
                  </span>
                  <span className={`font-bold block text-sm mt-0.5 ${theme.textLabel}`}>Gift Shipping Deadline</span>
                  <span className={`text-[11px] block mt-0.5 ${theme.textSubLabel}`}>(Tracking Required)</span>
                  <strong className={`text-base font-black block mt-2 ${theme.textDate}`}>
                    {formatDateString(operation.shippingDate)}
                  </strong>
                </div>

                <div className={`p-4 rounded-2xl border ${theme.cardInnerBg}`}>
                  <span className={`text-xs uppercase font-mono font-extrabold block ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                    STAGE 4
                  </span>
                  <span className={`font-bold block text-sm mt-0.5 ${theme.textLabel}`}>Exchange Execution</span>
                  <span className={`text-[11px] block mt-0.5 ${theme.textSubLabel}`}>(Event Day)</span>
                  <strong className={`text-base font-black block mt-2 ${theme.textAccent}`}>
                    {formatDateString(operation.executionDate)}
                  </strong>
                </div>
              </div>
            </div>

            {/* OpsLeader Administrative Control Console (Clean High-Contrast Theme) */}
            {isOpsLeader && (
              <div className={`p-6 rounded-3xl ${theme.consoleCard}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className={theme.consoleHeading}>
                      🎖️ OpsLeader Administrative Console
                    </span>
                    <p className={theme.consoleText}>
                      As the designated OpsLeader, you control enrollment deadlines, operation options, target draws, and compliance logs.
                    </p>
                  </div>

                  <span className={theme.consoleBadge}>
                    OpsLeader Clearance
                  </span>
                </div>

                {drawSuccessMessage && (
                  <div className={`mt-3 p-3 rounded-xl text-xs font-bold border ${theme.alertSuccess}`}>
                    ✓ {drawSuccessMessage}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-4">

                  {/* PHASE 1: RECRUITING */}
                  {operation.status === 'RECRUITING' && (
                    <>
                      <button onClick={() => setInviteModalOpen(true)} className={theme.btnEmerald}>
                        ✉️ Invite Agent
                      </button>
                      <button onClick={handleCloseRecruitment} className={theme.btnAmber}>
                        🔒 Close Recruitment
                      </button>
                    </>
                  )}

                  {/* PHASE 2: ASSIGNMENT */}
                  {operation.status === 'SETUP' && !operation.isWhiteElephant && (
                    <>
                      <button onClick={() => setInviteModalOpen(true)} className={theme.btnSecondary}>
                        🚨 Emergency Invite
                      </button>
                      <button onClick={() => setPreventativeModalOpen(true)} className={theme.btnPurple}>
                        🚫 Matching Rules ({operation.exclusionRules?.length || 0})
                      </button>
                      <button onClick={handleTriggerDraw} disabled={drawingTargets} className={theme.btnEmerald}>
                        {drawingTargets ? 'Executing Draw...' : '🎯 Initiate Assignments'}
                      </button>
                    </>
                  )}

                  {/* PHASE 3: EXECUTION / SHIPPING */}
                  {(operation.status === 'ASSIGNED' || operation.status === 'SHIPPED') && (
                    <>
                      <button onClick={() => setBroadcastModalOpen(true)} className={theme.btnSecondary}>
                        📢 Send OpTeam Broadcast
                      </button>
                      {!operation.isWhiteElephant && (
                        <button onClick={() => setManageAssignmentsModalOpen(true)} className={theme.btnEmerald}>
                          🎯 Manage Target Assignments & Swaps
                        </button>
                      )}
                    </>
                  )}

                  {/* PHASE 4: EXCHANGE EVENT (EXECUTED) */}
                  {operation.status === 'EXECUTED' && (
                    <>
                      {!operation.isWhiteElephant && (
                        <button onClick={() => setManageAssignmentsModalOpen(true)} className={theme.btnEmerald}>
                          🎁 Wish List Verification
                        </button>
                      )}
                      <button onClick={() => setBroadcastModalOpen(true)} className={theme.btnSecondary}>
                        📢 OpTeam Broadcast
                      </button>
                      <button onClick={handleEndOperation} className={theme.btnPrimary}>
                        🏁 End Operation
                      </button>
                    </>
                  )}

                  {/* POST-EVENT: COMPLETED */}
                  {operation.status === 'COMPLETED' && (
                    <>
                      {!operation.isWhiteElephant && (
                        <button onClick={() => setManageAssignmentsModalOpen(true)} className={theme.btnEmerald}>
                          🎁 Wish List Verification
                        </button>
                      )}
                      <button onClick={() => setBroadcastModalOpen(true)} className={theme.btnSecondary}>
                        📢 OpTeam Broadcast
                      </button>
                    </>
                  )}

                  {/* COMMON OPTIONS & TIMELINE EDITORS */}
                  {operation.status !== 'COMPLETED' && (
                    <>
                      <button onClick={() => { setSettingsError(''); setEditSettingsModalOpen(true); }} className={theme.btnAmber}>
                        ⚙️ Edit Operation Options
                      </button>
                      <button onClick={() => { setDateError(''); setEditDatesModalOpen(true); }} className={theme.btnSky}>
                        📅 Edit Operation Timeline
                      </button>
                    </>
                  )}

                </div>
              </div>
            )}

            {/* 2-Column Command Center Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Target Assignment & OpKit Workspace */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Secret Santa Target Assignment Card */}
                {!operation.isWhiteElephant && (
                  <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        🎯 Your Secret Assignment
                      </h2>
                      <span className={`text-xs px-3 py-1 rounded-full font-mono font-bold ${
                        assignedTarget ? theme.badgeSecretSanta : theme.badgeAmber
                      }`}>
                        {assignedTarget ? 'TARGET ASSIGNED' : 'AWAITING DRAW'}
                      </span>
                    </div>

                    {assignedTarget ? (
                      <div className={`p-4 rounded-2xl border space-y-2 ${theme.cardInnerBg}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={`text-xs block ${theme.textSubLabel}`}>Assigned Target Operative:</span>
                            <span className={`text-xl font-black ${theme.textHeading}`}>
                              {formatCodename(assignedTarget.codename, assignedTarget.name)}
                            </span>
                          </div>
                          <span className="text-2xl">🎁</span>
                        </div>

                        {assignedTarget.streetAddress && (
                          <div className={`text-xs border-t border-stone-200 dark:border-slate-800 pt-2 ${theme.textSubLabel}`}>
                            <span>Courier Address: </span>
                            <strong className={theme.textLabel}>{assignedTarget.streetAddress}, {assignedTarget.city}, {assignedTarget.state} {assignedTarget.zipCode}</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 border-2 border-dashed border-stone-200/80 dark:border-slate-800 rounded-2xl">
                        <p className={`text-xs font-medium ${theme.textSubLabel}`}>
                          Target assignments have not been drawn yet. Stand by for your OpsLeader to initiate the draw!
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* OpKit & OpTools Scraper Section */}
                <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
                  <h2 className="text-xl font-bold mb-0.5 flex items-center gap-2">
                    {operation.isWhiteElephant ? '🐘 White Elephant Brought Gift OpKit' : '🎁 My OpKit'}
                  </h2>
                  <p className={`text-xs font-semibold mb-1 ${theme.textAccent}`}>
                    (OpKit = {operation.isWhiteElephant ? 'Single Brought Gift' : 'Your Secret Santa Wishlist'} | OpTools = Wished-for Gift Items)
                  </p>
                  <p className={`text-xs mb-4 ${theme.textSubLabel}`}>
                    {operation.isWhiteElephant
                      ? 'Add the 1 gift item you are bringing to the live White Elephant pool (Max 1 OpTool).'
                      : 'Paste store product links to populate your Secret Santa OpKit. We\'ll auto-scrape titles and prices!'}
                  </p>

                  {validationError && (
                    <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertWarning}`}>
                      ⚠️ {validationError}
                    </div>
                  )}

                  <form onSubmit={handleScrapeUrl} className="flex gap-2 mb-6">
                    <input
                      type="url"
                      placeholder="Paste OpTool link (Amazon, Target, Etsy, etc.)"
                      value={opToolUrl}
                      onChange={(e) => setOpToolUrl(e.target.value)}
                      required
                      disabled={operation.isWhiteElephant && userOpKit.length >= 1}
                      className={`flex-1 border rounded-2xl px-4 py-3 text-xs focus:outline-none ${theme.inputBg}`}
                    />
                    <button
                      type="submit"
                      disabled={scraping || (operation.isWhiteElephant && userOpKit.length >= 1)}
                      className={`px-5 py-3 rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                        operation.isWhiteElephant && userOpKit.length >= 1
                          ? 'bg-slate-400 text-slate-200 cursor-not-allowed'
                          : theme.btnPrimary
                      }`}
                    >
                      {scraping ? 'Scraping...' : '+ Add OpTool'}
                    </button>
                  </form>

                  {/* OpTools List */}
                  {userOpKit.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-stone-200/80 dark:border-slate-800 rounded-2xl">
                      <p className={`text-xs font-medium ${theme.textSubLabel}`}>Your OpKit is empty. Add an OpTool link above!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userOpKit.map((item) => (
                        <div key={item.id} className={`p-4 rounded-2xl border flex items-center justify-between ${theme.cardInnerBg}`}>
                          <div className="flex items-center gap-3">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.title} className="h-10 w-10 object-cover rounded-xl border" />
                            ) : (
                              <div className="h-10 w-10 rounded-xl bg-stone-200 dark:bg-slate-800 flex items-center justify-center text-lg">🛍️</div>
                            )}
                            <div>
                              <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-bold hover:underline block max-w-xs truncate">
                                {item.title}
                              </a>
                              {item.price && <span className={`text-xs font-mono font-bold ${theme.textAccent}`}>${item.price}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => { setValidationError(''); setUserOpKit((prev) => prev.filter((i) => i.id !== item.id)); }}
                            className="text-xs text-red-500 font-bold hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

                {/* Anonymous Intel Chat / Log Stream */}
                <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      💬 Anonymous Intel Messaging Stream
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">Encrypted Channel</span>
                  </div>

                  <div className={`p-4 rounded-2xl border max-h-48 overflow-y-auto space-y-3 mb-4 ${theme.cardInnerBg}`}>
                    {intelLogs.map((log) => (
                      <div key={log.id} className="text-xs">
                        <div className="flex items-center justify-between">
                          <strong className={theme.textAccent}>{log.sender}</strong>
                          <span className="text-[10px] text-slate-500">{log.time}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">{log.text}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendIntel} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Dispatch anonymous intel message..."
                      value={intelMessageText}
                      onChange={(e) => setIntelMessageText(e.target.value)}
                      required
                      className={`flex-1 border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                    />
                    <button
                      type="submit"
                      disabled={sendingIntel}
                      className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm ${theme.btnPrimary}`}
                    >
                      Send Intel
                    </button>
                  </form>
                </div>

              </div>

              {/* Right Column: Participant Roster & Shipping Status */}
              <div className="lg:col-span-5 space-y-6">
                <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
                  <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      👥 Enrolled Agents ({operation.agents?.length || 0})
                    </h2>
                    <div className="flex items-center gap-2">
                      {isOpsLeader && (
                        <button
                          onClick={() => setInviteModalOpen(true)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1 ${theme.btnPrimary}`}
                        >
                          <span>✉️ + Invite Agent</span>
                        </button>
                      )}
                      <span className={`text-xs font-mono font-bold px-2 py-1 rounded-md ${theme.badgeCode}`}>
                        Status: {operation.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {operation.agents?.map((agent, i) => (
                      <div key={agent.id} className={`p-4 rounded-2xl border space-y-2 text-xs ${theme.cardInnerBg}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className={`font-mono text-xs ${theme.textSubLabel}`}>#{i + 1}</span>
                            <div>
                              <span className={`font-bold block text-sm ${theme.textLabel}`}>
                                {formatCodename(agent.user?.codename, agent.user?.name)}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  agent.role === 'OPS_LEADER' ? theme.badgeAmber : theme.badgeSecretSanta
                                }`}>
                                  {agent.role === 'OPS_LEADER' ? 'OpsLeader' : 'Agent'}
                                </span>
                                <span className={`text-[10px] font-mono font-bold ${theme.textSubLabel}`}>
                                  Shipping: {agent.shippingStatus}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* OpsLeader Agent Management Action Bar */}
                        {isOpsLeader && (
                          <div className="pt-2 border-t border-stone-200/80 dark:border-slate-800/80 flex items-center justify-between gap-1 flex-wrap">
                            <button
                              onClick={() => handleAgentAction('nudge_agent', agent)}
                              title="Send encrypted alert reminder"
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 hover:bg-sky-200 transition-all cursor-pointer"
                            >
                              🔔 Nudge
                            </button>

                             {operation.status !== 'RECRUITING' && (
                              <>
                                <button
                                  onClick={() => handleAgentAction('issue_demerit', agent)}
                                  title="Issue 1-point Demerit citation"
                                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-200 transition-all cursor-pointer"
                                >
                                  ⚠️ Citation
                                </button>

                                <button
                                  onClick={() => handleAgentAction('update_agent_role', agent, {
                                    newRole: agent.role === 'OPS_LEADER' ? 'FIELD_AGENT' : 'OPS_LEADER'
                                  })}
                                  title="Toggle OpsLeader Clearance"
                                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-stone-300 dark:border-slate-700 hover:bg-stone-200 transition-all cursor-pointer"
                                >
                                  {agent.role === 'OPS_LEADER' ? '🔻 Demote' : '⭐ Promote'}
                                </button>
                              </>
                            )}

                            {agent.userId !== operation.opsLeaderId && (
                              <button
                                onClick={() => handleAgentAction('remove_agent', agent)}
                                title="Disenroll agent from operation"
                                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 hover:bg-red-200 transition-all cursor-pointer"
                              >
                                ❌ Disenroll
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* POST-EVENT AFTER-ACTION REPORT (AAR) SECTION */}
              {operation.status === 'COMPLETED' && (
                <div className="pt-6">
                  <AfterActionReportSection
                    operationId={operation.id}
                    currentUserId={userId || ''}
                    reports={operation.afterActionReports || []}
                    onReportPosted={() => fetchExchangeDetails()}
                  />
                </div>
              )}

            </div>

          </div>
        ) : null}

      </main>

      {/* MODAL: OPSLEADER EDIT OPERATION OPTIONS & LOCAL EVENT */}
      {editSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-lg w-full transition-all max-h-[90vh] overflow-y-auto ${theme.modalBg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>⚙️ Edit Operation Options</span>
              </h3>
              <button onClick={() => setEditSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            {settingsError && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertError}`}>
                ⚠️ {settingsError}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-semibold">
              
              {/* Read-Only Locked Gifting Type Badge */}
              <div className={`p-3 rounded-2xl border ${theme.cardInnerBg}`}>
                <span className="text-[11px] text-slate-400 block mb-1 uppercase font-bold">
                  🔒 Locked Gifting Type (Immutable)
                </span>
                <span className={`text-xs px-3 py-1 rounded-full uppercase inline-block ${
                  operation?.isWhiteElephant ? theme.badgeWhiteElephant : theme.badgeSecretSanta
                }`}>
                  {operation?.isWhiteElephant ? '🐘 White Elephant' : '🎁 Secret Santa'}
                </span>
                <p className="text-[10px] text-slate-500 mt-1">
                  Operation gifting type cannot be converted once created.
                </p>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Operation Title *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Mission Instructions / Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Optional mission notes or guidelines..."
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Min Budget ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={editBudgetMin}
                    onChange={(e) => setEditBudgetMin(Number(e.target.value))}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Max Budget ($) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editBudgetMax}
                    onChange={(e) => setEditBudgetMax(Number(e.target.value))}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Max Participant Limit (Optional)</label>
                <input
                  type="number"
                  min={2}
                  placeholder="Leave empty for unlimited"
                  value={editMaxParticipants || ''}
                  onChange={(e) => setEditMaxParticipants(e.target.value ? Number(e.target.value) : undefined)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              {/* Local In-Person Event Configuration Toggle */}
              <div className={`p-4 rounded-2xl border space-y-3 ${theme.cardInnerBg}`}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setEditIsLocalOnly(!editIsLocalOnly)}>
                  <div>
                    <span className="font-bold text-sm block">📍 Local In-Person Event</span>
                    <span className="text-[11px] text-slate-500 block">
                      Enable if this exchange is taking place at a physical party or location.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editIsLocalOnly}
                    onChange={(e) => setEditIsLocalOnly(e.target.checked)}
                    className="h-5 w-5 rounded accent-red-600 dark:accent-sky-400 cursor-pointer"
                  />
                </div>

                {editIsLocalOnly && (
                  <div className="pt-2 border-t border-stone-200 dark:border-slate-800">
                    <label className="block text-slate-500 mb-1">Event Location Address *</label>
                    <input
                      type="text"
                      required={editIsLocalOnly}
                      placeholder="e.g. 123 Holly Lane, Tacoma, WA 98402"
                      value={editEventLocation}
                      onChange={(e) => setEditEventLocation(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none ${theme.inputModalBg}`}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditSettingsModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${theme.btnNeutral}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${theme.btnPrimary}`}
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: OPSLEADER EDIT TIMELINE DATES */}
      {editDatesModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full transition-all max-h-[90vh] overflow-y-auto ${theme.modalBg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>✏️ Adjust Operational Timeline</span>
              </h3>
              <button onClick={() => setEditDatesModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              As OpsLeader, customize timeline dates for this operation. All dates MUST fall between current day and Execution Date.
            </p>

            {dateError && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertError}`}>
                ⚠️ {dateError}
              </div>
            )}

            <form onSubmit={handleSaveDates} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">Stage 1: Go/No-Go Date (Invite Cutoff) *</label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  max={editExecDate || undefined}
                  value={editCutoffDate}
                  onChange={(e) => setEditCutoffDate(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Stage 2: Target Assignment Date (Sattolo Draw) *</label>
                <input
                  type="date"
                  required
                  min={editCutoffDate || todayStr}
                  max={editExecDate || undefined}
                  value={editAssignDate}
                  onChange={(e) => setEditAssignDate(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Stage 3: Gift Shipping Deadline *</label>
                <input
                  type="date"
                  required
                  min={editAssignDate || todayStr}
                  max={editExecDate || undefined}
                  value={editShipDate}
                  onChange={(e) => setEditShipDate(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Stage 4: Exchange Execution Date (Event Day) *</label>
                <input
                  type="date"
                  required
                  min={editShipDate || todayStr}
                  value={editExecDate}
                  onChange={(e) => setEditExecDate(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditDatesModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${theme.btnNeutral}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDates}
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${theme.btnPrimary}`}
                >
                  {savingDates ? 'Saving...' : 'Save Timeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECRUIT FIELD AGENT */}
      <InviteAgentModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        operationId={operation?.id || ''}
        operationTitle={operation?.title || ''}
        opsLeaderUserId={userId || ''}
        onSuccess={() => fetchExchangeDetails()}
      />

      {/* MODAL: PREVENTATIVE MATCH RULES */}
      {operation && userId && (
        <PreventativeMatchModal
          isOpen={preventativeModalOpen}
          onClose={() => setPreventativeModalOpen(false)}
          operationId={operation.id}
          opsLeaderUserId={userId}
          agents={operation.agents.map((a) => ({
            id: a.userId,
            name: a.user?.name || a.userId,
            codename: a.user?.codename,
          }))}
          exclusionRules={operation.exclusionRules || []}
          onExclusionsUpdated={() => fetchExchangeDetails()}
        />
      )}

      {/* MODAL: MANAGE ASSIGNMENTS & TARGET SWAPS */}
      {operation && userId && (
        <ManageAssignmentsModal
          isOpen={manageAssignmentsModalOpen}
          onClose={() => setManageAssignmentsModalOpen(false)}
          operationId={operation.id}
          opsLeaderUserId={userId}
          agents={operation.agents.map((a) => ({
            id: a.id,
            userId: a.userId,
            user: {
              id: a.user?.id || a.userId,
              name: a.user?.name || a.userId,
              codename: a.user?.codename,
            },
            targetUserId: a.targetUserId,
            targetUser: a.targetUser,
            wishlistId: a.id,
          }))}
          exclusionRules={operation.exclusionRules || []}
          onAssignmentsUpdated={() => fetchExchangeDetails()}
        />
      )}

      {/* MODAL: OPTEAM BROADCAST */}
      {operation && userId && (
        <OpTeamBroadcastModal
          isOpen={broadcastModalOpen}
          onClose={() => setBroadcastModalOpen(false)}
          operationId={operation.id}
          operationTitle={operation.title}
          opsLeaderUserId={userId}
          onSuccess={() => fetchExchangeDetails()}
        />
      )}

    </div>
  );
}
