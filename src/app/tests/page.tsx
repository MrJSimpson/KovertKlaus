'use client';

import { useState } from 'react';
import { executeLinkedListDraw, FieldAgent, LinkedAssignment } from '@/lib/draw';
import Link from 'next/link';

export default function TestBench() {
  // Interactive Simulator State for Demonstration
  const [agents, setAgents] = useState<FieldAgent[]>([
    { id: '1', name: 'Joshua Simpson', codename: 'Agent Shadow', hasWishlistAttached: true },
    { id: '2', name: 'Sarah Simpson', codename: 'Agent Falcon', hasWishlistAttached: true },
    { id: '3', name: 'Michael Vance', codename: 'Agent Ghost', hasWishlistAttached: true },
    { id: '4', name: 'Elena Rostova', codename: 'Agent Siren', hasWishlistAttached: true },
  ]);

  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentCodename, setNewAgentCodename] = useState('');

  const [assignments, setAssignments] = useState<LinkedAssignment[] | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);

  // Handlers
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
    setAssignments(null);
  };

  const handleRunDraw = () => {
    setDrawError(null);
    try {
      const results = executeLinkedListDraw(agents);
      setAssignments(results);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDrawError(err.message);
      } else {
        setDrawError('An unknown error occurred during draw.');
      }
      setAssignments(null);
    }
  };

  return (
    <div className="min-h-screen pb-16 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* HUD Header */}
      <header className="py-8 border-b border-gray-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-radar inline-block"></span>
            <span className="classified-tag text-xs px-2 py-0.5 rounded font-mono uppercase">
              TEST BENCH // SIMULATION LAB
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-2 text-white flex items-center gap-2">
            <span>KOVERT KLAUS</span>
            <span className="text-emerald-400 font-mono text-sm border border-emerald-500/30 px-2 py-1 rounded bg-emerald-950/40">
              ALGORITHM BENCH
            </span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Interactive Test & Feature Simulator for Sattolo Derangement Protocol and Field Roster Validation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/tests/lifecycle"
            className="bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 px-4 py-2 rounded-lg font-mono text-xs transition-colors flex items-center gap-2"
          >
            ⏰ Schedule & Lifecycle Engine
          </Link>
          <Link
            href="/"
            className="bg-gray-900 hover:bg-gray-800 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-lg font-mono text-xs transition-colors flex items-center gap-2"
          >
            ← Main App
          </Link>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        
        {/* Left Column: Active Mission Briefing */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-xl border border-emerald-500/20 ops-glow-emerald">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">ACTIVE SIMULATION</span>
              <span className="text-xs font-mono bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                RECRUITING
              </span>
            </div>
            
            <h2 className="text-xl font-bold text-white mt-3">Simpson Family Holiday Stealth Ops</h2>
            <p className="text-xs text-gray-400 mt-1">Created by <span className="text-white font-medium">OpsLeader Joshua</span></p>

            <div className="mt-6 space-y-3 font-mono text-xs text-gray-300 border-t border-gray-800 pt-4">
              <div className="flex justify-between">
                <span className="text-gray-400">MISSION CODE:</span>
                <span className="text-emerald-400 font-bold tracking-widest">KOVERT-8X92</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">BUDGET CAP:</span>
                <span className="text-amber-400 font-bold">$25.00 - $50.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">EXCHANGE DATE:</span>
                <span>DEC 25, 2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ROSTER COUNT:</span>
                <span className="text-white font-bold">{agents.length} AGENTS</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button 
                onClick={handleRunDraw}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 text-sm cursor-pointer"
              >
                <span>⚡ EXECUTE TARGET ASSIGNMENT</span>
              </button>
            </div>
          </div>

          {/* Dossier Quick Preview */}
          <div className="glass-panel p-6 rounded-xl">
            <h3 className="text-sm font-mono font-semibold text-gray-300 uppercase tracking-wider mb-3">
              🎯 AGENT INTEL DOSSIER (SAMPLE)
            </h3>
            <div className="bg-gray-900/80 p-4 rounded-lg border border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-emerald-400 font-mono">
                <span>CODENAME: Agent Shadow</span>
                <span className="text-gray-500">ID: #01</span>
              </div>
              <p className="text-gray-300 text-xs">
                <span className="text-gray-500 font-mono">WISHLIST:</span> Mechanical keyboard switches, Dark roast coffee beans, Cybersecurity field manuals.
              </p>
              <div className="text-gray-400 text-xs pt-1 flex gap-3 font-mono">
                <span>SHIRT: L</span>
                <span>SHOE: 10.5</span>
                <span>FAV STORE: MicroCenter</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Interactive Draw Simulator */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Agent Roster Management */}
          <div className="glass-panel p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>👥 Field Agent Roster</span>
                <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                  {agents.length} Enlisted
                </span>
              </h2>
            </div>

            {/* Add Agent Form */}
            <form onSubmit={addAgent} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <input
                type="text"
                placeholder="Agent Full Name (e.g. John Doe)"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="bg-gray-900/90 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="Codename (Optional)"
                value={newAgentCodename}
                onChange={(e) => setNewAgentCodename(e.target.value)}
                className="bg-gray-900/90 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="bg-gray-800 hover:bg-gray-700 text-emerald-400 font-mono font-medium rounded-lg px-4 py-2 text-sm transition-colors cursor-pointer border border-emerald-500/20"
              >
                + Enlist Agent
              </button>
            </form>

            {/* Agent Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agents.map((agent) => (
                <div key={agent.id} className="bg-gray-900/60 border border-gray-800/80 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">{agent.name}</div>
                    <div className="text-xs font-mono text-emerald-400">{agent.codename}</div>
                  </div>
                  <button
                    onClick={() => removeAgent(agent.id)}
                    className="text-gray-500 hover:text-red-400 text-xs font-mono px-2 py-1 rounded hover:bg-red-950/40 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Linked-List Target Assignment Protocol Info */}
          <div className="glass-panel p-6 rounded-xl border border-emerald-500/20">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span>🔗 Linked-List Assignment Protocol</span>
              <span className="text-xs font-mono bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                ACTIVE
              </span>
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              KovertKlaus links agents in a cyclic permutation: <code className="text-emerald-400">A₁ ➔ A₂ ➔ A₃ ➔ ... ➔ Aₙ ➔ A₁</code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-gray-300">
              <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-800">
                <span className="text-emerald-400 font-bold">✓ 1-to-1 Guaranteed</span>
                <p className="text-gray-400 text-[11px] mt-1">Every operative gives exactly 1 gift and receives exactly 1 gift with zero multi-agent conflicts.</p>
              </div>
              <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-800">
                <span className="text-amber-400 font-bold">📋 Wishlist Enforcement</span>
                <p className="text-gray-400 text-[11px] mt-1">Operatives must attach a wishlist before Assignment Day or be dropped by the OpsLeader.</p>
              </div>
            </div>
          </div>

          {/* Draw Results Output Terminal */}
          <div className="glass-panel p-6 rounded-xl border border-emerald-500/30">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🔒 Classified Assignment Results</span>
              </h2>
              <button
                onClick={handleRunDraw}
                className="bg-emerald-600/80 hover:bg-emerald-500 text-white font-mono text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Run Protocol
              </button>
            </div>

            {drawError && (
              <div className="bg-red-950/80 border border-red-500 text-red-200 p-4 rounded-lg text-xs font-mono">
                ⚠️ ERROR: {drawError}
              </div>
            )}

            {!assignments && !drawError && (
              <div className="text-xs font-mono text-gray-500 py-8 text-center border border-dashed border-gray-800 rounded-lg">
                Click "EXECUTE TARGET ASSIGNMENT" above to generate classified Secret Santa assignments.
              </div>
            )}

            {assignments && (
              <div className="space-y-3">
                <div className="text-xs font-mono text-emerald-400 mb-2">
                  ✓ CLASSIFIED DERANGEMENT GENERATED SUCCESSFUL. 1-TO-1 TARGET ASSIGNMENTS ENCRYPTED.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {assignments.map(({ agentId, targetId }) => {
                    const giver = agents.find((a) => a.id === agentId);
                    const receiver = agents.find((a) => a.id === targetId);
                    return (
                      <div key={agentId} className="bg-gray-900/90 border border-emerald-500/20 p-3 rounded-lg font-mono text-xs">
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
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
