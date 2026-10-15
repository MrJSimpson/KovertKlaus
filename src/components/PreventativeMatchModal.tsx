'use client';

import { useState, useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { evaluateDrawFeasibility, FieldAgent, ExclusionRuleInput } from '@/lib/draw';

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

  const feasibility = useMemo(() => {
    const fieldAgents: FieldAgent[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      codename: a.codename,
      hasWishlistAttached: true,
    }));
    const exclusionInputs: ExclusionRuleInput[] = exclusionRules.map((r) => ({
      agentId: r.agentId,
      restrictedAgentId: r.restrictedAgentId,
    }));
    return evaluateDrawFeasibility(fieldAgents, exclusionInputs);
  }, [agents, exclusionRules]);

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex sm:items-center items-end justify-center p-0 sm:p-4 overflow-y-auto">
      <div className={`w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl border shadow-2xl transition-all my-0 sm:my-8 flex flex-col overflow-hidden ${theme.modalBg}`}>
        
        {/* Header */}
        <div className="p-4 sm:p-6 pb-3 border-b border-kk-border flex items-center justify-between shrink-0">
          <div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${theme.badgeCode}`}>
              🚫 Tactical Restrictions
            </span>
            <h3 className="text-xl font-black mt-1">Preventative Match Rules</h3>
          </div>
          <button
            onClick={onClose}
            className="text-kk-muted hover:text-kk-ink font-bold text-xl cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <p className={`text-xs ${theme.textSubLabel}`}>
            Specify pairs of operatives who <strong>cannot</strong> be assigned to each other. Rules are <strong>100% bidirectional</strong> (e.g. spouses/partners). KovertKlaus requires a minimum of 4 participants to preserve gifting mystery and ensure clean cyclical matches.
          </p>

          {/* Festive Live Feasibility Status Banner */}
          <div
            className={`p-3.5 rounded-2xl border text-xs font-mono transition-all ${
              feasibility.themeColor === 'emerald'
                ? 'bg-kk-success border-kk-on-success/30 text-kk-on-success'
                : feasibility.themeColor === 'amber'
                ? 'bg-kk-warning border-kk-border-strong text-kk-on-warning'
                : 'bg-kk-danger-soft border-kk-danger/40 text-kk-on-danger-soft'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs">
              <span>{feasibility.headline}</span>
            </div>
            <p className="text-[11px] mt-1 opacity-90 leading-snug">
              {feasibility.message}
            </p>
          </div>

          {error && (
            <div className={`p-4 rounded-xl text-xs font-semibold ${theme.alertWarning}`}>
              ⚠️ {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl text-xs font-bold bg-kk-success text-kk-on-success border border-kk-on-success/30">
              ✅ {successMessage}
            </div>
          )}

          {/* Form: Add New Rule */}
          <form onSubmit={handleAddRule} className="space-y-4 p-4 rounded-2xl bg-kk-surface border border-kk-border">
            <h4 className="text-xs font-black uppercase tracking-wider text-kk-muted">Create Blocked Pair</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
              <div>
                <label className="block text-kk-muted mb-1">Operative A</label>
                <select
                  value={agentAId}
                  onChange={(e) => {
                    setAgentAId(e.target.value);
                    if (e.target.value === agentBId) setAgentBId('');
                  }}
                  className={`w-full border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none ${theme.inputModalBg}`}
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
                <label className="block text-kk-muted mb-1">Operative B (Blocked Pair)</label>
                <select
                  value={agentBId}
                  disabled={!agentAId}
                  onChange={(e) => setAgentBId(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none ${theme.inputModalBg}`}
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
              className={`w-full font-extrabold py-2.5 min-h-[44px] rounded-xl text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${theme.btnPrimary}`}
            >
              {loading ? <span>⏳ Saving...</span> : <span>➕ Add Preventative Match Rule</span>}
            </button>
          </form>

          {/* List of Active Rules */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-kk-muted mb-2">Active Preventative Rules ({exclusionRules.length})</h4>
            
            {exclusionRules.length === 0 ? (
              <p className="text-xs text-kk-muted italic py-2">No preventative match rules active for this operation.</p>
            ) : (
              exclusionRules.map((rule) => {
                const labelA = rule.agent ? (rule.agent.codename ? `${rule.agent.name} ("${rule.agent.codename}")` : rule.agent.name) : getAgentLabel(rule.agentId);
                const labelB = rule.restrictedAgent ? (rule.restrictedAgent.codename ? `${rule.restrictedAgent.name} ("${rule.restrictedAgent.codename}")` : rule.restrictedAgent.name) : getAgentLabel(rule.restrictedAgentId);

                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-kk-inset border border-kk-border text-xs font-semibold"
                  >
                    <div className="flex items-center gap-2 text-kk-muted truncate">
                      <span className="text-kk-danger font-bold">🚫</span>
                      <span className="font-bold">{labelA}</span>
                      <span className="text-kk-muted font-mono">⟷</span>
                      <span className="font-bold">{labelB}</span>
                    </div>

                    <button
                      onClick={() => handleRemoveRule(rule.id)}
                      disabled={loading}
                      className="text-kk-danger hover:underline font-bold text-xs min-h-[44px] min-w-[44px] px-2 py-1 rounded-lg hover:bg-kk-danger-soft cursor-pointer ml-2 flex items-center justify-center transition-colors"
                      title="Remove Rule"
                    >
                      🗑️ Remove
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-kk-border text-right shrink-0 pb-safe-sheet bg-inherit">
          <button
            type="button"
            onClick={onClose}
            className={`px-6 py-2.5 min-h-[44px] rounded-xl font-bold text-xs cursor-pointer ${theme.btnNeutral}`}
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
