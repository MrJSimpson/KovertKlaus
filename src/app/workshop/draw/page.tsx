'use client';

import { useState, useMemo } from 'react';
import {
  executeLinkedListDraw,
  evaluateDrawFeasibility,
  FieldAgent,
  LinkedAssignment,
  ExclusionRuleInput,
  isMatchBlocked,
  getValidSwapCandidates,
  executeTargetSwap,
} from '@/lib/draw';
import Link from 'next/link';

/**
 * Interface representing a node's geometric coordinates on the SVG canvas.
 */
interface NodeCoord {
  id: string;
  name: string;
  codename: string;
  x: number;
  y: number;
  angle: number;
}

/**
 * Interface for pre-configured test scenarios.
 */
interface PresetScenario {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  agents: FieldAgent[];
  exclusionRules: ExclusionRuleInput[];
}

/**
 * Threshold for visual graph rendering. Rosters > MAX_GRAPH_AGENTS switch to searchable paginated list.
 */
export const MAX_GRAPH_AGENTS = 20;
export const MATCH_PAGE_SIZE = 20;

/**
 * Pre-configured test scenarios for 1-click instant simulation.
 */
const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'simpson-family',
    name: 'Simpson Family Holiday Stealth Ops',
    badge: 'STANDARD 5 AGENTS',
    badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-500/40',
    description: '5 operatives with 1 standard spouse constraint (Joshua ⇔ Shannon).',
    agents: [
      { id: '1', name: 'Joshua Simpson', codename: 'Agent Shadow', hasWishlistAttached: true },
      { id: '2', name: 'Shannon Simpson', codename: 'Agent Falcon', hasWishlistAttached: true },
      { id: '3', name: 'Zachary Simpson', codename: 'Agent Ghost', hasWishlistAttached: true },
      { id: '4', name: 'Matthew Simpson', codename: 'Agent Siren', hasWishlistAttached: true },
      { id: '5', name: 'Leslie Crawford', codename: 'Agent Phoenix', hasWishlistAttached: true },
    ],
    exclusionRules: [{ agentId: '1', restrictedAgentId: '2' }],
  },
  {
    id: 'three-couples',
    name: 'High-Constraint Cross-Couples',
    badge: '3 COUPLES (6 AGENTS)',
    badgeColor: 'bg-purple-950 text-purple-300 border-purple-500/40',
    description: '6 operatives with 3 bidirectional spouse rules (A⇔B, C⇔D, E⇔F).',
    agents: [
      { id: '10', name: 'Joshua Simpson', codename: 'Agent Shadow', hasWishlistAttached: true },
      { id: '11', name: 'Shannon Simpson', codename: 'Agent Falcon', hasWishlistAttached: true },
      { id: '12', name: 'Terry Simpson', codename: 'Agent Grizzly', hasWishlistAttached: true },
      { id: '13', name: 'Cheryl Simpson', codename: 'Agent Cardinal', hasWishlistAttached: true },
      { id: '14', name: 'Zachary Simpson', codename: 'Agent Ghost', hasWishlistAttached: true },
      { id: '15', name: 'Zoe Vance', codename: 'Agent Polaris', hasWishlistAttached: true },
    ],
    exclusionRules: [
      { agentId: '10', restrictedAgentId: '11' },
      { agentId: '12', restrictedAgentId: '13' },
      { agentId: '14', restrictedAgentId: '15' },
    ],
  },
  {
    id: 'squadron-twelve',
    name: 'Squadron Alpha Deployment',
    badge: '12 AGENTS (GRAPH MODE)',
    badgeColor: 'bg-sky-950 text-sky-300 border-sky-500/40',
    description: '12 operatives across 4 departments with multiple cross-department blocks.',
    agents: [
      { id: '20', name: 'Agent Alpha', codename: 'Klaus-1', hasWishlistAttached: true },
      { id: '21', name: 'Agent Bravo', codename: 'Klaus-2', hasWishlistAttached: true },
      { id: '22', name: 'Agent Charlie', codename: 'Klaus-3', hasWishlistAttached: true },
      { id: '23', name: 'Agent Delta', codename: 'Klaus-4', hasWishlistAttached: true },
      { id: '24', name: 'Agent Echo', codename: 'Klaus-5', hasWishlistAttached: true },
      { id: '25', name: 'Agent Foxtrot', codename: 'Klaus-6', hasWishlistAttached: true },
      { id: '26', name: 'Agent Golf', codename: 'Klaus-7', hasWishlistAttached: true },
      { id: '27', name: 'Agent Hotel', codename: 'Klaus-8', hasWishlistAttached: true },
      { id: '28', name: 'Agent India', codename: 'Klaus-9', hasWishlistAttached: true },
      { id: '29', name: 'Agent Juliet', codename: 'Klaus-10', hasWishlistAttached: true },
      { id: '30', name: 'Agent Kilo', codename: 'Klaus-11', hasWishlistAttached: true },
      { id: '31', name: 'Agent Lima', codename: 'Klaus-12', hasWishlistAttached: true },
    ],
    exclusionRules: [
      { agentId: '20', restrictedAgentId: '21' },
      { agentId: '22', restrictedAgentId: '23' },
      { agentId: '24', restrictedAgentId: '25' },
    ],
  },
  {
    id: 'mega-squadron-24',
    name: 'Mega Squadron (24 Agents)',
    badge: '24 AGENTS (>20 ROSTER MODE)',
    badgeColor: 'bg-amber-950 text-amber-300 border-amber-500/40',
    description: '24 operatives demonstrating the searchable 20-per-page paginated roster view.',
    agents: Array.from({ length: 24 }, (_, i) => ({
      id: `agent-${i + 1}`,
      name: `Operative ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''} Simpson`,
      codename: `Klaus-${i + 1}`,
      hasWishlistAttached: true,
    })),
    exclusionRules: [
      { agentId: 'agent-1', restrictedAgentId: 'agent-2' },
      { agentId: 'agent-3', restrictedAgentId: 'agent-4' },
      { agentId: 'agent-5', restrictedAgentId: 'agent-6' },
    ],
  },
  {
    id: 'over-constrained',
    name: 'Over-Constrained Trap (Error Handling)',
    badge: 'IMPOSSIBLE CONSTRAINTS',
    badgeColor: 'bg-rose-950 text-rose-300 border-rose-500/40',
    description: '5 operatives with impossible hub blocks to verify graceful error catch.',
    agents: [
      { id: '40', name: 'Operative Alpha', codename: 'Agent-A', hasWishlistAttached: true },
      { id: '41', name: 'Operative Bravo', codename: 'Agent-B', hasWishlistAttached: true },
      { id: '42', name: 'Operative Charlie', codename: 'Agent-C', hasWishlistAttached: true },
      { id: '43', name: 'Operative Delta', codename: 'Agent-D', hasWishlistAttached: true },
      { id: '44', name: 'Operative Echo', codename: 'Agent-E', hasWishlistAttached: true },
    ],
    exclusionRules: [
      { agentId: '40', restrictedAgentId: '41' },
      { agentId: '40', restrictedAgentId: '42' },
      { agentId: '40', restrictedAgentId: '43' },
      { agentId: '40', restrictedAgentId: '44' },
    ],
  },
];

/**
 * Calculates radial (x, y) coordinates for an array of agents distributed around a circle.
 */
function computeRadialNodeCoordinates(
  agents: FieldAgent[],
  cx: number,
  cy: number,
  radius: number
): Map<string, NodeCoord> {
  const map = new Map<string, NodeCoord>();
  const total = agents.length;
  if (total === 0) return map;

  agents.forEach((agent, index) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    map.set(agent.id, {
      id: agent.id,
      name: agent.name,
      codename: agent.codename || `Agent ${index + 1}`,
      x,
      y,
      angle,
    });
  });

  return map;
}

/**
 * Computes an SVG curved bezier path between two nodes, curving slightly toward the center.
 */
function computeCurvedArrowPath(
  source: NodeCoord,
  target: NodeCoord,
  cx: number,
  cy: number,
  curveFactor = 0.28
): string {
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const controlX = midX + (cx - midX) * curveFactor;
  const controlY = midY + (cy - midY) * curveFactor;

  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}

export default function WorkshopDrawBench() {
  const [agents, setAgents] = useState<FieldAgent[]>(PRESET_SCENARIOS[0].agents);
  const [exclusionRules, setExclusionRules] = useState<ExclusionRuleInput[]>(
    PRESET_SCENARIOS[0].exclusionRules
  );
  const [activePresetId, setActivePresetId] = useState<string>(PRESET_SCENARIOS[0].id);

  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentCodename, setNewAgentCodename] = useState('');
  const [ruleAgentA, setRuleAgentA] = useState<string>('');
  const [ruleAgentB, setRuleAgentB] = useState<string>('');

  const [assignments, setAssignments] = useState<LinkedAssignment[] | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [swapSuccessMsg, setSwapSuccessMsg] = useState<string | null>(null);
  const [originatorId, setOriginatorId] = useState<string>('');
  const [selectedNewTargetId, setSelectedNewTargetId] = useState<string>('');

  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [drawTimestamp, setDrawTimestamp] = useState<number | null>(null);

  const [matchSearchQuery, setMatchSearchQuery] = useState('');
  const [matchCurrentPage, setMatchCurrentPage] = useState(1);

  const handleLoadPreset = (preset: PresetScenario) => {
    setActivePresetId(preset.id);
    setAgents(preset.agents);
    setExclusionRules(preset.exclusionRules);
    setAssignments(null);
    setDrawError(null);
    setSwapSuccessMsg(null);
    setOriginatorId('');
    setSelectedNewTargetId('');
    setMatchSearchQuery('');
    setMatchCurrentPage(1);
  };

  const addAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;
    const newId = String(Date.now());
    const newAgent: FieldAgent = {
      id: newId,
      name: newAgentName.trim(),
      codename: newAgentCodename.trim() || `Agent ${newAgentName.trim().split(' ')[0]}`,
      hasWishlistAttached: true,
    };
    setAgents([...agents, newAgent]);
    setNewAgentName('');
    setNewAgentCodename('');
    setActivePresetId('custom');
    setAssignments(null);
    setMatchCurrentPage(1);
  };

  const removeAgent = (id: string) => {
    setAgents(agents.filter((a) => a.id !== id));
    setExclusionRules(exclusionRules.filter((r) => r.agentId !== id && r.restrictedAgentId !== id));
    setActivePresetId('custom');
    setAssignments(null);
    setMatchCurrentPage(1);
  };

  const handleAddExclusionRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleAgentA || !ruleAgentB || ruleAgentA === ruleAgentB) return;

    const exists = isMatchBlocked(ruleAgentA, ruleAgentB, exclusionRules);
    if (exists) {
      setDrawError('Preventative match rule already exists for this pair.');
      return;
    }

    setExclusionRules([...exclusionRules, { agentId: ruleAgentA, restrictedAgentId: ruleAgentB }]);
    setRuleAgentA('');
    setRuleAgentB('');
    setDrawError(null);
    setActivePresetId('custom');
    setAssignments(null);
  };

  const handleRemoveExclusionRule = (agentA: string, agentB: string) => {
    setExclusionRules(
      exclusionRules.filter(
        (r) =>
          !(
            (r.agentId === agentA && r.restrictedAgentId === agentB) ||
            (r.agentId === agentB && r.restrictedAgentId === agentA)
          )
      )
    );
    setActivePresetId('custom');
    setAssignments(null);
  };

  const handleRunDraw = () => {
    setDrawError(null);
    setSwapSuccessMsg(null);
    try {
      const results = executeLinkedListDraw(agents, { exclusionRules });
      setAssignments(results);
      setDrawTimestamp(Date.now());
      if (results.length > 0) {
        setOriginatorId(results[0].agentId);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDrawError(err.message);
      } else {
        setDrawError('An unknown error occurred during draw.');
      }
      setAssignments(null);
    }
  };

  const handleExecuteSwap = () => {
    if (!assignments || !originatorId || !selectedNewTargetId) return;

    try {
      const updatedAssignments = executeTargetSwap(
        assignments,
        originatorId,
        selectedNewTargetId,
        exclusionRules
      );

      const originator = agents.find((a) => a.id === originatorId);
      const newTarget = agents.find((a) => a.id === selectedNewTargetId);

      setAssignments(updatedAssignments);
      setSelectedNewTargetId('');
      setDrawError(null);
      setSwapSuccessMsg(
        `✓ 2-Way Cascade Swap Executed: ${originator?.name} now gives to ${newTarget?.name}. Displaced giver re-routed automatically to maintain 1-to-1 giving invariant.`
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDrawError(err.message);
      } else {
        setDrawError('Failed to execute target swap.');
      }
    }
  };

  const validSwapCandidates = useMemo(() => {
    if (!assignments || !originatorId) return [];
    return getValidSwapCandidates(agents, assignments, originatorId, exclusionRules);
  }, [agents, assignments, originatorId, exclusionRules]);

  const isLargeRoster = agents.length > MAX_GRAPH_AGENTS;

  const filteredMatches = useMemo(() => {
    if (!assignments) return [];
    if (!matchSearchQuery.trim()) return assignments;
    const q = matchSearchQuery.toLowerCase().trim();
    return assignments.filter(({ agentId, targetId }) => {
      const giver = agents.find((a) => a.id === agentId);
      const receiver = agents.find((a) => a.id === targetId);
      return (
        (giver?.name && giver.name.toLowerCase().includes(q)) ||
        (giver?.codename && giver.codename.toLowerCase().includes(q)) ||
        (receiver?.name && receiver.name.toLowerCase().includes(q)) ||
        (receiver?.codename && receiver.codename.toLowerCase().includes(q))
      );
    });
  }, [assignments, agents, matchSearchQuery]);

  const totalMatchPages = useMemo(() => {
    return Math.ceil(filteredMatches.length / MATCH_PAGE_SIZE) || 1;
  }, [filteredMatches]);

  const paginatedMatches = useMemo(() => {
    const startIndex = (matchCurrentPage - 1) * MATCH_PAGE_SIZE;
    return filteredMatches.slice(startIndex, startIndex + MATCH_PAGE_SIZE);
  }, [filteredMatches, matchCurrentPage]);

  const feasibility = useMemo(() => {
    return evaluateDrawFeasibility(agents, exclusionRules);
  }, [agents, exclusionRules]);

  const SVG_SIZE = 560;
  const SVG_CENTER = SVG_SIZE / 2;
  const SVG_RADIUS = 190;

  const nodeCoords = useMemo(() => {
    return computeRadialNodeCoordinates(agents, SVG_CENTER, SVG_CENTER, SVG_RADIUS);
  }, [agents, SVG_CENTER, SVG_RADIUS]);

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            <span className="text-xs px-2.5 py-0.5 rounded font-mono uppercase bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
              WORKSHOP LAB // ALGORITHM & VISUAL SWAP STUDIO
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-2 text-white flex items-center gap-2">
            <span>Sattolo Derangement & 2-Way Swap Visual Playground</span>
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1">
            Simulate CSPRNG cyclic derangements, inspect interactive SVG directed graphs, and test invariant-preserving 2-way cascade target swaps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTraceModal(true)}
            className="bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-500/40 px-3.5 py-2 rounded-xl font-mono text-xs transition-colors flex items-center gap-1.5 font-bold cursor-pointer"
          >
            📊 Algorithmic Trace
          </button>
          <Link
            href="/workshop"
            className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-3.5 py-2 rounded-xl font-mono text-xs transition-colors font-bold"
          >
            ← Workshop Hub
          </Link>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span>⚡ 1-CLICK INSTANT TEST PRESETS</span>
          </span>
          <span className="text-[11px] font-mono text-gray-500">
            Click any scenario to instantly populate roster and constraints
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESET_SCENARIOS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleLoadPreset(preset)}
                className={`p-3 rounded-xl border text-left font-mono transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  isSelected
                    ? 'bg-slate-950 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${preset.badgeColor}`}>
                      {preset.badge}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">{preset.name}</div>
                  <p className="text-[10px] text-gray-400 mt-1 leading-snug">{preset.description}</p>
                </div>
                <div className="text-[10px] text-amber-400/80 font-semibold pt-1 border-t border-slate-900">
                  Load Scenario →
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-emerald-500/30 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-bold">
                SIMULATION CONFIGURATION
              </span>
              <span className="text-xs font-mono bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                {activePresetId.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-gray-400 block text-[10px]">TOTAL ROSTER</span>
                <span className="text-white font-black text-base">{agents.length} Operatives</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-gray-400 block text-[10px]">BLOCKED PAIRS (A ⇔ B)</span>
                <span className="text-purple-400 font-black text-base">{exclusionRules.length} Pairs</span>
              </div>
            </div>

            {/* Festive Live Feasibility Status Pill */}
            <div
              className={`p-3 rounded-xl border text-xs font-mono transition-all ${
                feasibility.themeColor === 'emerald'
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                  : feasibility.themeColor === 'amber'
                  ? 'bg-amber-950/80 border-amber-500/40 text-amber-200'
                  : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1.5">
                <span>{feasibility.headline}</span>
              </div>
              <p className="text-[10px] mt-1 opacity-90 leading-snug">
                {feasibility.message}
              </p>
            </div>

            <button
              onClick={handleRunDraw}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-950/50 text-xs font-mono cursor-pointer flex items-center justify-center gap-2"
            >
              <span>⚡ RUN CSPRNG SATTOLO DERANGEMENT</span>
            </button>
          </div>

          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-purple-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                <span>🚫 PREVENTATIVE MATCH RULES (A ⇔ B)</span>
              </h3>
            </div>
            <p className="text-xs text-gray-400">
              Symmetric 2-way exclusions prevent spouses or household members from drawing each other in either direction.
            </p>

            <form onSubmit={handleAddExclusionRule} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <label className="block text-gray-400 mb-1 text-[10px]">AGENT A:</label>
                  <select
                    value={ruleAgentA}
                    onChange={(e) => setRuleAgentA(e.target.value)}
                    className="w-full bg-slate-950 border border-purple-500/40 rounded-lg px-2 py-2 text-white text-xs"
                  >
                    <option value="">Select Agent A</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 text-[10px]">AGENT B:</label>
                  <select
                    value={ruleAgentB}
                    onChange={(e) => setRuleAgentB(e.target.value)}
                    className="w-full bg-slate-950 border border-purple-500/40 rounded-lg px-2 py-2 text-white text-xs"
                  >
                    <option value="">Select Agent B</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-purple-700 hover:bg-purple-600 text-white font-mono text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
              >
                ➕ Block Pair (A ⇔ B)
              </button>
            </form>

            <div className="space-y-2 pt-2 border-t border-gray-800">
              <div className="text-[11px] font-mono text-gray-400">ACTIVE BLOCKED PAIRS:</div>
              {exclusionRules.length === 0 ? (
                <div className="text-[11px] font-mono text-gray-500 italic">No preventative match rules defined.</div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {exclusionRules.map((rule, idx) => {
                    const agentA = agents.find((a) => a.id === rule.agentId);
                    const agentB = agents.find((a) => a.id === rule.restrictedAgentId);
                    return (
                      <div
                        key={idx}
                        className="bg-purple-950/40 border border-purple-500/30 p-2 rounded-lg text-xs font-mono flex items-center justify-between"
                      >
                        <span className="text-purple-300 font-bold">
                          {agentA?.name || 'Unknown'} <span className="text-amber-400 font-black">⇔</span> {agentB?.name || 'Unknown'}
                        </span>
                        <button
                          onClick={() => handleRemoveExclusionRule(rule.agentId, rule.restrictedAgentId)}
                          className="text-gray-400 hover:text-red-400 text-[10px] px-1.5 py-0.5 rounded border border-gray-700 hover:border-red-500 transition"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-slate-800 space-y-4">
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span>👥 CUSTOM AGENT ROSTER</span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                {agents.length} Enlisted
              </span>
            </h2>

            <form onSubmit={addAgent} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Full Name"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <input
                type="text"
                placeholder="Codename"
                value={newAgentCodename}
                onChange={(e) => setNewAgentCodename(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono font-bold rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer border border-emerald-500/20"
              >
                + Enlist
              </button>
            </form>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-slate-950 border border-slate-800/80 p-2.5 rounded-lg flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <span className="text-white font-bold">{agent.name}</span>
                    <span className="text-emerald-400 text-[10px] ml-2 font-semibold">({agent.codename})</span>
                  </div>
                  <button
                    onClick={() => removeAgent(agent.id)}
                    className="text-gray-500 hover:text-red-400 text-[10px] px-1.5 py-0.5 rounded hover:bg-red-950/40 transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {drawError && (
            <div className="bg-red-950/90 border-2 border-red-800 text-red-200 p-4 rounded-2xl text-xs font-mono shadow-xl flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <div className="font-bold uppercase">Algorithmic Error Exception</div>
                <div className="text-[11px] mt-0.5">{drawError}</div>
              </div>
            </div>
          )}

          {swapSuccessMsg && (
            <div className="bg-emerald-950/90 border-2 border-emerald-800 text-emerald-300 p-4 rounded-2xl text-xs font-mono font-bold shadow-xl flex items-center gap-3">
              <span className="text-xl">✓</span>
              <div>{swapSuccessMsg}</div>
            </div>
          )}

          <div className="p-6 rounded-3xl border-2 bg-slate-900 border-emerald-500/30 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-black text-white font-mono flex items-center gap-2">
                  <span>
                    {!isLargeRoster
                      ? '🎨 INTERACTIVE CYCLIC GRAPH CANVAS'
                      : `📋 SEARCHABLE MATCH ROSTER (${agents.length} Operatives)`}
                  </span>
                </h2>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                  {!isLargeRoster
                    ? 'Click any node to stage as Originating Operator for 2-way swapping (active for ≤20 agents)'
                    : `Displaying searchable match list (${MATCH_PAGE_SIZE} per page) replacing graph canvas for rosters > 20 participants`}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                {!isLargeRoster ? (
                  <>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Gift Arrow (A → B)
                    </span>
                    <span className="flex items-center gap-1 text-purple-400">
                      <span className="h-2 w-2 rounded-full bg-purple-500"></span> Blocked (A ⇔ B)
                    </span>
                  </>
                ) : (
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                    ROSTER MODE (&gt;20)
                  </span>
                )}
              </div>
            </div>

            <div className="relative w-full flex items-center justify-center bg-slate-950 rounded-2xl border border-slate-800/80 p-4 overflow-hidden min-h-[380px]">
              {!assignments ? (
                <div className="py-24 text-center space-y-3 font-mono text-xs text-gray-500">
                  <div className="text-4xl animate-bounce">🎁</div>
                  <div className="text-gray-300 font-bold">No Active Assignment Cycle Generated</div>
                  <p className="max-w-sm mx-auto text-[11px] text-gray-500">
                    Click &quot;RUN CSPRNG SATTOLO DERANGEMENT&quot; above to compute a single unbroken gift cycle.
                  </p>
                </div>
              ) : !isLargeRoster ? (
                <svg
                  viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                  className="w-full max-w-[500px] h-auto select-none"
                >
                  <defs>
                    <marker
                      id="arrow-emerald"
                      viewBox="0 0 10 10"
                      refX="18"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                    </marker>

                    <marker
                      id="arrow-amber"
                      viewBox="0 0 10 10"
                      refX="18"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                    </marker>
                  </defs>

                  {exclusionRules.map((rule, idx) => {
                    const nodeA = nodeCoords.get(rule.agentId);
                    const nodeB = nodeCoords.get(rule.restrictedAgentId);
                    if (!nodeA || !nodeB) return null;

                    return (
                      <line
                        key={`exclusion-${idx}`}
                        x1={nodeA.x}
                        y1={nodeA.y}
                        x2={nodeB.x}
                        y2={nodeB.y}
                        stroke="#a855f7"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity="0.4"
                      />
                    );
                  })}

                  {assignments.map(({ agentId, targetId }) => {
                    const giver = nodeCoords.get(agentId);
                    const receiver = nodeCoords.get(targetId);
                    if (!giver || !receiver) return null;

                    const isSelectedOriginator = agentId === originatorId;
                    const isHovered = hoveredAgentId === agentId || hoveredAgentId === targetId;

                    const pathData = computeCurvedArrowPath(giver, receiver, SVG_CENTER, SVG_CENTER, 0.28);

                    return (
                      <path
                        key={`arrow-${agentId}-${targetId}`}
                        d={pathData}
                        fill="none"
                        stroke={isSelectedOriginator ? '#f59e0b' : isHovered ? '#38bdf8' : '#10b981'}
                        strokeWidth={isSelectedOriginator ? '3.5' : isHovered ? '2.5' : '1.8'}
                        strokeDasharray={isSelectedOriginator ? '6 2' : 'none'}
                        markerEnd={isSelectedOriginator ? 'url(#arrow-amber)' : 'url(#arrow-emerald)'}
                        opacity={hoveredAgentId && !isHovered && !isSelectedOriginator ? 0.25 : 0.85}
                        className="transition-all duration-300"
                      />
                    );
                  })}

                  {agents.map((agent) => {
                    const node = nodeCoords.get(agent.id);
                    if (!node) return null;

                    const isOriginator = agent.id === originatorId;
                    const isCandidate = validSwapCandidates.some((c) => c.id === agent.id);
                    const isHovered = hoveredAgentId === agent.id;

                    return (
                      <g
                        key={`node-${agent.id}`}
                        onClick={() => {
                          setOriginatorId(agent.id);
                          setSelectedNewTargetId('');
                        }}
                        onMouseEnter={() => setHoveredAgentId(agent.id)}
                        onMouseLeave={() => setHoveredAgentId(null)}
                        className="cursor-pointer group"
                      >
                        {(isOriginator || isHovered) && (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r="28"
                            fill={isOriginator ? '#f59e0b' : '#38bdf8'}
                            opacity="0.2"
                            className="animate-pulse"
                          />
                        )}

                        <circle
                          cx={node.x}
                          cy={node.y}
                          r="20"
                          fill={isOriginator ? '#78350f' : isCandidate ? '#064e3b' : '#0f172a'}
                          stroke={
                            isOriginator
                              ? '#f59e0b'
                              : isCandidate
                              ? '#10b981'
                              : isHovered
                              ? '#38bdf8'
                              : '#334155'
                          }
                          strokeWidth={isOriginator ? '3' : '2'}
                          className="transition-colors duration-200"
                        />

                        <text
                          cx={node.x}
                          cy={node.y}
                          x={node.x}
                          y={node.y + 4}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {agent.name
                            .split(' ')
                            .map((p) => p[0])
                            .join('')
                            .substring(0, 2)}
                        </text>

                        <text
                          x={node.x}
                          y={node.y > SVG_CENTER ? node.y + 32 : node.y - 24}
                          textAnchor="middle"
                          fill={isOriginator ? '#fbbf24' : '#cbd5e1'}
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {agent.codename || agent.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="w-full space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-xl font-mono text-xs">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={matchSearchQuery}
                        onChange={(e) => {
                          setMatchSearchQuery(e.target.value);
                          setMatchCurrentPage(1);
                        }}
                        placeholder="🔍 Search matches by agent name or codename..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                      {matchSearchQuery && (
                        <button
                          onClick={() => {
                            setMatchSearchQuery('');
                            setMatchCurrentPage(1);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 font-bold whitespace-nowrap">
                      Showing {filteredMatches.length === 0 ? 0 : (matchCurrentPage - 1) * MATCH_PAGE_SIZE + 1} -{' '}
                      {Math.min(matchCurrentPage * MATCH_PAGE_SIZE, filteredMatches.length)} of {filteredMatches.length} Matches
                    </div>
                  </div>

                  {filteredMatches.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 font-mono text-xs">
                      No matches found for &quot;{matchSearchQuery}&quot;.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 max-h-[440px] overflow-y-auto pr-1">
                        {paginatedMatches.map(({ agentId, targetId }, idx) => {
                          const giver = agents.find((a) => a.id === agentId);
                          const receiver = agents.find((a) => a.id === targetId);
                          const isSelectedOriginator = agentId === originatorId;
                          const isHovered = hoveredAgentId === agentId || hoveredAgentId === targetId;

                          return (
                            <div
                              key={`match-${agentId}-${targetId}`}
                              onClick={() => {
                                setOriginatorId(agentId);
                                setSelectedNewTargetId('');
                              }}
                              onMouseEnter={() => setHoveredAgentId(agentId)}
                              onMouseLeave={() => setHoveredAgentId(null)}
                              className={`p-3 rounded-xl border text-xs font-mono transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                isSelectedOriginator
                                  ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                                  : isHovered
                                  ? 'bg-slate-900 border-sky-500/50'
                                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-[10px] font-bold text-gray-500 w-7 shrink-0">
                                  #{(matchCurrentPage - 1) * MATCH_PAGE_SIZE + idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-white font-bold truncate block">{giver?.name || 'Unknown'}</span>
                                  <span className="text-[10px] text-emerald-400 font-semibold">{giver?.codename || 'No Codename'}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-center px-2 text-amber-400 font-black shrink-0">
                                <span>➔</span>
                              </div>

                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <span className="text-white font-bold truncate block">{receiver?.name || 'Unknown'}</span>
                                  <span className="text-[10px] text-sky-400 font-semibold">{receiver?.codename || 'No Codename'}</span>
                                </div>
                                <button
                                  type="button"
                                  className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors shrink-0 ${
                                    isSelectedOriginator
                                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                                      : 'bg-slate-900 text-gray-300 border-slate-700 hover:border-amber-500/60 hover:text-amber-300'
                                  }`}
                                >
                                  {isSelectedOriginator ? 'Staged' : 'Select'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {totalMatchPages > 1 && (
                        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs font-mono">
                          <button
                            onClick={() => setMatchCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={matchCurrentPage === 1}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 transition-colors"
                          >
                            ← Prev (20)
                          </button>
                          <span className="text-gray-400 font-bold">
                            Page {matchCurrentPage} of {totalMatchPages}
                          </span>
                          <button
                            onClick={() => setMatchCurrentPage((p) => Math.min(totalMatchPages, p + 1))}
                            disabled={matchCurrentPage === totalMatchPages}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 transition-colors"
                          >
                            Next (20) →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {assignments && (
              <div className="p-5 rounded-2xl border border-amber-500/40 bg-slate-950 space-y-4 shadow-lg">
                <div className="flex items-center justify-between text-amber-300 font-mono text-xs font-bold">
                  <span>🎯 MOBILE-FIRST 2-WAY CASCADE TARGET SWAP CONSOLE</span>
                  <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 text-[10px]">
                    1-TO-1 INVARIANT SAFE
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <label className="block text-gray-400 mb-1 text-[10px]">
                      1. ORIGINATING OPERATOR (Giver A):
                    </label>
                    <select
                      value={originatorId}
                      onChange={(e) => {
                        setOriginatorId(e.target.value);
                        setSelectedNewTargetId('');
                      }}
                      className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-2 text-white font-bold"
                    >
                      {assignments.map(({ agentId }) => {
                        const agent = agents.find((a) => a.id === agentId);
                        return (
                          <option key={agentId} value={agentId}>
                            {agent?.name} ({agent?.codename})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1 text-[10px]">
                      2. REPLACEMENT TARGET (Target New):
                    </label>
                    <select
                      value={selectedNewTargetId}
                      onChange={(e) => setSelectedNewTargetId(e.target.value)}
                      className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-2 text-white font-bold"
                    >
                      <option value="">-- Select Replacement Target --</option>
                      {validSwapCandidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name} ({candidate.codename})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleExecuteSwap}
                  disabled={!selectedNewTargetId}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-gray-500 text-slate-950 font-black py-3 px-4 rounded-xl transition-all shadow-md font-mono text-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  ⚡ EXECUTE 2-WAY CASCADE TARGET SWAP
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showTraceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-purple-500/50 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-purple-300 flex items-center gap-2">
                <span>📊 CSPRNG Sattolo Derangement Execution Trace</span>
              </h3>
              <button
                onClick={() => setShowTraceModal(false)}
                className="text-gray-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-slate-300 text-xs leading-relaxed max-h-96 overflow-y-auto pr-1">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="text-emerald-400 font-bold">1. High-Entropy Random Dice (CSPRNG):</div>
                <p className="text-gray-400 text-[11px]">
                  All random integer selections use <code className="text-white">crypto.getRandomValues</code> with rejection sampling to eliminate modulo bias.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="text-purple-400 font-bold">2. O(1) Pre-Indexed Bidirectional Constraints:</div>
                <p className="text-gray-400 text-[11px]">
                  Compiled <strong className="text-white">{exclusionRules.length}</strong> blocked pair rules into bidirectional composite keys (<code className="text-amber-300">${'{A}'}:${'{B}'}</code>). Graph verification completes in strictly O(N) time.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="text-sky-400 font-bold">3. 1-to-1 Derangement Cycle Guarantee:</div>
                <p className="text-gray-400 text-[11px]">
                  Status: {assignments ? <strong className="text-emerald-400">✓ VERIFIED SINGLE CYCLE ({assignments.length} EDGES)</strong> : <strong className="text-gray-500">PENDING RUN</strong>}
                </p>
                {drawTimestamp && (
                  <p className="text-[10px] text-gray-500">
                    Last Computed: {new Date(drawTimestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowTraceModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition cursor-pointer"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
