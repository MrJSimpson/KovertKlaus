'use client';

import { useState } from 'react';
import Link from 'next/link';

export type OperationPhase = 'RECRUITING' | 'SETUP' | 'ASSIGNED' | 'EXECUTED' | 'COMPLETED';

export default function WorkshopLifecycleBench() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Virtual Date Simulation Engine
  const [virtualDate, setVirtualDate] = useState<string>('2026-11-15');

  // Operation Stage & Schedule State
  const [phase, setPhase] = useState<OperationPhase>('RECRUITING');
  const [opName, setOpName] = useState<string>('Simpson Family Holiday Stealth Ops 2026');
  const [inviteCutoffDate, setInviteCutoffDate] = useState<string>('2026-11-20');
  const [assignmentDate, setAssignmentDate] = useState<string>('2026-11-25');
  const [shippingDate, setShippingDate] = useState<string>('2026-12-10');
  const [executionDate, setExecutionDate] = useState<string>('2026-12-25');

  // Simulated Log Output
  const [eventLogs, setEventLogs] = useState<string[]>([
    'SYSTEM: Initialized Workshop Lifecycle Simulation Harness.',
    'STATUS: Operation created in RECRUITING stage.',
  ]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setEventLogs((prev) => [`[${time}] ${msg}`, ...prev]);
  };

  const calculateDaysRemaining = (targetDateStr: string) => {
    const vDate = new Date(virtualDate);
    const tDate = new Date(targetDateStr);
    const diffTime = tDate.getTime() - vDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getBadgeStyle = (days: number) => {
    if (days < 0) return 'bg-gray-800 text-gray-400 border-gray-700';
    if (days === 0)
      return isDarkMode
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 animate-pulse'
        : 'bg-emerald-100 text-emerald-950 border-emerald-300 animate-pulse';
    if (days <= 3)
      return isDarkMode
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
        : 'bg-amber-100 text-amber-950 border-amber-300';
    return isDarkMode
      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
      : 'bg-red-50 text-red-700 border-red-200';
  };

  const handleAdvancePhase = (nextPhase: OperationPhase) => {
    setPhase(nextPhase);
    if (nextPhase === 'SETUP') setInviteCutoffDate(virtualDate);
    if (nextPhase === 'ASSIGNED') setAssignmentDate(virtualDate);
    if (nextPhase === 'EXECUTED') setShippingDate(virtualDate);
    if (nextPhase === 'COMPLETED') setExecutionDate(virtualDate);

    addLog(`ACTION: Advanced Operation stage to [${nextPhase}]. Milestone target date updated to virtual today (${virtualDate}).`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HUD Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-amber-500 animate-pulse inline-block"></span>
            <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-amber-950/80 text-amber-300 border border-amber-500/30">
              WORKSHOP LAB // 5-PHASE SCHEDULE SIMULATOR
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 text-white flex items-center gap-2">
            <span>Dynamic Lifecycle & Virtual Date Simulator</span>
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1">
            Simulate virtual calendar timelines, milestone countdown badges, and phase-scoped OpsLeader admin controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/workshop/draw"
            className="bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            🎯 Sattolo
          </Link>
          <Link
            href="/workshop/scraper"
            className="bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            🔎 Scraper
          </Link>
          <Link
            href="/workshop"
            className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors"
          >
            ← Hub
          </Link>
        </div>
      </div>

      {/* Main Harness Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Virtual Time Control & Target Dates */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Virtual Clock Panel */}
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-amber-500/40">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
              <span>📅 VIRTUAL SYSTEM DATE OVERRIDE</span>
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Shift virtual system time to test how date schedules and badges react in real time.
            </p>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-gray-300 mb-1 font-bold">VIRTUAL TODAY (System Time):</label>
                <input
                  type="date"
                  value={virtualDate}
                  onChange={(e) => {
                    setVirtualDate(e.target.value);
                    addLog(`TIME SHIFT: Virtual system date set to ${e.target.value}`);
                  }}
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <span className="text-[11px] text-gray-400 block font-sans">Timeline Quick Presets:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setVirtualDate('2026-11-20'); addLog('PRESET: Jumped to RSVP Cutoff Day (Nov 20)'); }}
                    className="bg-slate-800 hover:bg-slate-700 text-sky-300 px-2 py-1.5 rounded text-[11px] text-left border border-slate-700 cursor-pointer"
                  >
                    RSVP Cutoff (Nov 20)
                  </button>
                  <button
                    onClick={() => { setVirtualDate('2026-11-25'); addLog('PRESET: Jumped to Draw Day (Nov 25)'); }}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-1.5 rounded text-[11px] text-left border border-slate-700 cursor-pointer"
                  >
                    Draw Day (Nov 25)
                  </button>
                  <button
                    onClick={() => { setVirtualDate('2026-12-10'); addLog('PRESET: Jumped to Shipping Deadline (Dec 10)'); }}
                    className="bg-slate-800 hover:bg-slate-700 text-purple-300 px-2 py-1.5 rounded text-[11px] text-left border border-slate-700 cursor-pointer"
                  >
                    Ship Deadline (Dec 10)
                  </button>
                  <button
                    onClick={() => { setVirtualDate('2026-12-25'); addLog('PRESET: Jumped to Exchange Day (Dec 25)'); }}
                    className="bg-slate-800 hover:bg-slate-700 text-emerald-300 px-2 py-1.5 rounded text-[11px] text-left border border-slate-700 cursor-pointer"
                  >
                    Exchange Day! (Dec 25)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Operation Milestone Target Dates */}
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-slate-800">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-4">
              🎯 OPERATION TARGET MILESTONES
            </h2>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-gray-400 mb-1">1. Invite Cutoff (RSVP):</label>
                <input
                  type="date"
                  value={inviteCutoffDate}
                  onChange={(e) => setInviteCutoffDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">2. Target Draw Date:</label>
                <input
                  type="date"
                  value={assignmentDate}
                  onChange={(e) => setAssignmentDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">3. Shipping Deadline:</label>
                <input
                  type="date"
                  value={shippingDate}
                  onChange={(e) => setShippingDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">4. Exchange Event Date:</label>
                <input
                  type="date"
                  value={executionDate}
                  onChange={(e) => setExecutionDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Center & Right Column: Stage Console & Live Badge Output */}
        <div className="lg:col-span-2 space-y-6">

          {/* Operation Header & Stage Selector */}
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-widest">ACTIVE STAGE PREVIEW</div>
                <h2 className="text-xl font-black text-white mt-1">{opName}</h2>
              </div>

              {/* Stage Badge Pill */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400">STAGE:</span>
                <span className={`font-mono text-xs font-bold px-3 py-1.5 rounded-full border shadow-md ${
                  phase === 'RECRUITING' ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' :
                  phase === 'SETUP' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                  phase === 'ASSIGNED' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                  phase === 'EXECUTED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {phase}
                </span>
              </div>
            </div>

            {/* Stage Selector Buttons */}
            <div className="mt-6 pt-4 border-t border-gray-800">
              <label className="block text-xs font-mono text-gray-400 mb-2">MANUALLY SWITCH STAGE:</label>
              <div className="flex flex-wrap gap-2">
                {(['RECRUITING', 'SETUP', 'ASSIGNED', 'EXECUTED', 'COMPLETED'] as OperationPhase[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleAdvancePhase(p)}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                      phase === p
                        ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-950/60'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Milestone Badges Real-Time Monitor */}
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-amber-500/30">
            <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>⏱️ REAL-TIME MILESTONE COUNTDOWN BADGES</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              
              {/* RSVP Badge */}
              {(() => {
                const days = calculateDaysRemaining(inviteCutoffDate);
                return (
                  <div className={`p-4 rounded-xl border ${getBadgeStyle(days)}`}>
                    <div className="text-[11px] opacity-80 uppercase">RSVP CUTOFF BADGE</div>
                    <div className="text-lg font-black mt-1">
                      {days < 0 ? 'RSVP Closed' : days === 0 ? 'RSVP Cutoff Day!' : `${days} Days Left`}
                    </div>
                    <div className="text-[11px] opacity-75 mt-1">Target: {inviteCutoffDate}</div>
                  </div>
                );
              })()}

              {/* Assignment Badge */}
              {(() => {
                const days = calculateDaysRemaining(assignmentDate);
                return (
                  <div className={`p-4 rounded-xl border ${getBadgeStyle(days)}`}>
                    <div className="text-[11px] opacity-80 uppercase">TARGET DRAW BADGE</div>
                    <div className="text-lg font-black mt-1">
                      {days < 0 ? 'Draw Completed' : days === 0 ? 'Target Draw Day! 🎉' : `${days} Days to Draw`}
                    </div>
                    <div className="text-[11px] opacity-75 mt-1">Target: {assignmentDate}</div>
                  </div>
                );
              })()}

              {/* Shipping Badge */}
              {(() => {
                const days = calculateDaysRemaining(shippingDate);
                return (
                  <div className={`p-4 rounded-xl border ${getBadgeStyle(days)}`}>
                    <div className="text-[11px] opacity-80 uppercase">SHIPPING DEADLINE BADGE</div>
                    <div className="text-lg font-black mt-1">
                      {days < 0 ? 'Shipping Closed' : days === 0 ? 'Shipping Deadline Day!' : `${days} Days to Ship`}
                    </div>
                    <div className="text-[11px] opacity-75 mt-1">Target: {shippingDate}</div>
                  </div>
                );
              })()}

              {/* Exchange Badge */}
              {(() => {
                const days = calculateDaysRemaining(executionDate);
                return (
                  <div className={`p-4 rounded-xl border ${getBadgeStyle(days)}`}>
                    <div className="text-[11px] opacity-80 uppercase">EXCHANGE EVENT BADGE</div>
                    <div className="text-lg font-black mt-1">
                      {days < 0 ? 'Operation Completed' : days === 0 ? 'Exchange Day! 🎉' : `${days} Days to Exchange`}
                    </div>
                    <div className="text-[11px] opacity-75 mt-1">Target: {executionDate}</div>
                  </div>
                );
              })()}

            </div>
          </div>

          {/* Phase-Scoped OpsLeader Console Preview */}
          <div className="p-6 rounded-2xl border-2 bg-slate-900 border-slate-800">
            <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>🎖️ PHASE-SCOPED OPSLEADER CONSOLE BUTTONS</span>
              <span className="text-xs text-amber-400">{phase} PERMISSIONS</span>
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Verifies that only authorized OpsLeader action buttons appear for the current stage.
            </p>

            <div className="flex flex-wrap gap-3 font-mono text-xs">
              {phase === 'RECRUITING' && (
                <>
                  <button onClick={() => addLog('DISPATCH: Opened Invite Agent Modal')} className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">
                    ➕ Invite Agent
                  </button>
                  <button onClick={() => handleAdvancePhase('SETUP')} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">
                    🔒 Close Recruitment
                  </button>
                </>
              )}

              {phase === 'SETUP' && (
                <>
                  <button onClick={() => addLog('DISPATCH: Opened Emergency Invite Modal')} className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">
                    ⚡ Emergency Invite
                  </button>
                  <button onClick={() => addLog('DISPATCH: Opened Bidirectional Matching Rules Modal')} className="bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">
                    🚫 Matching Rules ($A \iff B$)
                  </button>
                  <button onClick={() => handleAdvancePhase('ASSIGNED')} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">
                    🎲 Initiate Target Assignments
                  </button>
                </>
              )}

              {(phase === 'ASSIGNED' || phase === 'EXECUTED') && (
                <>
                  <button onClick={() => addLog('DISPATCH: Opened OpTeam Broadcast Alert Modal')} className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">
                    📢 Send OpTeam Broadcast
                  </button>
                  <button onClick={() => addLog('DISPATCH: Opened Target Swap Dropdown Modal')} className="bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">
                    🎯 Target Swap Console
                  </button>
                  <button onClick={() => handleAdvancePhase('COMPLETED')} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">
                    🏁 End Operation
                  </button>
                </>
              )}

              {phase === 'COMPLETED' && (
                <>
                  <button onClick={() => addLog('DISPATCH: Opened Demerit Citation Console')} className="bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">
                    ⚠️ Issue Demerit Citation
                  </button>
                  <button onClick={() => addLog('DISPATCH: Opened AAR Debrief Photo Upload')} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">
                    📸 View AAR Debrief Feed
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Event Log Output Terminal */}
          <div className="bg-slate-950 border border-gray-800 rounded-xl p-4 font-mono text-xs">
            <div className="flex items-center justify-between text-gray-400 border-b border-gray-800 pb-2 mb-3">
              <span>🖥️ SIMULATION EVENT LOG</span>
              <button onClick={() => setEventLogs([])} className="text-[11px] text-gray-500 hover:text-red-400 cursor-pointer">Clear Terminal</button>
            </div>
            <div className="h-32 overflow-y-auto space-y-1 text-slate-300">
              {eventLogs.map((log, idx) => (
                <div key={idx} className={log.includes('ACTION') ? 'text-amber-300' : log.includes('TIME') ? 'text-sky-300' : 'text-gray-400'}>
                  {log}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
