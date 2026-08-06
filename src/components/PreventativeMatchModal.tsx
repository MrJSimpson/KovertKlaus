'use client';

import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

export interface OperationAgentUser {
  id: string;
  name: string;
  codename?: string | null;
}

export interface OperationExclusionRule {
  id: string;
  agentId: string;
  restrictedAgentId: string;
  agent?: OperationAgentUser;
  restrictedAgent?: OperationAgentUser;
}

interface PreventativeMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationId: string;
  opsLeaderUserId: string;
  agents: OperationAgentUser[];
  exclusionRules: OperationExclusionRule[];
  onExclusionsUpdated: () => void;
}

export function PreventativeMatchModal({
  isOpen,
  onClose,
  operationId,
  opsLeaderUserId,
  agents,
  exclusionRules,
  onExclusionsUpdated,
}: PreventativeMatchModalProps) {
  const { theme } = useTheme();
  const [agentAId, setAgentAId] = useState<string>('');
  const [agentBId, setAgentBId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const availableForB = agents.filter((a) => a.id !== agentAId);

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!agentAId || !agentBId) {
      setError('Please select both operatives to establish a preventative match rule.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addExclusion',
          operationId,
          userId: opsLeaderUserId,
          agentId: agentAId,
          restrictedAgentId: agentBId,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create preventative match rule');
      }

      setSuccessMessage('Preventative match rule established!');
      setAgentAId('');
      setAgentBId('');
      onExclusionsUpdated();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add rule';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveRule(exclusionId: string) {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'removeExclusion',
          operationId,
          userId: opsLeaderUserId,
          exclusionId,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to remove preventative match rule');
      }

      setSuccessMessage('Preventative match rule removed.');
      onExclusionsUpdated();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to remove rule';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  const getAgentLabel = (agentId: string) => {
    const found = agents.find((a) => a.id === agentId);
    if (!found) return agentId;
    return found.codename ? `${found.name} ("${found.codename}")` : found.name;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`p-6 sm:p-8 rounded-3xl max-w-lg w-full transition-all shadow-2xl ${theme.modalBg}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200 dark:border-slate-800">
          <div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${theme.badgeCode}`}>
              🚫 Tactical Restrictions
            </span>
            <h3 className="text-xl font-black mt-1">Preventative Match Rules</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        <p className={`text-xs mb-4 ${theme.textSubLabel}`}>
          Specify pairs of operatives who <strong>cannot</strong> be assigned to each other. Rules are <strong>100% bidirectional</strong> (if Agent A cannot give to Agent B, Agent B cannot give to Agent A).
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

        {/* Form: Add New Rule */}
        <form onSubmit={handleAddRule} className="space-y-4 mb-6 p-4 rounded-2xl bg-stone-50 dark:bg-slate-900/60 border border-stone-200 dark:border-slate-800">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Create Blocked Pair</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
            <div>
              <label className="block text-slate-500 mb-1">Operative A</label>
              <select
                value={agentAId}
                onChange={(e) => {
                  setAgentAId(e.target.value);
                  if (e.target.value === agentBId) setAgentBId('');
                }}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
              >
                <option value="">-- Select Operative --</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.codename ? `("${a.codename}")` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">Operative B (Blocked Pair)</label>
              <select
                value={agentBId}
                disabled={!agentAId}
                onChange={(e) => setAgentBId(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${theme.inputModalBg}`}
              >
                <option value="">-- Select Operative --</option>
                {availableForB.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.codename ? `("${a.codename}")` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !agentAId || !agentBId}
            className={`w-full font-extrabold py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${theme.btnPrimary}`}
          >
            {loading ? <span>⏳ Saving...</span> : <span>➕ Add Preventative Match Rule</span>}
          </button>
        </form>

        {/* List of Active Rules */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Active Preventative Rules ({exclusionRules.length})</h4>
          
          {exclusionRules.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No preventative match rules active for this operation.</p>
          ) : (
            exclusionRules.map((rule) => {
              const labelA = rule.agent ? (rule.agent.codename ? `${rule.agent.name} ("${rule.agent.codename}")` : rule.agent.name) : getAgentLabel(rule.agentId);
              const labelB = rule.restrictedAgent ? (rule.restrictedAgent.codename ? `${rule.restrictedAgent.name} ("${rule.restrictedAgent.codename}")` : rule.restrictedAgent.name) : getAgentLabel(rule.restrictedAgentId);

              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-stone-100 dark:bg-slate-900/90 border border-stone-200 dark:border-slate-800 text-xs font-semibold"
                >
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 truncate">
                    <span className="text-red-500 font-bold">🚫</span>
                    <span className="font-bold">{labelA}</span>
                    <span className="text-slate-400 font-mono">⟷</span>
                    <span className="font-bold">{labelB}</span>
                  </div>

                  <button
                    onClick={() => handleRemoveRule(rule.id)}
                    disabled={loading}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold text-xs p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer ml-2"
                    title="Remove Rule"
                  >
                    🗑️ Remove
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 pt-3 border-t border-stone-200 dark:border-slate-800 text-right">
          <button
            type="button"
            onClick={onClose}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs cursor-pointer ${theme.btnNeutral}`}
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
