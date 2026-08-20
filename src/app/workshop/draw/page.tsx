'use client';

import { useState } from 'react';
import {
  executeLinkedListDraw,
  FieldAgent,
  LinkedAssignment,
  ExclusionRuleInput,
  isMatchBlocked,
  getValidSwapCandidates,
  executeTargetSwap,
} from '@/lib/draw';
import Link from 'next/link';

export default function WorkshopDrawBench() {
  // Interactive Simulator Roster State
  const [agents, setAgents] = useState<FieldAgent[]>([
    { id: '1', name: 'Joshua Simpson', codename: 'Agent Shadow', hasWishlistAttached: true },
    { id: '2', name: 'Shannon Simpson', codename: 'Agent Falcon', hasWishlistAttached: true },
    { id: '3', name: 'Zachary Simpson', codename: 'Agent Ghost', hasWishlistAttached: true },
    { id: '4', name: 'Matthew Simpson', codename: 'Agent Siren', hasWishlistAttached: true },
    { id: '5', name: 'Leslie Crawford', codename: 'Agent Phoenix', hasWishlistAttached: true },
  ]);

  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentCodename, setNewAgentCodename] = useState('');

  // Bidirectional Exclusion Rules State (A <-> B)
  const [exclusionRules, setExclusionRules] = useState<ExclusionRuleInput[]>([
    { agentId: '1', restrictedAgentId: '2' }, // Joshua <-> Shannon blocked pair
  ]);
  const [ruleAgentA, setRuleAgentA] = useState<string>('');
  const [ruleAgentB, setRuleAgentB] = useState<string>('');

  // Assignments State & Swap Console State
  const [assignments, setAssignments] = useState<LinkedAssignment[] | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [swapSuccessMsg, setSwapSuccessMsg] = useState<string | null>(null);

  // Swap Console Inputs
  const [originatorId, setOriginatorId] = useState<string>('');
  const [selectedNewTargetId, setSelectedNewTargetId] = useState<string>('');

  // Handlers for Roster
  const addAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;
    const newId = String(Date.now());
    setAgents([
      ...agents,
      {
        id: newId,
        name: newAgentName.trim(),
        codename: newAgentCodename.trim() || `Agent ${newAgentName.trim().split(' ')[0]}`,
        hasWishlistAttached: true,
      },
    ]);
    setNewAgentName('');
    setNewAgentCodename('');
    setAssignments(null);
  };

  const removeAgent = (id: string) => {
    setAgents(agents.filter((a) => a.id !== id));
    setExclusionRules(exclusionRules.filter((r) => r.agentId !== id && r.restrictedAgentId !== id));
    setAssignments(null);
  };

  // Handlers for Bidirectional Exclusion Rules
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
    setAssignments(null);
  };

  // Handler for Executing Sattolo Derangement Draw
  const handleRunDraw = () => {
    setDrawError(null);
    setSwapSuccessMsg(null);
    try {
      const results = executeLinkedListDraw(agents, { exclusionRules });
      setAssignments(results);
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

  // Handler for Executing 2-Way Cascade Target Swap
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
        `✓ 2-Way Cascade Swap Executed: ${originator?.name} now assigned to ${newTarget?.name}. Displaced giver reassigned automatically to preserve 1-to-1 giving.`
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDrawError(err.message);
      } else {
        setDrawError('Failed to execute target swap.');
      }
    }
  };

  // Calculate Valid Target Swap Candidates for Selected Originator
  const validSwapCandidates =
    assignments && originatorId
      ? getValidSwapCandidates(agents, assignments, originatorId, exclusionRules)
      : [];

  return (
    <div className="space-y-6 pb-12">
      {/* HUD Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-emerald-950 text-emerald-300 border border-emerald-500/30">
              WORKSHOP LAB // TARGET ALGORITHM & SWAP BENCH
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 text-white flex items-center gap-2">
            <span>Sattolo Derangement & 2-Way Target Swap Console</span>
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1">
            Simulate cyclic linked list derangements, 100% bidirectional exclusion filters ($A \iff B$), and invariant-preserving target cascade swaps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/workshop/scraper"
            className="bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            🔎 Scraper
          </Link>
          <Link
            href="/workshop/lifecycle"
            className="bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            ⏰ Schedule
          </Link>
          <Link
            href="/workshop"
            className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors"
          >
            ← Hub
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Mission Controls & Exclusion Filters */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Active Simulation Card */}
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-emerald-500/30 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">ACTIVE ALGORITHM BENCH</span>
              <span className="text-xs font-mono bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                SETUP
              </span>
            </div>
            
            <h2 className="text-lg font-bold text-white mt-3">Simpson Family Stealth Ops</h2>
            <p className="text-xs text-gray-400 mt-1">Created by <span className="text-white font-medium">OpsLeader Joshua</span></p>

            <div className="mt-6 space-y-3 font-mono text-xs text-gray-300 border-t border-gray-800 pt-4">
              <div className="flex justify-between">
                <span className="text-gray-400">ROSTER COUNT:</span>
                <span className="text-white font-bold">{agents.length} AGENTS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">BLOCKED PAIRS ($A \iff B$):</span>
                <span className="text-amber-400 font-bold">{exclusionRules.length} PAIRS</span>
              </div>
            </div>

            <div className="mt-6">
              <button 
                onClick={handleRunDraw}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-950/40 text-xs font-mono cursor-pointer flex items-center justify-center gap-2"
              >
                <span>⚡ EXECUTE TARGET ASSIGNMENT</span>
              </button>
            </div>
          </div>

          {/* 100% Bidirectional Exclusion Rule Filter ($A <=> B$) */}
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-purple-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                <span>🚫 PREVENTATIVE MATCH RULES ($A \iff B$)</span>
              </h3>
            </div>
            <p className="text-xs text-gray-400">
              Symmetric 2-way exclusions prevent spouses or household members from drawing each other in either direction.
            </p>

            {/* Add Exclusion Rule Form */}
            <form onSubmit={handleAddExclusionRule} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <label className="block text-gray-400 mb-1">AGENT A:</label>
                  <select
                    value={ruleAgentA}
                    onChange={(e) => setRuleAgentA(e.target.value)}
                    className="w-full bg-slate-950 border border-purple-500/40 rounded px-2 py-1.5 text-white"
                  >
                    <option value="">Select Agent A</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">AGENT B:</label>
                  <select
                    value={ruleAgentB}
                    onChange={(e) => setRuleAgentB(e.target.value)}
                    className="w-full bg-slate-950 border border-purple-500/40 rounded px-2 py-1.5 text-white"
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
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
              >
                ➕ Block Pair ($A \iff B$)
              </button>
            </form>

            {/* Active Exclusion Rules List */}
            <div className="space-y-2 pt-2 border-t border-gray-800">
              <div className="text-[11px] font-mono text-gray-400">ACTIVE BLOCKED PAIRS:</div>
              {exclusionRules.length === 0 ? (
                <div className="text-[11px] font-mono text-gray-500 italic">No preventative match rules defined.</div>
              ) : (
                <div className="space-y-1.5">
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
                          className="text-gray-400 hover:text-red-400 text-[10px] px-1.5 py-0.5 rounded border border-gray-700"
                        >
                          ✕ Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Roster & Target Swap Console */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Agent Roster Management */}
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                <span>👥 Field Agent Roster</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                  {agents.length} Enlisted
                </span>
              </h2>
            </div>

            {/* Add Agent Form */}
            <form onSubmit={addAgent} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <input
                type="text"
                placeholder="Agent Full Name"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <input
                type="text"
                placeholder="Codename (Optional)"
                value={newAgentCodename}
                onChange={(e) => setNewAgentCodename(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono font-bold rounded-lg px-4 py-2 text-xs transition-colors cursor-pointer border border-emerald-500/20"
              >
                + Enlist Agent
              </button>
            </form>

            {/* Agent Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agents.map((agent) => (
                <div key={agent.id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">{agent.name}</div>
                    <div className="text-[11px] font-mono text-emerald-400">{agent.codename}</div>
                  </div>
                  <button
                    onClick={() => removeAgent(agent.id)}
                    className="text-gray-500 hover:text-red-400 text-[11px] font-mono px-2 py-1 rounded hover:bg-red-950/40 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Target Results Terminal & Mobile-First Target Swap Console */}
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-emerald-500/30 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                <span>🔒 Classified Assignment Results & 2-Way Swap Console</span>
              </h2>
              <button
                onClick={handleRunDraw}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Run Sattolo Draw
              </button>
            </div>

            {/* Status & Error Notifications */}
            {drawError && (
              <div className="bg-red-950/80 border-2 border-red-800 text-red-200 p-4 rounded-xl text-xs font-mono">
                ⚠️ ERROR: {drawError}
              </div>
            )}

            {swapSuccessMsg && (
              <div className="bg-emerald-950/80 border-2 border-emerald-800 text-emerald-300 p-4 rounded-xl text-xs font-mono font-bold">
                {swapSuccessMsg}
              </div>
            )}

            {!assignments && !drawError && (
              <div className="text-xs font-mono text-gray-500 py-8 text-center border border-dashed border-gray-800 rounded-lg">
                Click "EXECUTE TARGET ASSIGNMENT" to generate Secret Santa assignments with active exclusion filters.
              </div>
            )}

            {assignments && (
              <>
                {/* 1. Target Swap Console Controls */}
                <div className="p-4 rounded-xl border border-amber-500/40 bg-slate-950 space-y-4">
                  <div className="flex items-center justify-between text-amber-300 font-mono text-xs font-bold">
                    <span>🎯 MOBILE-FIRST 2-WAY CASCADE TARGET SWAP CONSOLE</span>
                    <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                      INVARIANT SAFE
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    {/* Originator Agent Dropdown */}
                    <div>
                      <label className="block text-gray-400 mb-1">1. ORIGINATING OPERATOR (Agent A):</label>
                      <select
                        value={originatorId}
                        onChange={(e) => {
                          setOriginatorId(e.target.value);
                          setSelectedNewTargetId('');
                        }}
                        className="w-full bg-slate-900 border border-amber-500/40 rounded px-2.5 py-2 text-white font-bold"
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

                    {/* Valid Candidate Target Dropdown */}
                    <div>
                      <label className="block text-gray-400 mb-1">2. NEW TARGET CANDIDATE (Target New):</label>
                      <select
                        value={selectedNewTargetId}
                        onChange={(e) => setSelectedNewTargetId(e.target.value)}
                        className="w-full bg-slate-900 border border-amber-500/40 rounded px-2.5 py-2 text-white font-bold"
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

                  {/* Swap Execution Button */}
                  <button
                    onClick={handleExecuteSwap}
                    disabled={!selectedNewTargetId}
                    className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-black py-2.5 px-4 rounded-xl transition-all shadow-md font-mono text-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    ⚡ EXECUTE 2-WAY CASCADE TARGET SWAP
                  </button>
                </div>

                {/* 2. Target Assignment Output Cards */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-mono text-emerald-400 mb-2">
                    ✓ ACTIVE 1-TO-1 DERANGEMENT ASSIGNMENTS:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {assignments.map(({ agentId, targetId }) => {
                      const giver = agents.find((a) => a.id === agentId);
                      const receiver = agents.find((a) => a.id === targetId);
                      const isOriginator = agentId === originatorId;

                      return (
                        <div
                          key={agentId}
                          className={`p-3 rounded-lg font-mono text-xs border ${
                            isOriginator
                              ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                              : 'bg-slate-950 border-emerald-500/20 text-slate-200'
                          }`}
                        >
                          <div className="text-gray-400 mb-1">
                            SANTA: <span className="text-white font-bold">{giver?.name}</span> ({giver?.codename})
                          </div>
                          <div className="text-emerald-400 font-semibold flex items-center gap-1">
                            <span>ASSIGNED TARGET ➔</span>
                            <span className="text-white font-bold">{receiver?.name}</span> ({receiver?.codename})
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
