'use client';

import { USER_ID_KEY } from '@/lib/constants/auth';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCodename, formatDateString, getNextMilestoneCountdown } from '@/lib/security';
import { stageCardClass, stagePillClass, stageState, statusBadgeClass, type MissionStage } from '@/lib/stage-colors';
import { useTheme } from '@/context/ThemeContext';
import { evaluateDrawFeasibility, FieldAgent, ExclusionRuleInput } from '@/lib/draw';
import { InviteAgentModal } from '@/components/InviteAgentModal';
import { InvitedAgentsList } from '@/components/InvitedAgentsList';
import { PreventativeMatchModal, OperationExclusionRule } from '@/components/PreventativeMatchModal';
import { ManageAssignmentsModal } from '@/components/ManageAssignmentsModal';
import { OpTeamBroadcastModal } from '@/components/OpTeamBroadcastModal';
import { CompleteOperationModal } from '@/components/CompleteOperationModal';
import { MissionCancelModal } from '@/components/MissionCancelModal';
import { actorLabel, canCancelMission, deletionSchedule } from '@/lib/mission-cancel';
import { AfterActionReportSection, AARReportEntry } from '@/components/AfterActionReportSection';
import { ShippingConfirmationModal } from '@/components/ShippingConfirmationModal';
import { WishlistItemModal } from '@/components/WishlistItemModal';
import type { WishlistRules } from '@/lib/mission-wishlist';

/** Dollars with cents, e.g. `$25.00`. */
const formatMoney = (dollars: number) => `$${Number(dollars).toFixed(2)}`;
import { detectCarrier } from '@/lib/carrier-tracking';
import { UserDossierPreferences } from '@/lib/product-intelligence';
import { resolveExchangeCode } from '@/lib/exchange-route';
import { INTEL_MESSAGE_MAX_CHARS, type IntelSide, type MessageChannelName, type MessageView } from '@/lib/intel-messages';


interface OperationAgent {
  id: string;
  userId: string;
  role: string;
  shippingStatus: string;
  trackingNumber?: string;
  targetUserId?: string;
  wishlistId?: string;
  /** Mission codename, assigned at join. */
  codename?: string;
  /** Present only on the viewer's own membership. */
  codenameAccepted?: boolean;
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
    topHalfSize?: string;
    bottomHalfSize?: string;
    shoeSize?: string;
    chestBustMeasurement?: string;
    waistMeasurement?: string;
    inseamMeasurement?: string;
    favoriteColors?: string;
    allergiesDiet?: string;
    favoriteHobbies?: string;
    wishlistItems?: Array<{
      id: string;
      title: string;
      price?: number;
      url: string;
      thumbnail?: string;
      description?: string;
      properties?: {
        isPersonalized?: boolean;
        details?: Array<{ label: string; value: string }>;
        [key: string]: any;
      };
    }>;
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
  enforcePenalties?: boolean;
  /** Head Elf toggle: may a wishlist total more than `budgetMax`? Missing means yes. */
  allowWishlistOverBudget?: boolean;
  organizerId?: string;
  opsLeaderId?: string;
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
  members?: OperationAgent[];
  agents?: OperationAgent[];
  exclusionRules?: OperationExclusionRule[];
  reports?: AARReportEntry[];
  afterActionReports?: AARReportEntry[];
  /** Set once the mission is cancelled (status CANCELLED). */
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  cancelledFromStatus?: string | null;
}

export default function OperationCommandCenterPage() {
  const params = useParams();
  const router = useRouter();
  // The SaaS static export serves one shell page for every mission, so useParams() says 'preview'
  // there; the browser URL carries the real code (src/lib/exchange-route.ts).
  const code = resolveExchangeCode(params?.code, typeof window !== 'undefined' ? window.location.pathname : null);

  const { isDarkMode, toggleTheme, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<OperationData | null>(null);

  // Current User Session
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  // Invite Agent Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  // Elf Agents roster: invited (not yet enrolled) agents, reloaded after the modal sends one
  const [invitesRefreshKey, setInvitesRefreshKey] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [preventativeModalOpen, setPreventativeModalOpen] = useState(false);
  const [manageAssignmentsModalOpen, setManageAssignmentsModalOpen] = useState(false);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  // Head Elf cancel / delete dialog (src/components/MissionCancelModal.tsx)
  const [missionActionMode, setMissionActionMode] = useState<'cancel' | 'delete' | null>(null);
  const [shippingModalOpen, setShippingModalOpen] = useState(false);

  // Join / Auth Modal State for Unauthenticated / Non-Enrolled Users
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [enlisting, setEnlisting] = useState(false);
  const [enlistError, setEnlistError] = useState('');

  // Pending email invitation to this mission for the signed-in, not-yet-enrolled user (/api/invitations)
  const [myInvitation, setMyInvitation] = useState<{ id: string; organizerName: string } | null>(null);
  const [inviteDeclined, setInviteDeclined] = useState(false);
  const inviteExchangeId = operation?.id;
  const inviteNeedsAnswer = Boolean(userId && operation && !(operation.members || operation.agents || []).some((m) => m.userId === userId));
  useEffect(() => {
    if (!inviteExchangeId || !inviteNeedsAnswer) return;
    let cancelled = false;
    fetch('/api/invitations')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const match = (json.invitations || []).find((inv: { exchange: { id: string } }) => inv.exchange.id === inviteExchangeId);
        setMyInvitation(match ? { id: match.id, organizerName: match.exchange.organizer?.name || 'the Head Elf' } : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [inviteExchangeId, inviteNeedsAnswer]);

  async function handleDeclineInvitation() {
    if (!myInvitation) return;
    setEnlistError('');
    try {
      const res = await fetch('/api/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: myInvitation.id, action: 'decline' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not decline the invitation');
      setMyInvitation(null);
      setInviteDeclined(true);
    } catch (err) {
      setEnlistError(err instanceof Error ? err.message : 'Could not decline the invitation');
    }
  }

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
  const [editAllowOverBudget, setEditAllowOverBudget] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // Wishlist Manifest state
  const [userManifest, setUserManifest] = useState<Array<{
    id: string;
    title: string;
    price?: number;
    url: string;
    thumbnail?: string;
    description?: string;
    properties?: {
      isPersonalized?: boolean;
      details?: Array<{ label: string; value: string }>;
      [key: string]: any;
    };
  }>>([]);
  const [validationError, setValidationError] = useState('');

  // Item Customization & Review Modal State
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalMode, setItemModalMode] = useState<'add' | 'edit'>('add');
  const [itemModalKind, setItemModalKind] = useState<'store' | 'personalized'>('store');
  const [itemModalData, setItemModalData] = useState<any>(null);
  const [userDossier, setUserDossier] = useState<UserDossierPreferences | undefined>(undefined);
  const [wishlistRules, setWishlistRules] = useState<WishlistRules | null>(null);
  const [codenameBusy, setCodenameBusy] = useState(false);

  const feasibility = useMemo(() => {
    if (!operation) return null;
    const memberList = operation.members || operation.agents || [];
    const fieldAgents: FieldAgent[] = memberList.map((m) => ({
      id: m.userId,
      name: m.user?.name || m.user?.codename || m.userId,
      codename: m.user?.codename,
      hasWishlistAttached: true,
    }));
    const exclusionInputs: ExclusionRuleInput[] = (operation.exclusionRules || []).map((r) => ({
      agentId: r.agentId,
      restrictedAgentId: r.restrictedAgentId,
    }));
    return evaluateDrawFeasibility(fieldAgents, exclusionInputs);
  }, [operation]);

  // Mission messaging (/api/messages): Command (Head Elf <-> agent), Intel (Santa <-> target, Santa
  // anonymous) and Debrief (whole mission, after completion). The server decides what is readable.
  const [intelMessageText, setIntelMessageText] = useState('');
  const [sendingIntel, setSendingIntel] = useState(false);
  const [msgTab, setMsgTab] = useState<MessageChannelName>('command');
  const [intelSide, setIntelSide] = useState<IntelSide>('target');
  const [commandWith, setCommandWith] = useState('');
  const [msgData, setMsgData] = useState({
    messages: [] as MessageView[],
    hasTarget: false,
    hasSanta: false,
    canSendCommand: false,
    canSendIntel: false,
    canSendDebrief: false,
    debriefOpenUntil: null as string | null,
    commandRecipients: [] as Array<{ userId: string; codename: string }>,
  });
  const [intelError, setIntelError] = useState('');

  useEffect(() => {
    async function initSession() {
      try {
        const res = await fetch('/api/users/me');
        const json = await res.json();
        if (res.ok && json.authenticated && json.user) {
          setUserId(json.user.id);
          setUserName(json.user.name);
          localStorage.setItem(USER_ID_KEY, json.user.id);
          localStorage.setItem('kovertklaus_user_name', json.user.name);

          setUserDossier({
            topHalfSize: json.user.topHalfSize || json.user.shirtSize,
            bottomHalfSize: json.user.bottomHalfSize,
            shoeSize: json.user.shoeSize,
            waistMeasurement: json.user.waistMeasurement,
            inseamMeasurement: json.user.inseamMeasurement,
            favoriteColors: json.user.favoriteColors,
            allergiesDiet: json.user.allergiesDiet,
            favoriteHobbies: json.user.favoriteHobbies,
          });

        } else {
          // The server says the session is gone (expired or signed out): forget the cached
          // identity so the page offers sign-in instead of acting on a dead session.
          localStorage.removeItem(USER_ID_KEY);
          localStorage.removeItem('kovertklaus_user_name');
        }
      } catch {
        const savedUserId = localStorage.getItem(USER_ID_KEY);
        const savedUserName = localStorage.getItem('kovertklaus_user_name');
        if (savedUserId) setUserId(savedUserId);
        if (savedUserName) setUserName(savedUserName);
      }
      fetchExchangeDetails();
    }

    initSession();
  }, [code]);

  /** Rerolls or accepts the viewer's mission codename via `/api/codename`. */
  async function updateCodename(action: 'reroll' | 'accept') {
    if (!operation) return;
    setCodenameBusy(true);
    try {
      const res = await fetch('/api/codename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchangeId: operation.id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Codename update failed');
      const patch = (m: OperationAgent) =>
        m.userId === userId ? { ...m, codename: json.codename, codenameAccepted: json.accepted, user: m.user && { ...m.user, codename: json.codename } } : m;
      setOperation((prev) => prev && { ...prev, members: prev.members?.map(patch), agents: prev.agents?.map(patch) });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Codename update failed');
    } finally {
      setCodenameBusy(false);
    }
  }

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
    setEditAllowOverBudget(op.allowWishlistOverBudget !== false);
  }

  // Handle Enlistment Authentication (Register / Sign In with Invite Code)
  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!operation) return;
    setAuthLoading(true);
    setAuthError('');

    try {
      if (authMode === 'register') {
        const regRes = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: authName.trim(),
            email: authEmail.trim(),
            password: authPassword,
            inviteCode: operation.code,
          }),
        });

        const regData = await regRes.json();
        if (!regRes.ok || !regData.success) {
          throw new Error(regData.error || 'Registration failed');
        }

        const newUser = regData.data;
        setUserId(newUser.id);
        setUserName(newUser.name);
        localStorage.setItem(USER_ID_KEY, newUser.id);
        localStorage.setItem('kovertklaus_user_name', newUser.name);
        setAuthModalOpen(false);
        await fetchExchangeDetails();
      } else {
        const loginRes = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok || !loginData.success) {
          throw new Error(loginData.error || 'Invalid credentials');
        }

        const loggedUser = loginData.user;
        setUserId(loggedUser.id);
        setUserName(loggedUser.name);
        localStorage.setItem(USER_ID_KEY, loggedUser.id);
        localStorage.setItem('kovertklaus_user_name', loggedUser.name);

        const joinRes = await fetch('/api/invitations/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: loggedUser.id, operationCode: operation.code }),
        });
        const joinData = await joinRes.json().catch(() => ({}));
        if (!joinRes.ok && !joinData.error?.includes('already enrolled')) {
          console.warn('[Enlist Warning]', joinData.error);
        }

        setAuthModalOpen(false);
        await fetchExchangeDetails();
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error');
    } finally {
      setAuthLoading(false);
    }
  }

  // Handle Quick Enlistment for Authenticated Users
  async function handleEnlistCurrentSession() {
    if (!userId || !operation) return;
    setEnlisting(true);
    setEnlistError('');

    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, operationCode: operation.code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (!data.error?.includes('already enrolled')) {
          throw new Error(data.error || 'Failed to enlist in exchange');
        }
      }
      await fetchExchangeDetails();
    } catch (err: any) {
      setEnlistError(err.message || 'Enlistment failed');
    } finally {
      setEnlisting(false);
    }
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
            allowWishlistOverBudget: editAllowOverBudget,
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

  /** Cancels or deletes the mission (Head Elf); throws the server's message for the dialog. */
  async function handleMissionAction(mode: 'cancel' | 'delete', reason: string) {
    if (!operation) return;
    const res = await fetch('/api/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        mode === 'cancel'
          ? { action: 'cancelMission', operationId: operation.id, reason }
          : { action: 'deleteMission', operationId: operation.id, confirm: true }
      ),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || (mode === 'cancel' ? 'Could not cancel the mission' : 'Could not delete the mission'));
    setMissionActionMode(null);
    if (mode === 'delete') {
      router.push('/dashboard');
    } else {
      fetchExchangeDetails();
    }
  }

  // Handle Demerit Audit Execution (OpsLeader Only - Completed Missions with Demerits Enabled)
  async function handleRunDemeritAudit() {
    if (!operation || !userId) return;
    if (!confirm(`Execute Demerit & Auto-Rehabilitation Audit for "${operation.title}"? Operatives who did not fulfill their mission without carrier tracking will receive 1 Coal Citation.`)) return;

    try {
      const res = await fetch('/api/demerits/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: operation.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to run demerit audit');
      alert('⚖️ Demerit audit executed successfully! Participant citations and clearances have been recorded.');
      fetchExchangeDetails();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Audit failed';
      alert(msg);
    }
  }

  /** Switches Mission Comms to a conversation and scrolls it into view (roster shortcuts). */
  function openComms(thread: 'command' | 'intel-target' | 'intel-santa') {
    if (thread === 'command') {
      setMsgTab('command');
    } else {
      setMsgTab('intel');
      setIntelSide(thread === 'intel-target' ? 'target' : 'santa');
    }
    document.getElementById('mission-comms')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Opens the add form for the gift type the agent picked: store-bought (link + Get Data) or personalized. */
  function openAddItem(kind: 'store' | 'personalized') {
    setValidationError('');
    if (operation?.isWhiteElephant && userManifest.length >= 1) {
      setValidationError('🐘 A White Elephant list holds exactly 1 gift, the one you are bringing.');
      return;
    }
    setItemModalKind(kind);
    setItemModalMode('add');
    setItemModalData(null);
    setItemModalOpen(true);
  }

  // Remove a Manifest Item from the agent's Wishlist Manifest (server first, then local state)
  async function handleRemoveManifestItem(itemId: string) {
    setValidationError('');
    try {
      if (!operation) return;
      const res = await fetch(`/api/wishlist?exchangeId=${encodeURIComponent(operation.id)}&itemId=${encodeURIComponent(itemId)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to remove Manifest Item');
      setUserManifest((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err: any) {
      setValidationError(err?.message || 'Failed to remove Manifest Item');
    }
  }

  function handleItemSaveSuccess(savedItem: any) {
    if (!savedItem) return;
    setUserManifest((prev) => {
      const exists = prev.some((i) => i.id === savedItem.id);
      if (exists) {
        return prev.map((i) => (i.id === savedItem.id ? savedItem : i));
      }
      return [...prev, savedItem];
    });
  }

  // Refresh messages when the mission loads, then every minute while the page is open
  const intelExchangeId = operation?.id;
  const intelEnrolled = Boolean(userId && (operation?.members || operation?.agents || []).some((m) => m.userId === userId));

  // The agent's Wishlist Manifest belongs to this mission; load it with the mission's price rules,
  // again whenever the Head Elf changes the budget or the over-limit toggle.
  const wishlistBudgetMax = operation?.budgetMax;
  const wishlistAllowOver = operation?.allowWishlistOverBudget;
  useEffect(() => {
    if (!intelExchangeId || !intelEnrolled) return;
    let cancelled = false;
    fetch(`/api/wishlist?exchangeId=${encodeURIComponent(intelExchangeId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success) return;
        setUserManifest(json.wishlist.items);
        setWishlistRules(json.rules);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [intelExchangeId, intelEnrolled, wishlistBudgetMax, wishlistAllowOver]);
  useEffect(() => {
    if (!intelExchangeId || !intelEnrolled) return;
    let cancelled = false;
    const load = () =>
      fetch(`/api/messages?exchangeId=${encodeURIComponent(intelExchangeId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (cancelled || !json) return;
          setMsgData({
            messages: json.messages || [],
            hasTarget: Boolean(json.hasTarget),
            hasSanta: Boolean(json.hasSanta),
            canSendCommand: Boolean(json.canSendCommand),
            canSendIntel: Boolean(json.canSendIntel),
            canSendDebrief: Boolean(json.canSendDebrief),
            debriefOpenUntil: json.debriefOpenUntil ?? null,
            commandRecipients: json.commandRecipients || [],
          });
        })
        .catch(() => {
          // Network blip: keep the last loaded conversations
        });
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intelExchangeId, intelEnrolled]);

  // The open conversation. An agent's Command peer is always the Head Elf; the Head Elf picks an agent.
  const commandPeer = commandWith || msgData.commandRecipients[0]?.userId || '';
  const activeThread = msgTab === 'intel' ? `intel:${intelSide}` : msgTab === 'command' ? `command:${commandPeer}` : 'debrief';
  const activeCanSend =
    msgTab === 'command'
      ? msgData.canSendCommand && Boolean(commandPeer)
      : msgTab === 'intel'
      ? msgData.canSendIntel && (intelSide === 'target' ? msgData.hasTarget : msgData.hasSanta)
      : msgData.canSendDebrief;

  // Handle message dispatch on the open conversation
  async function handleSendIntel(e: React.FormEvent) {
    e.preventDefault();
    const text = intelMessageText.trim();
    if (!text || !operation) return;

    setSendingIntel(true);
    setIntelError('');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchangeId: operation.id,
          channel: msgTab,
          to: msgTab === 'intel' ? intelSide : msgTab === 'command' ? commandPeer : undefined,
          text,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Message failed to send');
      setMsgData((prev) => ({ ...prev, messages: [...prev.messages, json.message] }));
      setIntelMessageText('');
    } catch (err) {
      setIntelError(err instanceof Error ? err.message : 'Message failed to send');
    } finally {
      setSendingIntel(false);
    }
  }

  // Handle OpsLeader Agent Management Actions
  async function handleAgentAction(
    actionType: 'remove_agent' | 'issue_demerit' | 'nudge_agent',
    agent: any
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
  const membersList = operation?.members || operation?.agents || [];
  const organizerData = operation?.organizer || operation?.opsLeader;
  const organizerIdVal = operation?.organizerId || operation?.opsLeaderId;
  const currentAgent = membersList.find((a) => a.userId === userId);

  // Wishlist price rules for display; the server enforces the same rules on every save.
  const itemMax = wishlistRules?.itemMax ?? operation?.budgetMax ?? 0;
  const wishlistTotalMax = wishlistRules ? wishlistRules.totalMax : operation?.allowWishlistOverBudget === false ? operation.budgetMax : null;
  const wishlistTotal = userManifest.reduce((sum, i) => sum + (i.price || 0), 0);
  const wishlistOverTotal = wishlistTotalMax !== null && Math.round(wishlistTotal * 100) > Math.round(wishlistTotalMax * 100);
  const organizerCodename = membersList.find((a) => a.userId === organizerIdVal)?.codename;
  const canRerollCodename = Boolean(currentAgent && !currentAgent.codenameAccepted && operation?.status === 'RECRUITING');
  // A mission has exactly one Head Elf: the organizer. Leader promotion is not a feature yet.
  const isOpsLeader = Boolean(userId && organizerIdVal === userId);

  // Roster. Before the draw everyone sees every agent. After it, an agent sees only who they can
  // message: the Head Elf, their target, and their Secret Santa as an anonymous row (the Santa
  // stays secret). The Head Elf keeps the full roster to manage the mission, with their own
  // target and Santa marked (they can already see every assignment).
  const myTargetId = currentAgent?.targetUserId ?? null;
  const mySantaId = isOpsLeader
    ? membersList.find((a) => a.targetUserId === userId)?.userId ?? null
    : null;
  const rosterNarrowed = Boolean(myTargetId) && !isOpsLeader;
  const rosterAgents = rosterNarrowed
    ? membersList.filter((a) => a.userId === organizerIdVal || a.userId === myTargetId)
    : membersList;
  const assignedTarget = currentAgent?.targetUser;
  // Current timeline stage: colors the status badge and the 4-stage timeline (src/lib/stage-colors.ts).
  const missionPhase = getNextMilestoneCountdown(operation);
  const todayStr = new Date().toISOString().split('T')[0];

  // Timeline edit rules (server: src/lib/validations/timeline.ts): a date you change must be after
  // today and after the stage before it; a date you leave alone may already be in the past.
  const dayOf = (d?: string | null) => (d ? new Date(d).toISOString().split('T')[0] : '');
  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  function editMin(original: string | null | undefined, current: string, previous?: string): string | undefined {
    if (current === dayOf(original)) return undefined;
    if (!previous) return tomorrowStr;
    const dayAfterPrevious = new Date(new Date(`${previous}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return dayAfterPrevious > tomorrowStr ? dayAfterPrevious : tomorrowStr;
  }

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
      
      {/* Top Header Navigation */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md ${theme.headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between">
          <Link href="/operations" className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center font-extrabold text-lg sm:text-xl shadow-md shrink-0 bg-kk-primary text-kk-on-primary border border-kk-border-strong">
              🎁
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black tracking-tight block">KovertKlaus</span>
              <span className={`text-[10px] sm:text-xs font-bold hidden sm:block ${theme.textGoldOnDark}`}>
                Operation Command Center
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={toggleTheme}
              className={`p-2 min-h-[44px] min-w-[44px] rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center ${theme.btnToggle}`}
              title={isDarkMode ? 'Switch to Klaus Mode' : 'Switch to Kovert Mode'}
            >
              <span className="sm:hidden text-base">{isDarkMode ? '🎅' : '🕶️'}</span>
              <span className="hidden sm:inline">{isDarkMode ? '🎅 Klaus Mode' : '🕶️ Kovert Mode'}</span>
            </button>

            {userId ? (
              <>
                <Link
                  href="/operations"
                  className={`text-xs font-bold px-3 sm:px-4 py-2 min-h-[44px] flex items-center rounded-xl transition-all shadow-sm ${theme.btnPrimary}`}
                >
                  <span className="sm:hidden">← Ops</span>
                  <span className="hidden sm:inline">← Operations Center</span>
                </Link>

                <button
                  onClick={handleSignOut}
                  className={`text-xs font-bold px-3 sm:px-4 py-2 min-h-[44px] flex items-center rounded-xl transition-all shadow-sm cursor-pointer ${theme.btnNeutral}`}
                >
                  <span className="sm:hidden">Exit</span>
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/"
                  className={`text-xs font-bold px-3 sm:px-4 py-2 min-h-[44px] flex items-center rounded-xl transition-all shadow-sm ${theme.btnNeutral}`}
                >
                  <span>🏠 Home</span>
                </Link>
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); setAuthModalOpen(true); }}
                  className={`text-xs font-bold px-3 sm:px-4 py-2 min-h-[44px] flex items-center rounded-xl transition-all shadow-sm cursor-pointer ${theme.btnPrimary}`}
                >
                  <span>🔑 Sign In</span>
                </button>
              </>
            )}
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
            <p className="text-xs text-kk-muted mb-6">{error}</p>
            <Link href="/operations" className={`px-6 py-3 font-bold text-xs rounded-xl ${theme.btnPrimary}`}>
              Return to Operations Center
            </Link>
          </div>
        ) : operation ? (
          <div className="space-y-8">

            {/* Cancelled mission: read-only, with the deletion schedule for the Head Elf */}
            {operation.status === 'CANCELLED' && (() => {
              const schedule = deletionSchedule({
                status: operation.status,
                cancelledAt: operation.cancelledAt ? new Date(operation.cancelledAt) : null,
                cancelledFromStatus: operation.cancelledFromStatus ?? null,
              });
              const by = operation.cancelledBy ? actorLabel(operation.cancelledBy) : 'the Head Elf';
              const deletable = Boolean(schedule.manualDeleteFrom && Date.now() >= schedule.manualDeleteFrom.getTime());
              return (
                <div className={`p-5 sm:p-6 rounded-3xl border shadow-lg ${theme.alertWarning}`}>
                  <h2 className="font-extrabold text-base">🛑 This mission was cancelled</h2>
                  <p className="text-sm mt-1">
                    Cancelled by {by}{operation.cancelledAt ? ` on ${new Date(operation.cancelledAt).toLocaleString()}` : ''}.
                    {operation.cancelReason ? ` Reason: "${operation.cancelReason}".` : ''}
                  </p>
                  <p className="text-sm mt-1 font-bold">The mission is read-only. If there is any data you&apos;d like to save, please save it now.</p>
                  {isOpsLeader && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                      {schedule.manualDeleteFrom ? (
                        <>
                          <span>
                            {deletable
                              ? 'You can now delete it permanently.'
                              : `You can delete it permanently from ${schedule.manualDeleteFrom.toLocaleString()}.`}
                            {schedule.purgeOn ? ` Otherwise it is deleted automatically on ${schedule.purgeOn.toLocaleDateString()}.` : ''}
                          </span>
                          {deletable && (
                            <button
                              onClick={() => setMissionActionMode('delete')}
                              className="px-4 py-2 min-h-[44px] rounded-xl font-extrabold cursor-pointer bg-kk-danger-soft text-kk-on-danger-soft border-2 border-kk-danger"
                            >
                              🗑️ Delete permanently
                            </button>
                          )}
                        </>
                      ) : (
                        <span>
                          It was cancelled after the draw, so it is deleted automatically on {schedule.purgeOn?.toLocaleDateString()}. Save anything you need before then.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Primary Operation Banner */}
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-kk-header text-kk-on-header border-kk-border-strong/50`}>
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

                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${statusBadgeClass(missionPhase)}`}>
                    ● {missionPhase.phaseStatusLabel}
                  </span>

                  {operation.isLocalOnly && (
                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${theme.badgeAmber}`}>
                      📍 Local In-Person Event
                    </span>
                  )}

                  <span className="text-xs font-semibold text-kk-header-nav">
                    Head Elf: <strong className="text-kk-on-header">{organizerData?.name || 'Organizer'} ({formatCodename(organizerCodename, organizerData?.name)})</strong>
                  </span>
                </div>

                <h1 className="text-3xl font-black text-kk-on-header">{operation.title}</h1>
                
                {operation.description && (
                  <p className="text-xs mt-1 italic text-kk-on-header/90">
                    "{operation.description}"
                  </p>
                )}

                <div className="text-xs mt-2 space-y-0.5 text-kk-on-header/90">
                  <p>
                    Budget Limit: <strong className="text-kk-header-nav font-bold">${operation.budgetMin || 0} – ${operation.budgetMax} {operation.currency}</strong>
                  </p>
                  {operation.isLocalOnly && operation.eventLocation && (
                    <p className="font-bold text-kk-on-header">
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
                  className={`px-5 py-3 rounded-2xl font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${theme.btnAmber}`}
                >
                  <span>📋 Copy Invite Code ({operation.code})</span>
                </button>
              </div>
            </div>

            {/* Enrollment / Invitation Banner for Non-Enrolled Visitors */}
            {!currentAgent && (
              <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl transition-all ${theme.cardInnerBg} ${
                operation.status === 'RECRUITING' ? 'border-kk-border-strong' : 'border-kk-border'
              }`}>
                {enlistError && (
                  <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertError}`}>
                    ⚠️ {enlistError}
                  </div>
                )}

                {operation.status === 'RECRUITING' ? (
                  !userId ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🎄</span>
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-kk-gold-ink">
                            You've Been Invited to Join This Mission!
                          </span>
                        </div>
                        <h2 className="text-xl font-black mt-1">
                          Enlist in {operation.title}
                        </h2>
                        <p className={`text-xs mt-1 max-w-xl ${theme.textSubLabel}`}>
                          Sign in or create your operative profile with invite code <strong className="font-mono">{operation.code}</strong> to submit your wishlist manifest and enter the Secret Santa assignment draw.
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap shrink-0">
                        <button
                          onClick={() => { setAuthMode('register'); setAuthError(''); setAuthModalOpen(true); }}
                          className={`font-bold px-5 py-3 rounded-2xl text-xs transition-all shadow-md cursor-pointer ${theme.btnPrimary}`}
                        >
                          🎟️ Create Profile &amp; Enlist
                        </button>
                        <button
                          onClick={() => { setAuthMode('login'); setAuthError(''); setAuthModalOpen(true); }}
                          className={`font-bold px-5 py-3 rounded-2xl text-xs transition-all border cursor-pointer ${theme.btnSecondary}`}
                        >
                          🔑 Sign In &amp; Enlist
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🎁</span>
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-kk-brand">
                            {myInvitation ? `📩 Invited by ${myInvitation.organizerName}` : 'Operative Clearance Verified'}
                          </span>
                        </div>
                        <h2 className="text-xl font-black mt-1">
                          {myInvitation ? `You're invited to ${operation.title}` : `Enlist as Operative in ${operation.title}`}
                        </h2>
                        <p className={`text-xs mt-1 max-w-xl ${theme.textSubLabel}`}>
                          {inviteDeclined
                            ? 'You declined this invitation. You can still enlist while recruitment is open.'
                            : <>You are authenticated as <strong>{userName || 'Operative'}</strong>. {myInvitation ? 'Accept to' : 'Enlist now to'} submit your wishlist manifest and enter the Secret Santa assignment draw.</>}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={handleEnlistCurrentSession}
                          disabled={enlisting}
                          className={`font-bold px-6 py-3 rounded-2xl text-xs transition-all shadow-md cursor-pointer ${theme.btnPrimary}`}
                        >
                          {enlisting ? 'Enlisting...' : myInvitation ? '✅ Accept Invitation' : '🚀 Enlist in Mission Now'}
                        </button>
                        {myInvitation && (
                          <button
                            onClick={handleDeclineInvitation}
                            disabled={enlisting}
                            className={`font-bold px-4 py-3 rounded-2xl text-xs transition-all cursor-pointer ${theme.btnNeutral}`}
                          >
                            Decline
                          </button>
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔒</span>
                    <div>
                      <h3 className="font-bold text-sm">Recruitment Closed</h3>
                      <p className={`text-xs ${theme.textSubLabel}`}>
                        Recruitment for this mission has concluded. Target assignments have already been finalized.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mission codename: assigned at join, rerollable until accepted or recruiting closes */}
            {currentAgent && !currentAgent.codenameAccepted && (
              <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-kk-brand">🕶️ Your codename for this mission</span>
                    <p className="text-2xl font-black mt-1">{formatCodename(currentAgent.codename)}</p>
                    <p className="text-xs text-kk-muted mt-1">
                      {canRerollCodename
                        ? 'Not a fit? Draw another as often as you like. Once you accept, it stays for the whole mission.'
                        : 'Recruiting has closed, so this codename is final.'}
                    </p>
                  </div>
                  {canRerollCodename && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={codenameBusy}
                        onClick={() => updateCodename('reroll')}
                        className={`min-h-[44px] px-4 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50 ${theme.btnSecondary}`}
                      >
                        🎲 Draw another
                      </button>
                      <button
                        type="button"
                        disabled={codenameBusy}
                        onClick={() => updateCodename('accept')}
                        className={`min-h-[44px] px-4 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50 ${theme.btnPrimary}`}
                      >
                        ✓ Accept codename
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4-Stage Operational Timeline Cards */}
            <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
              <div className={`flex items-center justify-between ${theme.sectionBand}`}>
                <span className="text-sm font-black uppercase tracking-wider block">
                  📅 4-Stage Operational Timeline
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold">
                {([
                  { stage: 1, title: 'RSVP Cutoff Date', note: '(Final Headcount)', date: operation.inviteCutoffDate },
                  { stage: 2, title: 'Secret Santa Match', note: '(Targets Drawn)', date: operation.assignmentDate },
                  { stage: 3, title: "Santa's Sleigh Departure", note: '(Gifts In-Transit)', date: operation.shippingDate },
                  { stage: 4, title: 'Holiday Mission Exchange Party', note: '(Unwrapping Day)', date: operation.executionDate },
                ] as { stage: MissionStage; title: string; note: string; date: string }[]).map((s) => {
                  const state = stageState(s.stage, missionPhase.stage, missionPhase.isComplete);
                  const isCurrent = state === 'current';
                  return (
                    <div key={s.stage} className={`p-4 rounded-2xl transition-all ${stageCardClass(s.stage, state)}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] uppercase font-mono font-extrabold px-2 py-0.5 rounded-full ${isCurrent ? 'bg-kk-surface/25 border border-current' : stagePillClass(s.stage)}`}>
                          Stage {s.stage}
                        </span>
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wider">
                          {state === 'done' ? '✓ Done' : isCurrent ? '● Now' : 'Upcoming'}
                        </span>
                      </div>
                      <span className="font-bold block text-sm mt-2">{s.title}</span>
                      <span className={`text-[11px] block mt-0.5 ${isCurrent ? 'opacity-90' : theme.textSubLabel}`}>{s.note}</span>
                      <strong className="text-base font-black block mt-2">
                        {formatDateString(s.date)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* OpsLeader Administrative Control Console (Clean High-Contrast Theme) */}
            {isOpsLeader && (
              <div className={`p-6 rounded-3xl ${theme.consoleCard}`}>
                <div className={`flex items-center justify-between gap-3 ${theme.sectionBand}`}>
                  <div>
                    <span className="font-black tracking-wider uppercase text-lg">
                      🎖️ Head Elf Administrative Console
                    </span>
                    <p className="text-xs font-semibold mt-0.5 text-kk-on-header/90">
                      As the designated Head Elf, you control enrollment deadlines, operation options, target draws, and compliance logs.
                    </p>
                  </div>

                  <span className={`shrink-0 ${theme.consoleBadge}`}>
                    Head Elf Clearance
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
                    <div className="w-full space-y-3">
                      {/* Festive Live Feasibility Status Banner */}
                      {feasibility && (
                        <div
                          className={`p-3.5 rounded-2xl border text-xs font-mono transition-all ${
                            feasibility.themeColor === 'emerald'
                              ? 'bg-kk-success border-kk-on-success/30 text-kk-on-success'
                              : feasibility.themeColor === 'amber'
                              ? 'bg-kk-warning border-kk-border-strong text-kk-on-warning'
                              : 'bg-kk-danger-soft border-kk-danger/40 text-kk-on-danger-soft'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold text-xs">
                            <span className="flex items-center gap-1.5">{feasibility.headline}</span>
                            <span className="text-[10px] opacity-80 uppercase">
                              {(operation.members || operation.agents || []).length} / 4 Enlisted
                            </span>
                          </div>
                          <p className="text-[11px] mt-1 opacity-90 leading-snug">
                            {feasibility.message}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => setInviteModalOpen(true)} className={theme.btnSecondary}>
                          🚨 Emergency Invite
                        </button>
                        <button onClick={() => setPreventativeModalOpen(true)} className={theme.btnPurple}>
                          🚫 Matching Rules ({operation.exclusionRules?.length || 0})
                        </button>
                        <button
                          onClick={handleTriggerDraw}
                          disabled={drawingTargets || !feasibility?.isFeasible}
                          className={`${theme.btnEmerald} ${
                            !feasibility?.isFeasible ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          title={
                            !feasibility?.isFeasible
                              ? feasibility?.message || 'Draw is locked until requirements are satisfied.'
                              : 'Execute Sattolo cyclic derangement'
                          }
                        >
                          {drawingTargets ? 'Executing Draw...' : '🎯 Initiate Assignments'}
                        </button>
                      </div>
                    </div>
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
                      <button onClick={() => setCompleteModalOpen(true)} className={theme.btnPrimary}>
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
                      {operation.enforcePenalties !== false && (
                        <button onClick={handleRunDemeritAudit} className={theme.btnAmber}>
                          ⚖️ Audit Demerits
                        </button>
                      )}
                    </>
                  )}

                  {/* COMMON OPTIONS & TIMELINE EDITORS */}
                  {canCancelMission(operation.status) && (
                    <>
                      <button onClick={() => { setSettingsError(''); setEditSettingsModalOpen(true); }} className={theme.btnAmber}>
                        ⚙️ Edit Operation Options
                      </button>
                      <button onClick={() => { setDateError(''); setEditDatesModalOpen(true); }} className={theme.btnSky}>
                        📅 Edit Operation Timeline
                      </button>
                      <button
                        onClick={() => setMissionActionMode('cancel')}
                        className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-extrabold cursor-pointer bg-kk-danger-soft text-kk-on-danger-soft border-2 border-kk-danger"
                      >
                        🛑 Cancel Mission
                      </button>
                    </>
                  )}

                </div>
              </div>
            )}

            {/* 2-Column Command Center Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Target Assignment & Wishlist Manifest Workspace */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Secret Santa Target Assignment Card */}
                {!operation.isWhiteElephant && (
                  <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
                    <div className={`flex items-center justify-between gap-2 flex-wrap ${theme.sectionBand}`}>
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
                      <div className={`p-4 rounded-2xl border space-y-3 ${theme.cardInnerBg}`}>
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
                          <div className={`text-xs border-t border-kk-border pt-2 ${theme.textSubLabel}`}>
                            <span>Courier Address: </span>
                            <strong className={theme.textLabel}>{assignedTarget.streetAddress}, {assignedTarget.city}, {assignedTarget.state} {assignedTarget.zipCode}</strong>
                          </div>
                        )}

                        {/* Target Operative Dossier Intel */}
                        {(assignedTarget.topHalfSize || assignedTarget.bottomHalfSize || assignedTarget.shoeSize || assignedTarget.favoriteColors || assignedTarget.favoriteHobbies || assignedTarget.allergiesDiet) && (
                          <div className="pt-3 border-t border-kk-border space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-kk-muted font-mono block">
                              📋 Target Operative Dossier Intel
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {assignedTarget.topHalfSize && (
                                <div className="p-2 rounded-xl bg-kk-surface border border-kk-border text-xs shadow-sm">
                                  <span className="text-[10px] text-kk-muted block">Shirt / Top:</span>
                                  <span className="font-bold">{assignedTarget.topHalfSize}</span>
                                </div>
                              )}
                              {assignedTarget.bottomHalfSize && (
                                <div className="p-2 rounded-xl bg-kk-surface border border-kk-border text-xs shadow-sm">
                                  <span className="text-[10px] text-kk-muted block">Pants / Bottom:</span>
                                  <span className="font-bold">{assignedTarget.bottomHalfSize}</span>
                                </div>
                              )}
                              {assignedTarget.shoeSize && (
                                <div className="p-2 rounded-xl bg-kk-surface border border-kk-border text-xs shadow-sm">
                                  <span className="text-[10px] text-kk-muted block">Shoe Size:</span>
                                  <span className="font-bold">{assignedTarget.shoeSize}</span>
                                </div>
                              )}
                              {assignedTarget.favoriteColors && (
                                <div className="p-2 rounded-xl bg-kk-surface border border-kk-border text-xs shadow-sm">
                                  <span className="text-[10px] text-kk-muted block">Colors:</span>
                                  <span className="font-bold">{assignedTarget.favoriteColors}</span>
                                </div>
                              )}
                              {assignedTarget.favoriteHobbies && (
                                <div className="p-2 rounded-xl bg-kk-surface border border-kk-border text-xs shadow-sm">
                                  <span className="text-[10px] text-kk-muted block">Hobbies:</span>
                                  <span className="font-bold">{assignedTarget.favoriteHobbies}</span>
                                </div>
                              )}
                              {assignedTarget.allergiesDiet && (
                                <div className="p-2 rounded-xl bg-kk-surface border border-kk-border text-xs shadow-sm">
                                  <span className="text-[10px] text-kk-muted block">Diet / Allergies:</span>
                                  <span className="font-bold text-kk-gold-ink">{assignedTarget.allergiesDiet}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Target Operative Wishlist Manifest */}
                        <div className="pt-3 border-t border-kk-border space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-kk-muted font-mono block">
                              🎁 Target Wishlist Items ({assignedTarget.wishlistItems?.length || 0})
                            </span>
                            <span className="text-[10px] text-kk-muted font-mono">Confidential Intel</span>
                          </div>

                          {(!assignedTarget.wishlistItems || assignedTarget.wishlistItems.length === 0) ? (
                            <div className="text-center py-4 border border-dashed border-kk-border rounded-xl">
                              <p className="text-xs text-kk-muted">Target operative has not added items to their wishlist manifest yet.</p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {assignedTarget.wishlistItems.map((item) => {
                                const isPersonalized = Boolean(item.properties?.isPersonalized || !item.url);

                                return (
                                  <div
                                    key={item.id}
                                    className="p-3 rounded-xl border border-kk-border bg-kk-surface shadow-sm flex items-center justify-between gap-3 text-xs"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      {item.thumbnail ? (
                                        <img
                                          src={item.thumbnail}
                                          alt={item.title}
                                          className="h-11 w-11 object-cover rounded-lg border border-kk-border flex-shrink-0"
                                        />
                                      ) : (
                                        <div className="h-11 w-11 rounded-lg bg-kk-inset flex items-center justify-center text-base flex-shrink-0">
                                          {isPersonalized ? '✨' : '🛍️'}
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {item.url ? (
                                            <a
                                              href={item.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="font-bold hover:underline block truncate text-kk-ink"
                                            >
                                              {item.title}
                                            </a>
                                          ) : (
                                            <span className="font-bold block truncate text-kk-ink">
                                              {item.title}
                                            </span>
                                          )}

                                          {isPersonalized && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-kk-warning text-kk-on-warning border border-kk-border-strong flex items-center gap-1 flex-shrink-0">
                                              ✨ Personalized Gift
                                            </span>
                                          )}
                                        </div>

                                        {item.price && (
                                          <span className={`text-xs font-mono font-bold block mt-0.5 ${theme.textAccent}`}>
                                            ${item.price}
                                          </span>
                                        )}

                                        {item.description && (
                                          <p className="text-xs text-kk-muted mt-1 italic line-clamp-2">
                                            "{item.description}"
                                          </p>
                                        )}

                                        {item.properties?.details && item.properties.details.length > 0 && (
                                          <div className="flex flex-wrap items-center gap-1 mt-1">
                                            {item.properties.details.map((d, dIdx) => (
                                              <span
                                                key={dIdx}
                                                className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-kk-inset/70 border-kk-border text-kk-muted flex items-center gap-1"
                                              >
                                                <span className="opacity-75">{d.label}:</span>
                                                <span>{d.value}</span>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {item.url ? (
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-2.5 py-1.5 rounded-lg font-bold text-xs bg-kk-inset text-kk-accent hover:bg-kk-inset border border-kk-border-strong flex-shrink-0 transition-colors"
                                      >
                                        View ↗
                                      </a>
                                    ) : (
                                      <span className="px-2.5 py-1.5 rounded-lg font-bold text-[11px] bg-kk-warning text-kk-on-warning border border-kk-border-strong flex-shrink-0">
                                        ✨ Custom
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Shipping Fulfillment Action Bar */}
                        <div className="pt-3 border-t border-kk-border space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className={theme.textSubLabel}>Shipment Status:</span>
                            {currentAgent?.shippingStatus === 'SHIPPED' ? (
                              <span className="text-kk-brand font-bold flex items-center gap-1">
                                <span>✓ Dispatched</span>
                              </span>
                            ) : currentAgent?.shippingStatus === 'LOCAL_DELIVERY' ? (
                              <span className="text-kk-brand font-bold flex items-center gap-1">
                                <span>🤝 Hand Delivery</span>
                              </span>
                            ) : (
                              <span className="text-kk-gold-ink font-bold flex items-center gap-1">
                                <span>⏳ Pending Shipment</span>
                              </span>
                            )}
                          </div>

                          {currentAgent?.shippingStatus === 'SHIPPED' && currentAgent.trackingNumber && (() => {
                            const carrier = detectCarrier(currentAgent.trackingNumber);
                            return (
                              <div className="p-3 rounded-xl bg-kk-inset/60 border border-kk-border flex items-center justify-between text-xs font-mono">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${carrier.badgeColor.bg} ${carrier.badgeColor.border} ${carrier.badgeColor.text}`}>
                                    {carrier.badgeLabel}
                                  </span>
                                  <span className="text-kk-ink font-bold">{carrier.normalizedTracking}</span>
                                </div>
                                {carrier.trackingUrl && (
                                  <a
                                    href={carrier.trackingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-kk-accent hover:underline flex items-center gap-1 font-bold text-[11px]"
                                    title="Open carrier tracking portal"
                                  >
                                    <span>Track</span>
                                    <span>↗</span>
                                  </a>
                                )}
                              </div>
                            );
                          })()}

                          <div className="pt-1">
                            <button
                              onClick={() => setShippingModalOpen(true)}
                              className={`w-full py-2.5 rounded-xl font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                                currentAgent?.shippingStatus === 'SHIPPED' || currentAgent?.shippingStatus === 'LOCAL_DELIVERY'
                                  ? theme.btnSecondary
                                  : theme.btnPrimary
                              }`}
                            >
                              <span>📦 {currentAgent?.shippingStatus === 'SHIPPED' || currentAgent?.shippingStatus === 'LOCAL_DELIVERY' ? 'Update Shipping Details' : 'Confirm Gift Shipped'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 border-2 border-dashed border-kk-border rounded-2xl">
                        <p className={`text-xs font-medium ${theme.textSubLabel}`}>
                          Target assignments have not been drawn yet. Stand by for your OpsLeader to initiate the draw!
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Wishlist Manifest & Manifest Items Scraper Section */}
                <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
                  <div className={theme.sectionBand}>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      {operation.isWhiteElephant ? '🐘 White Elephant Brought Gift Manifest' : '🎁 My Wishlist Manifest'}
                    </h2>
                  </div>
                  <p className={`text-xs font-semibold mb-1 ${theme.textAccent}`}>
                    {operation.isWhiteElephant
                      ? `Your gift: up to ${formatMoney(itemMax)}.`
                      : `Each item: up to ${formatMoney(itemMax)}. ${wishlistTotalMax === null ? 'Your list may total more than that.' : `Whole list: up to ${formatMoney(wishlistTotalMax)}.`}`}
                  </p>
                  <p className={`text-xs mb-4 ${theme.textSubLabel}`}>
                    {operation.isWhiteElephant
                      ? 'Add the 1 gift you are bringing to the White Elephant table. This list is for this mission only.'
                      : 'This list is for this mission only. Pick Store-bought gift to fill in an item from a store link, or Personalized gift for something handmade or specially crafted.'}
                  </p>

                  {validationError && (
                    <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertWarning}`}>
                      ⚠️ {validationError}
                    </div>
                  )}

                  <div className="mb-6">
                    <label htmlFor="add-wishlist-item" className={`block text-xs font-bold mb-1 ${theme.textLabel}`}>
                      Add an item
                    </label>
                    <select
                      id="add-wishlist-item"
                      value=""
                      disabled={operation.isWhiteElephant && userManifest.length >= 1}
                      onChange={(e) => {
                        const kind = e.target.value;
                        if (kind === 'store' || kind === 'personalized') openAddItem(kind);
                      }}
                      className={`w-full sm:w-auto border rounded-2xl px-4 py-3 text-sm font-bold cursor-pointer focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${theme.inputBg}`}
                    >
                      <option value="">
                        {operation.isWhiteElephant && userManifest.length >= 1 ? 'Your White Elephant gift is added' : 'Add a gift type…'}
                      </option>
                      <option value="store">🛍️ Store-bought gift</option>
                      <option value="personalized">✨ Personalized gift (handmade or specially crafted)</option>
                    </select>
                  </div>

                  {/* Manifest Items List */}
                  {userManifest.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-kk-border rounded-2xl">
                      <p className={`text-xs font-medium ${theme.textSubLabel}`}>
                        Your Wishlist Manifest is empty. Add a store link above or click <strong>✨ Add Personalized Gift</strong>!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userManifest.map((item) => {
                        const isPersonalized = Boolean(item.properties?.isPersonalized || !item.url);

                        return (
                          <div key={item.id} className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${theme.cardInnerBg}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              {item.thumbnail ? (
                                <img src={item.thumbnail} alt={item.title} className="h-12 w-12 object-cover rounded-xl border flex-shrink-0" />
                              ) : (
                                <div className="h-12 w-12 rounded-xl bg-kk-inset flex items-center justify-center text-xl flex-shrink-0">
                                  {isPersonalized ? '✨' : '🛍️'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.url ? (
                                    <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-bold hover:underline block max-w-xs truncate">
                                      {item.title}
                                    </a>
                                  ) : (
                                    <span className="text-sm font-bold block max-w-xs truncate">
                                      {item.title}
                                    </span>
                                  )}

                                  {isPersonalized && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-kk-warning text-kk-on-warning border border-kk-border-strong flex items-center gap-1 flex-shrink-0">
                                      ✨ Personalized Gift
                                    </span>
                                  )}
                                </div>

                                {item.price ? <span className={`text-xs font-mono font-bold block mt-0.5 ${theme.textAccent}`}>{formatMoney(item.price)}</span> : null}
                                {!item.price ? (
                                  <span className="text-[10px] font-bold mt-1 inline-block px-1.5 py-0.5 rounded-full bg-kk-warning text-kk-on-warning border border-kk-border-strong">
                                    Needs a price: edit to add one
                                  </span>
                                ) : Math.round(item.price * 100) > Math.round(itemMax * 100) ? (
                                  <span className="text-[10px] font-bold mt-1 inline-block px-1.5 py-0.5 rounded-full bg-kk-danger-soft text-kk-on-danger-soft border border-kk-danger/40">
                                    Over the {formatMoney(itemMax)} limit: edit or remove
                                  </span>
                                ) : null}

                                {item.description && (
                                  <p className="text-xs text-kk-muted mt-1 italic line-clamp-2 max-w-xs">
                                    "{item.description}"
                                  </p>
                                )}

                                {item.url ? (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-kk-muted hover:underline block max-w-xs truncate mt-0.5"
                                  >
                                    {item.url}
                                  </a>
                                ) : null}

                                {item.properties?.details && item.properties.details.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    {item.properties.details.map((d, dIdx) => (
                                      <span
                                        key={dIdx}
                                        className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-kk-inset border-kk-border text-kk-muted flex items-center gap-1"
                                      >
                                        <span className="opacity-75">{d.label}:</span>
                                        <span>{d.value}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setItemModalMode('edit');
                                  setItemModalData(item);
                                  setItemModalOpen(true);
                                }}
                                className="text-xs text-kk-accent font-bold hover:underline px-2.5 py-1.5 rounded-lg hover:bg-kk-inset transition-colors cursor-pointer"
                              >
                                ✏️ Edit Details
                              </button>
                              <button
                                onClick={() => handleRemoveManifestItem(item.id)}
                                className="text-xs text-kk-danger font-bold hover:underline px-2.5 py-1.5 rounded-lg hover:bg-kk-danger-soft transition-colors cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!operation.isWhiteElephant && (
                        <p className={`text-xs font-bold text-right ${wishlistOverTotal ? 'text-kk-danger' : theme.textSubLabel}`}>
                          List total: {formatMoney(wishlistTotal)}
                          {wishlistOverTotal && wishlistTotalMax !== null && ` (over the ${formatMoney(wishlistTotalMax)} total the Head Elf set: remove or lower an item)`}
                        </p>
                      )}
                    </div>
                  )}

                </div>


              </div>

              {/* Right Column: Participant Roster, Shipping Status & Mission Comms */}
              <div className="lg:col-span-5 space-y-6">
                <div className={`p-6 rounded-3xl border shadow-md ${theme.cardBg}`}>
                  <div className={`flex items-center justify-between gap-2 flex-wrap ${theme.sectionBand}`}>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      👥 Elf Agents ({membersList.length})
                      {isOpsLeader && pendingInviteCount > 0 && (
                        <span className="text-xs font-semibold text-kk-header-nav">· {pendingInviteCount} invited</span>
                      )}
                    </h2>
                    <div className="flex items-center gap-2">
                      {isOpsLeader && (
                        <button
                          onClick={() => setInviteModalOpen(true)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1 ${theme.btnAmber}`}
                        >
                          <span>✉️ + Invite Elf Agent</span>
                        </button>
                      )}
                      <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${statusBadgeClass(missionPhase)}`}>
                        ● {missionPhase.phaseStatusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {rosterNarrowed && (
                      <p className={`text-[11px] ${theme.textSubLabel}`}>
                        Targets are drawn. You now see the agents you can message: your Head Elf, your target and your Secret Santa.
                      </p>
                    )}
                    {rosterAgents.map((agent, i) => (
                      <div key={agent.id} className="rounded-2xl border-2 border-kk-border overflow-hidden text-xs bg-kk-surface shadow-sm">
                        {/* Agent info: tinted panel. Actions below sit on the plain card so they stand out. */}
                        <div className={`p-4 flex items-center justify-between ${theme.infoPanel}`}>
                          <div className="flex items-center gap-2.5">
                            <span className={`font-mono text-xs ${theme.textSubLabel}`}>#{i + 1}</span>
                            <div>
                              <span className={`font-bold block text-sm ${theme.textLabel}`}>
                                {formatCodename(agent.user?.codename, agent.user?.name)}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  agent.userId === organizerIdVal ? theme.badgeAmber : theme.badgeSecretSanta
                                }`}>
                                  {agent.userId === organizerIdVal ? 'Head Elf' : 'Elf Agent'}
                                </span>
                                {agent.userId === myTargetId && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-kk-success text-kk-on-success" title="You are this agent's Secret Santa">
                                    🎯 Your target
                                  </span>
                                )}
                                {agent.userId === mySantaId && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-kk-warning text-kk-on-warning" title="This agent is your Secret Santa">
                                    🎅 Your Secret Santa
                                  </span>
                                )}
                                {agent.shippingStatus === 'SHIPPED' ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono font-bold text-kk-brand">
                                      ✓ Shipped
                                    </span>
                                    {agent.trackingNumber && (() => {
                                      const carrier = detectCarrier(agent.trackingNumber);
                                      return (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold ${carrier.badgeColor.bg} ${carrier.badgeColor.border} ${carrier.badgeColor.text}`}>
                                          {carrier.badgeLabel}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                ) : agent.shippingStatus === 'LOCAL_DELIVERY' ? (
                                  <span className="text-[10px] font-mono font-bold text-kk-brand">
                                    🤝 Hand Delivery
                                  </span>
                                ) : (
                                  <span className={`text-[10px] font-mono font-bold ${theme.textSubLabel}`}>
                                    ⏳ Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {rosterNarrowed && (
                          <div className="px-4 py-2 border-t-2 border-kk-border bg-kk-surface flex justify-end">
                            <button
                              type="button"
                              onClick={() => openComms(agent.userId === myTargetId ? 'intel-target' : 'command')}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-kk-inset hover:brightness-95 transition-all cursor-pointer"
                            >
                              💬 {agent.userId === myTargetId ? 'Message your target' : 'Message the Head Elf'}
                            </button>
                          </div>
                        )}

                        {/* OpsLeader Agent Management Action Bar */}
                        {isOpsLeader && (
                          <div className="px-4 py-3 border-t-2 border-kk-border bg-kk-surface flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleAgentAction('nudge_agent', agent)}
                              title="Remind this agent about their next deadline (Command message, notification and email)"
                              className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-kk-primary hover:bg-kk-primary-hover text-kk-on-primary shadow-sm transition-all cursor-pointer"
                            >
                              🔔 Nudge
                            </button>

                            {operation.status === 'COMPLETED' && operation.enforcePenalties !== false && (
                              <button
                                onClick={() => handleAgentAction('issue_demerit', agent)}
                                title="Issue Coal Citation for deadline non-compliance"
                                className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-kk-gold text-kk-on-gold border border-kk-border-strong hover:brightness-95 shadow-sm transition-all cursor-pointer"
                              >
                                🪨 Issue Coal Citation
                              </button>
                            )}

                            {agent.userId !== organizerIdVal && (
                              <button
                                onClick={() => handleAgentAction('remove_agent', agent)}
                                title="Disenroll agent from operation"
                                className="ml-auto text-[11px] font-bold px-3 py-1.5 rounded-lg bg-kk-surface text-kk-danger border-2 border-kk-danger/60 hover:bg-kk-danger-soft transition-all cursor-pointer"
                              >
                                ❌ Disenroll
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {rosterNarrowed && (
                    <div className="mt-3 rounded-2xl border-2 border-dashed border-kk-border overflow-hidden text-xs bg-kk-surface">
                      <div className={`p-4 flex items-center justify-between gap-2 ${theme.infoPanel}`}>
                        <div>
                          <span className={`font-bold block text-sm ${theme.textLabel}`}>🎅 Your Secret Santa</span>
                          <span className={`text-[11px] ${theme.textSubLabel}`}>Their identity stays hidden. You can still message them.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openComms('intel-santa')}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-kk-inset hover:brightness-95 transition-all cursor-pointer shrink-0"
                        >
                          💬 Message
                        </button>
                      </div>
                    </div>
                  )}

                  {isOpsLeader && (
                    <InvitedAgentsList
                      operationId={operation.id}
                      refreshKey={invitesRefreshKey}
                      onPendingCountChange={setPendingInviteCount}
                    />
                  )}
                </div>

                {/* Mission Messaging: Command, Intel and Debrief */}
                {intelEnrolled && (
                <div id="mission-comms" className={`p-6 rounded-3xl border shadow-md scroll-mt-4 ${theme.cardBg}`}>
                  <div className={`flex items-center justify-between gap-2 flex-wrap ${theme.sectionBand}`}>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      💬 Mission Comms
                    </h2>
                    <div className="flex gap-1.5">
                      {([['command', '📡 Command'], ['intel', '🎯 Intel'], ['debrief', '🎉 Debrief']] as const).map(([tab, label]) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => { setMsgTab(tab); setIntelError(''); }}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                            msgTab === tab ? theme.badgeAmber : theme.cardInnerBg
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Conversation picker */}
                  {msgTab === 'intel' && (
                    <div className="flex gap-1.5 mb-3">
                      {([['target', '🎯 My Target'], ['santa', '🎅 My Secret Santa']] as const).map(([side, label]) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setIntelSide(side)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                            intelSide === side ? theme.badgeSecretSanta : theme.cardInnerBg
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {msgTab === 'command' && isOpsLeader && msgData.commandRecipients.length > 0 && (
                    <select
                      value={commandPeer}
                      onChange={(e) => setCommandWith(e.target.value)}
                      className={`w-full mb-3 border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${theme.inputBg}`}
                    >
                      {msgData.commandRecipients.map((r) => (
                        <option key={r.userId} value={r.userId}>
                          {formatCodename(r.codename)}
                        </option>
                      ))}
                    </select>
                  )}

                  {(() => {
                    const thread = msgData.messages.filter((m) => m.thread === activeThread);
                    const otherLabel = (m: MessageView) => {
                      if (m.fromMe) return 'You';
                      if (m.channel === 'intel') return intelSide === 'target' ? 'Your Target' : 'Your Secret Santa';
                      return `${formatCodename(m.sender?.codename)}${m.sender?.isHeadElf ? ' · Head Elf' : ''}`;
                    };
                    const missionDone = operation.status === 'COMPLETED';
                    const emptyText =
                      msgTab === 'command'
                        ? isOpsLeader
                          ? 'Send operational questions or nudges to one agent. Only you and that agent can read the thread.'
                          : 'Questions for your Head Elf go here. Only you and the Head Elf can read this thread.'
                        : msgTab === 'intel'
                        ? !(intelSide === 'target' ? msgData.hasTarget : msgData.hasSanta)
                          ? 'Intel opens once targets are assigned.'
                          : intelSide === 'target'
                          ? 'Ask your target about sizes or preferences. They will not know it is you.'
                          : 'Messages from your Secret Santa appear here. You can reply without learning who they are.'
                        : !missionDone
                        ? 'Debrief opens when the mission is complete: share thank-yous and reveals with every agent.'
                        : msgData.canSendDebrief
                        ? 'Share thank-yous and reveals with the whole mission.'
                        : 'Debrief closed 14 days after the mission completed.';
                    const closedNote =
                      !activeCanSend && missionDone && msgTab !== 'debrief'
                        ? 'This channel closed when the mission completed. The thread stays readable.'
                        : '';
                    return (
                      <>
                        <div className={`p-4 rounded-2xl border max-h-64 overflow-y-auto space-y-3 mb-4 ${theme.cardInnerBg}`}>
                          {thread.length === 0 ? (
                            <p className="text-xs text-kk-muted">{emptyText}</p>
                          ) : (
                            thread.map((log) => (
                              <div key={log.id} className="text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <strong className={theme.textAccent}>{otherLabel(log)}</strong>
                                  <span className="text-[10px] text-kk-muted shrink-0">
                                    {new Date(log.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-kk-muted mt-0.5 whitespace-pre-wrap break-words">{log.text}</p>
                              </div>
                            ))
                          )}
                        </div>

                        {msgTab === 'debrief' && msgData.canSendDebrief && msgData.debriefOpenUntil && (
                          <p className="text-[10px] text-kk-muted mb-2">
                            Debrief is readable until {formatDateString(msgData.debriefOpenUntil)}.
                          </p>
                        )}
                        {closedNote && <p className="text-[10px] text-kk-muted">{closedNote}</p>}

                        {activeCanSend && (
                          <form onSubmit={handleSendIntel} className="space-y-1.5">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder={
                                  msgTab === 'intel'
                                    ? intelSide === 'target' ? 'Message your target anonymously...' : 'Reply to your Secret Santa...'
                                    : msgTab === 'command'
                                    ? isOpsLeader ? 'Message this agent...' : 'Message your Head Elf...'
                                    : 'Message the whole mission...'
                                }
                                value={intelMessageText}
                                maxLength={INTEL_MESSAGE_MAX_CHARS}
                                onChange={(e) => setIntelMessageText(e.target.value)}
                                required
                                className={`flex-1 border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputBg}`}
                              />
                              <button
                                type="submit"
                                disabled={sendingIntel}
                                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm ${theme.btnPrimary}`}
                              >
                                {sendingIntel ? 'Sending...' : 'Send'}
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-kk-danger">{intelError}</span>
                              <span className="text-kk-muted font-mono">{intelMessageText.length}/{INTEL_MESSAGE_MAX_CHARS}</span>
                            </div>
                          </form>
                        )}
                      </>
                    );
                  })()}
                </div>
                )}
              </div>

              {/* POST-EVENT AFTER-ACTION REPORT (AAR) SECTION: spans the full 12-column grid it sits in */}
              {operation.status === 'COMPLETED' && (
                <div className="pt-6 lg:col-span-12">
                  <AfterActionReportSection
                    operationId={operation.id}
                    currentUserId={userId || ''}
                    reports={operation.reports || operation.afterActionReports || []}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-lg w-full transition-all max-h-[90vh] overflow-y-auto ${theme.modalBg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>⚙️ Edit Operation Options</span>
              </h3>
              <button onClick={() => setEditSettingsModalOpen(false)} className="text-kk-muted hover:text-kk-ink font-bold text-lg">✕</button>
            </div>

            {settingsError && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertError}`}>
                ⚠️ {settingsError}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-semibold">
              
              {/* Read-Only Locked Gifting Type Badge */}
              <div className={`p-3 rounded-2xl border ${theme.cardInnerBg}`}>
                <span className="text-[11px] text-kk-muted block mb-1 uppercase font-bold">
                  🔒 Locked Gifting Type (Immutable)
                </span>
                <span className={`text-xs px-3 py-1 rounded-full uppercase inline-block ${
                  operation?.isWhiteElephant ? theme.badgeWhiteElephant : theme.badgeSecretSanta
                }`}>
                  {operation?.isWhiteElephant ? '🐘 White Elephant' : '🎁 Secret Santa'}
                </span>
                <p className="text-[10px] text-kk-muted mt-1">
                  Operation gifting type cannot be converted once created.
                </p>
              </div>

              <div>
                <label className="block text-kk-muted mb-1">Operation Title *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div>
                <label className="block text-kk-muted mb-1">Mission Instructions / Description</label>
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
                  <label className="block text-kk-muted mb-1">Min Budget ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={editBudgetMin}
                    onChange={(e) => setEditBudgetMin(Number(e.target.value))}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                  />
                </div>
                <div>
                  <label className="block text-kk-muted mb-1">Max Budget ($) *</label>
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
                <label className="block text-kk-muted mb-1">Max Participant Limit (Optional)</label>
                <input
                  type="number"
                  min={2}
                  placeholder="Leave empty for unlimited"
                  value={editMaxParticipants || ''}
                  onChange={(e) => setEditMaxParticipants(e.target.value ? Number(e.target.value) : undefined)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              {!operation?.isWhiteElephant && (
                <div className={`p-4 rounded-2xl border ${theme.cardInnerBg}`}>
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div>
                      <span className="font-bold text-sm block">🎁 Wishlists may total more than the limit</span>
                      <span className="text-[11px] text-kk-muted block">
                        No single item may cost more than the spending limit. When this is on, an agent&apos;s whole list may add up to more, so their Santa can pick from it.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowOverBudget}
                      onChange={(e) => setEditAllowOverBudget(e.target.checked)}
                      className="h-5 w-5 rounded accent-red-600 dark:accent-sky-400 cursor-pointer shrink-0"
                    />
                  </label>
                </div>
              )}

              {/* Local In-Person Event Configuration Toggle */}
              <div className={`p-4 rounded-2xl border space-y-3 ${theme.cardInnerBg}`}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setEditIsLocalOnly(!editIsLocalOnly)}>
                  <div>
                    <span className="font-bold text-sm block">📍 Local In-Person Event</span>
                    <span className="text-[11px] text-kk-muted block">
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
                  <div className="pt-2 border-t border-kk-border">
                    <label className="block text-kk-muted mb-1">Event Location Address *</label>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full transition-all max-h-[90vh] overflow-y-auto ${theme.modalBg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <span>✏️ Adjust Operational Timeline</span>
              </h3>
              <button onClick={() => setEditDatesModalOpen(false)} className="text-kk-muted hover:text-kk-ink font-bold text-lg">✕</button>
            </div>

            <p className="text-xs text-kk-muted mb-4">
              As OpsLeader, customize timeline dates for this operation. All dates MUST fall between current day and Execution Date.
            </p>

            {dateError && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertError}`}>
                ⚠️ {dateError}
              </div>
            )}

            <form onSubmit={handleSaveDates} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-kk-muted mb-1">Stage 1: Go/No-Go Date (Invite Cutoff) *</label>
                <input
                  type="date"
                  required
                  min={editMin(operation?.inviteCutoffDate, editCutoffDate)}
                  value={editCutoffDate}
                  onChange={(e) => setEditCutoffDate(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div>
                <label className="block text-kk-muted mb-1">Stage 2: Target Assignment Date (Sattolo Draw) *</label>
                <input
                  type="date"
                  required
                  min={editMin(operation?.assignmentDate, editAssignDate, editCutoffDate)}
                  value={editAssignDate}
                  onChange={(e) => setEditAssignDate(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div>
                <label className="block text-kk-muted mb-1">Stage 3: Gift Shipping Deadline *</label>
                <input
                  type="date"
                  required
                  min={editMin(operation?.shippingDate, editShipDate, editAssignDate)}
                  value={editShipDate}
                  onChange={(e) => setEditShipDate(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div>
                <label className="block text-kk-muted mb-1">Stage 4: Exchange Execution Date (Event Day) *</label>
                <input
                  type="date"
                  required
                  min={editMin(operation?.executionDate, editExecDate, editShipDate || editAssignDate)}
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
        operationCode={operation?.code || code}
        opsLeaderUserId={userId || ''}
        onSuccess={() => {
          fetchExchangeDetails();
          setInvitesRefreshKey((k) => k + 1);
        }}
      />

      {/* MODAL: PREVENTATIVE MATCH RULES */}
      {operation && userId && (
        <PreventativeMatchModal
          isOpen={preventativeModalOpen}
          onClose={() => setPreventativeModalOpen(false)}
          operationId={operation.id}
          opsLeaderUserId={userId}
          agents={membersList.map((a) => ({
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
          agents={membersList.map((a) => ({
            id: a.id,
            userId: a.userId,
            user: {
              id: a.user?.id || a.userId,
              name: a.user?.name || a.userId,
              codename: a.user?.codename,
            },
            targetUserId: a.targetUserId,
            targetUser: a.targetUser,
            wishlistId: a.wishlistId,
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

      {/* MODAL: CANCEL OR DELETE MISSION (Head Elf) */}
      {operation && isOpsLeader && missionActionMode && (
        <MissionCancelModal
          mode={missionActionMode}
          missionTitle={operation.title}
          missionCode={operation.code}
          cancelledBeforeDraw={operation.status === 'RECRUITING' || operation.status === 'SETUP'}
          onClose={() => setMissionActionMode(null)}
          onConfirm={({ reason }) => handleMissionAction(missionActionMode, reason)}
        />
      )}

      {/* MODAL: COMPLETE OPERATION & OPTIONAL DEMERIT ASSIGNMENT */}
      {operation && userId && (
        <CompleteOperationModal
          isOpen={completeModalOpen}
          onClose={() => setCompleteModalOpen(false)}
          operationId={operation.id}
          operationTitle={operation.title}
          enforcePenalties={operation.enforcePenalties !== false}
          userId={userId}
          onSuccess={() => fetchExchangeDetails()}
        />
      )}

      {/* MODAL: SHIPPING CONFIRMATION */}
      {operation && (
        <ShippingConfirmationModal
          isOpen={shippingModalOpen}
          onClose={() => setShippingModalOpen(false)}
          operationId={operation.id}
          targetCodename={assignedTarget ? formatCodename(assignedTarget.codename, assignedTarget.name) : undefined}
          currentShippingStatus={currentAgent?.shippingStatus}
          currentTrackingNumber={currentAgent?.trackingNumber || undefined}
          onConfirmed={() => fetchExchangeDetails()}
        />
      )}

      {/* MODAL: WISHLIST ITEM CUSTOMIZATION / ADD / EDIT */}
      <WishlistItemModal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        onSaveSuccess={handleItemSaveSuccess}
        mode={itemModalMode}
        kind={itemModalKind}
        exchangeId={operation?.id}
        itemMax={wishlistRules?.itemMax ?? operation?.budgetMax}
        initialData={itemModalData}
        userDossier={userDossier}
      />

      {/* MODAL: ENLISTMENT AUTHENTICATION (REGISTER / SIGN IN WITH INVITE CODE) */}
      {authModalOpen && operation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-6 sm:p-8 rounded-3xl max-w-md w-full border transition-all max-h-[90vh] overflow-y-auto ${theme.modalBg}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${theme.badgeCode}`}>
                  MISSION INVITE: {operation.code}
                </span>
                <h3 className="text-2xl font-black mt-1">
                  {authMode === 'register' ? 'Enlist New Operative' : 'Operative Sign In'}
                </h3>
              </div>
              <button
                onClick={() => setAuthModalOpen(false)}
                className="text-kk-muted hover:text-kk-ink font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-kk-border mb-5 font-bold text-xs">
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`w-1/2 py-2.5 text-center border-b-2 transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'border-kk-danger/40 text-kk-danger'
                    : 'border-transparent text-kk-muted hover:text-kk-ink'
                }`}
              >
                🎟️ Create Profile &amp; Enlist
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`w-1/2 py-2.5 text-center border-b-2 transition-all cursor-pointer ${
                  authMode === 'login'
                    ? 'border-kk-danger/40 text-kk-danger'
                    : 'border-transparent text-kk-muted hover:text-kk-ink'
                }`}
              >
                🔑 Existing Account Sign In
              </button>
            </div>

            {authError && (
              <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${theme.alertError}`}>
                ⚠️ {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs font-semibold">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-kk-muted mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Simpson"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                    />
                  </div>

                </>
              )}

              <div>
                <label className="block text-kk-muted mb-1">Your Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. operative@family.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div>
                <label className="block text-kk-muted mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={authMode === 'register' ? 10 : 1}
                  placeholder={authMode === 'register' ? 'Min 10 characters (letters, numbers, symbols)' : 'Enter password'}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${theme.inputModalBg}`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className={`w-1/2 font-semibold py-3 rounded-2xl text-sm cursor-pointer ${theme.btnNeutral}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={authLoading}
                  className={`w-1/2 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md ${theme.btnPrimary}`}
                >
                  {authLoading
                    ? 'Verifying...'
                    : authMode === 'register'
                    ? '🎟️ Create & Enlist'
                    : '🔑 Sign In & Enlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
