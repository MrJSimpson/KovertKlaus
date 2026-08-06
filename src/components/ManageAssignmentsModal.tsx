'use client';

import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { getValidSwapCandidates, FieldAgent, LinkedAssignment, ExclusionRuleInput } from '@/lib/draw';

export interface EnrolledAgent {
  id: string; // MissionAgent id
  userId: string;
  user: {
    id: string;
    name: string;
    codename?: string | null;
  };
  targetUserId?: string | null;
  targetUser?: {
    id: string;
    name: string;
    codename?: string | null;
  } | null;
  wishlistId?: string | null;
}

export interface OperationExclusion {
  id: string;
  agentId: string;
  restrictedAgentId: string;
}

interface ManageAssignmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationId: string;
  opsLeaderUserId: string;
  agents: EnrolledAgent[];
  exclusionRules: OperationExclusion[];
  onAssignmentsUpdated: () => void;
}

export function ManageAssignmentsModal({
  isOpen,
  onClose,
  operationId,
  opsLeaderUserId,
  agents,
  exclusionRules,
  onAssignmentsUpdated,
}: ManageAssignmentsModalProps) {
  const { theme } = useTheme();
  const [activeOriginatorId, setActiveOriginatorId] = useState<string | null>(null);
  const [selectedNewTargetId, setSelectedNewTargetId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  // Convert enrolled agents to FieldAgent[] for draw utility functions
  const fieldAgents: FieldAgent[] = agents.map((a) => ({
    id: a.userId,
    name: a.user.name,
    codename: a.user.codename,
    hasWishlistAttached: !!a.wishlistId,
  }));

  // Convert assignments
  const currentAssignments: LinkedAssignment[] = agents
    .filter((a) => a.targetUserId)
    .map((a) => ({
      agentId: a.userId,
      targetId: a.targetUserId!,
    }));

  const exclusionInputs: ExclusionRuleInput[] = exclusionRules.map((r) => ({
    agentId: r.agentId,
    restrictedAgentId: r.restrictedAgentId,
  }));

  async function handleExecuteSwap(originatorUserId: string, newTargetUserId: string) {
    if (!newTargetUserId) return;

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'swap',
          operationId,
          userId: opsLeaderUserId,
          originatorUserId,
          newTargetUserId,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to execute target swap');
      }

      const originatorAgent = agents.find((a) => a.userId === originatorUserId);
      const newTargetAgent = agents.find((a) => a.userId === newTargetUserId);

      const originatorName = originatorAgent?.user.codename
        ? `${originatorAgent.user.name} ("${originatorAgent.user.codename}")`
        : originatorAgent?.user.name;

      const newTargetName = newTargetAgent?.user.codename
        ? `${newTargetAgent.user.name} ("${newTargetAgent.user.codename}")`
        : newTargetAgent?.user.name;

      setSuccessMessage(`Target Swap Executed! ${originatorName} is now targeting ${newTargetName}. Displaced giver was assigned the previous target.`);
      setActiveOriginatorId(null);
      setSelectedNewTargetId('');
      onAssignmentsUpdated();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Swap failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  const getAgentDisplayName = (userId: string) => {
    const found = agents.find((a) => a.userId === userId);
    if (!found) return userId;
    return found.user.codename
      ? `${found.user.name} ("${found.user.codename}")`
      : found.user.name;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`p-6 sm:p-8 rounded-3xl max-w-xl w-full transition-all shadow-2xl ${theme.modalBg}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200 dark:border-slate-800">
          <div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${theme.badgeCode}`}>
              🎯 Command Center Assignments
            </span>
            <h3 className="text-xl font-black mt-1">Manage Target Assignments</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        <p className={`text-xs mb-4 ${theme.textSubLabel}`}>
          View current target pairings and execute mobile-friendly <strong>2-way target swaps</strong>. Candidate dropdowns automatically exclude self, current targets, and active preventative rules.
        </p>

        {error && (
          <div className={`p-4 mb-4 rounded-xl text-xs font-semibold ${theme.alertWarning}`}>
            ⚠️ {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3 mb-4 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
            ✅ {successMessage}
          </div>
        )}

        {/* Assignments Table / List */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {agents.map((agent) => {
            const isOriginatorActive = activeOriginatorId === agent.userId;
            const currentTargetName = agent.targetUserId
              ? getAgentDisplayName(agent.targetUserId)
              : null;

            // Get valid swap candidates for this originator
            const validCandidates = getValidSwapCandidates(
              fieldAgents,
              currentAssignments,
              agent.userId,
              exclusionInputs
            );

            return (
              <div
                key={agent.id}
                className="p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-900/80 border border-stone-200 dark:border-slate-800 text-xs transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100">
                      🕵️ {getAgentDisplayName(agent.userId)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Target: {currentTargetName ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">🎯 {currentTargetName}</span>
                      ) : (
                        <span className="italic text-amber-500">Unassigned</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isOriginatorActive) {
                        setActiveOriginatorId(null);
                        setSelectedNewTargetId('');
                      } else {
                        setActiveOriginatorId(agent.userId);
                        setSelectedNewTargetId('');
                      }
                    }}
                    disabled={loading || !agent.targetUserId}
                    className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                      isOriginatorActive ? theme.btnPrimary : theme.btnNeutral
                    }`}
                  >
                    {isOriginatorActive ? 'Cancel Swap' : '🔄 Swap Target'}
                  </button>
                </div>

                {/* Inline Target Swap Dropdown Menu */}
                {isOriginatorActive && (
                  <div className="mt-3 pt-3 border-t border-stone-200 dark:border-slate-800 space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500">
                      Select New Target for {getAgentDisplayName(agent.userId)}:
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedNewTargetId}
                        onChange={(e) => setSelectedNewTargetId(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
                      >
                        <option value="">-- Choose New Target --</option>
                        {validCandidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            🎯 {getAgentDisplayName(candidate.id)}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={loading || !selectedNewTargetId}
                        onClick={() => handleExecuteSwap(agent.userId, selectedNewTargetId)}
                        className={`px-4 py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer whitespace-nowrap ${theme.btnPrimary}`}
                      >
                        {loading ? 'Swapping...' : 'Confirm Swap'}
                      </button>
                    </div>
                    {validCandidates.length === 0 && (
                      <p className="text-[10px] text-amber-500 italic">
                        No valid alternative target candidates available due to active preventative match rules.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-3 border-t border-stone-200 dark:border-slate-800 text-right">
          <button
            type="button"
            onClick={onClose}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs cursor-pointer ${theme.btnNeutral}`}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
