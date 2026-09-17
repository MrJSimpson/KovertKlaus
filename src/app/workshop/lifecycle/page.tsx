'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { getNextMilestoneCountdown, formatDateString } from '@/lib/security';

export type OperationPhase = 'RECRUITING' | 'SETUP' | 'ASSIGNED' | 'EXECUTED' | 'COMPLETED';

const STAGE_METADATA: Record<OperationPhase, { title: string; desc: string; color: string }> = {
  RECRUITING: {
    title: 'Stage 1: Recruiting & Enlistment',
    desc: 'Operatives accept mission invites, join the roster, and build their classified wishlists.',
    color: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  SETUP: {
    title: 'Stage 2: Setup & Matching Rules',
    desc: 'Recruitment is locked. OpsLeader configures bidirectional exclusion rules (A ⇔ B) before the draw.',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  ASSIGNED: {
    title: 'Stage 3: Assigned & Manifest Acquisition',
    desc: 'Sattolo derangement executed! Operatives inspect target wishlists and acquire classified Manifest Items.',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  EXECUTED: {
    title: 'Stage 4: Shipped & Pre-Exchange',
    desc: 'Manifest gifts in transit. Tracking numbers verified. Agents countdown to Exchange Day.',
    color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  COMPLETED: {
    title: 'Stage 5: Completed & AAR Debrief',
    desc: 'Mission accomplished! After-Action Reports posted, gifts unwrapped, demerits/rehabilitation resolved.',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
};

export default function WorkshopLifecycleBench() {
  const { theme, isDarkMode } = useTheme();

  // Virtual Date Simulation Engine (Defaulting to Mid-November 2026)
  const [virtualDate, setVirtualDate] = useState<string>('2026-11-15');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [autoSyncStage, setAutoSyncStage] = useState<boolean>(true);

  // Operation Stage & Schedule State
  const [phase, setPhase] = useState<OperationPhase>('RECRUITING');
  const [opName, setOpName] = useState<string>('Simpson Family Holiday Stealth Ops 2026');
  const [inviteCutoffDate, setInviteCutoffDate] = useState<string>('2026-11-20');
  const [assignmentDate, setAssignmentDate] = useState<string>('2026-11-25');
  const [shippingDate, setShippingDate] = useState<string>('2026-12-10');
  const [executionDate, setExecutionDate] = useState<string>('2026-12-25');

  // Simulated Interactive Modals
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Simulated Log Output
  const [eventLogs, setEventLogs] = useState<string[]>([
    'SYSTEM: Initialized Workshop 5-Stage Lifecycle Simulation Harness.',
    'STATUS: Simulated Operation initialized in RECRUITING stage.',
    'VIRTUAL CLOCK: Running at Nov 15, 2026 baseline.',
  ]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setEventLogs((prev) => [`[${time}] ${msg}`, ...prev]);
  };

  // Helper to step date by delta days
  const handleStepDays = (delta: number) => {
    const [y, m, d] = virtualDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + delta);
    const newY = dateObj.getFullYear();
    const newM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newD = String(dateObj.getDate()).padStart(2, '0');
    const nextDateStr = `${newY}-${newM}-${newD}`;
    setVirtualDate(nextDateStr);

    let logMsg = `TIME SHIFT: Moved virtual date by ${delta > 0 ? `+${delta}` : delta} day(s) ➔ ${nextDateStr}`;

    if (autoSyncStage) {
      let computedStage: OperationPhase = 'RECRUITING';
      if (nextDateStr >= executionDate) {
        computedStage = 'COMPLETED';
      } else if (nextDateStr >= shippingDate) {
        computedStage = 'EXECUTED';
      } else if (nextDateStr >= assignmentDate) {
        computedStage = 'ASSIGNED';
      } else if (nextDateStr >= inviteCutoffDate) {
        computedStage = 'SETUP';
      } else {
        computedStage = 'RECRUITING';
      }

      if (computedStage !== phase) {
        setPhase(computedStage);
        logMsg += ` (Auto-advanced mission stage to [${computedStage}])`;
      }
    }

    addLog(logMsg);
  };

  // Auto-play timeline simulation ticker effect
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      handleStepDays(1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, virtualDate, autoSyncStage, phase, inviteCutoffDate, assignmentDate, shippingDate, executionDate]);

  // Helper to compute virtual days remaining
  const calculateVirtualDaysRemaining = (targetDateStr: string) => {
    const [vY, vM, vD] = virtualDate.split('-').map(Number);
    const [tY, tM, tD] = targetDateStr.split('-').map(Number);
    const vDate = new Date(vY, vM - 1, vD);
    const tDate = new Date(tY, tM - 1, tD);
    const diffTime = tDate.getTime() - vDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getBadgeStyle = (days: number) => {
    if (days < 0) return 'bg-slate-800 text-gray-400 border-slate-700';
    if (days === 0)
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-lg shadow-emerald-950/40 animate-pulse';
    if (days <= 3)
      return 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-lg shadow-amber-950/40';
    return 'bg-sky-500/10 text-sky-300 border-sky-500/30';
  };

  const handleAdvancePhase = (nextPhase: OperationPhase) => {
    setPhase(nextPhase);
    addLog(`ACTION: Transitioned Operation stage to [${nextPhase}].`);
  };

  // Simulated Mission Object for JSON trace
  const simulatedMission = {
    title: opName,
    status: phase,
    inviteCutoffDate,
    assignmentDate,
    shippingDate,
    executionDate,
    virtualSystemDate: virtualDate,
  };

  const countdownInfo = getNextMilestoneCountdown(simulatedMission);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-amber-500 animate-pulse inline-block"></span>
            <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-amber-950/80 text-amber-300 border border-amber-500/30">
              WORKSHOP LAB // 5-STAGE MISSION LIFECYCLE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 text-white flex items-center gap-2">
            <span>5-Stage Mission Phase & Time-Shift Simulator</span>
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1">
            Simulate virtual calendar timelines, inspect milestone countdown badges, and test phase-scoped OpsLeader admin controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/workshop/draw"
            className="bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1"
          >
            🎯 Draw & Swap
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
            ← Workshop Hub
          </Link>
        </div>
      </div>

      {/* 5-Stage Progression Timeline Step Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-2 px-1">
          <span>MISSION STAGE PROGRESSION</span>
          <span className="text-amber-400 font-bold">{phase}</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {(['RECRUITING', 'SETUP', 'ASSIGNED', 'EXECUTED', 'COMPLETED'] as OperationPhase[]).map((stage, idx) => {
            const isCurrent = phase === stage;
            const isPassed =
              ['RECRUITING', 'SETUP', 'ASSIGNED', 'EXECUTED', 'COMPLETED'].indexOf(phase) >= idx;
            return (
              <button
                key={stage}
                onClick={() => handleAdvancePhase(stage)}
                className={`py-2 px-2 rounded-xl text-[11px] font-mono font-bold text-center border transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-950/60 scale-[1.02]'
                    : isPassed
                    ? 'bg-slate-800 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 text-gray-500 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] opacity-75">{idx + 1}. STAGE</div>
                <div className="truncate">{stage}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Virtual Time Control & Target Dates */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Virtual Clock Panel */}
          <div className="p-6 rounded-2xl border bg-slate-900 border-amber-500/40 shadow-xl">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-2">
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

              {/* Day-by-Day Stepping Controls */}
              <div className="pt-2 pb-1 space-y-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                    <span>⚡ TIMELINE STEPPER</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-normal">Step day-by-day</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 font-mono">
                  <button
                    onClick={() => handleStepDays(-7)}
                    className="bg-slate-800 hover:bg-slate-700 text-gray-300 py-2 px-1 rounded-lg text-xs font-bold border border-slate-700 hover:border-slate-600 transition-all cursor-pointer text-center"
                    title="Rewind 7 Days"
                  >
                    -7d ⏪
                  </button>
                  <button
                    onClick={() => handleStepDays(-1)}
                    className="bg-slate-800 hover:bg-slate-700 text-gray-300 py-2 px-1 rounded-lg text-xs font-bold border border-slate-700 hover:border-slate-600 transition-all cursor-pointer text-center"
                    title="Rewind 1 Day"
                  >
                    -1 Day ◀
                  </button>
                  <button
                    onClick={() => handleStepDays(1)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 py-2 px-1 rounded-lg text-xs font-black border border-amber-400 shadow-md shadow-amber-950/50 transition-all cursor-pointer text-center"
                    title="Advance 1 Day Forward"
                  >
                    +1 Day ▶
                  </button>
                  <button
                    onClick={() => handleStepDays(7)}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-300 py-2 px-1 rounded-lg text-xs font-bold border border-slate-700 hover:border-slate-600 transition-all cursor-pointer text-center"
                    title="Advance 7 Days Forward"
                  >
                    +7d ⏩
                  </button>
                </div>

                {/* Auto Play / Pause Simulator Toggle */}
                <div className="pt-1">
                  <button
                    onClick={() => {
                      setIsPlaying(!isPlaying);
                      addLog(isPlaying ? 'TICKER: Paused automated date ticker.' : 'TICKER: Started automated +1 day/sec simulation ticker.');
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                      isPlaying
                        ? 'bg-rose-950 text-rose-200 border-rose-500 shadow-lg shadow-rose-950/50 animate-pulse'
                        : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-950/40'
                    }`}
                  >
                    <span>{isPlaying ? '⏸️ PAUSE SIMULATION TICKER' : '▶️ AUTO-PLAY TICKER (+1 Day / sec)'}</span>
                  </button>
                </div>

                {/* Auto-Sync Stage Checkbox */}
                <label className="flex items-start gap-2 pt-1 cursor-pointer select-none text-[11px] text-gray-400 font-sans leading-tight">
                  <input
                    type="checkbox"
                    checked={autoSyncStage}
                    onChange={(e) => setAutoSyncStage(e.target.checked)}
                    className="accent-amber-500 w-3.5 h-3.5 rounded mt-0.5"
                  />
                  <span>Auto-advance mission phase (1-5) as calendar crosses deadlines</span>
                </label>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] text-gray-400 block font-sans">1-Click Milestone Jumps:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setVirtualDate('2026-11-20');
                      setPhase('RECRUITING');
                      addLog('PRESET: Jumped to RSVP Cutoff Day (Nov 20, 2026)');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-sky-300 p-2 rounded-lg text-[11px] text-left border border-slate-700 cursor-pointer"
                  >
                    <div className="font-bold">RSVP Cutoff</div>
                    <div className="text-[10px] text-gray-400">Nov 20, 2026</div>
                  </button>

                  <button
                    onClick={() => {
                      setVirtualDate('2026-11-25');
                      setPhase('SETUP');
                      addLog('PRESET: Jumped to Draw Day (Nov 25, 2026)');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-300 p-2 rounded-lg text-[11px] text-left border border-slate-700 cursor-pointer"
                  >
                    <div className="font-bold">Draw Day 🎲</div>
                    <div className="text-[10px] text-gray-400">Nov 25, 2026</div>
                  </button>

                  <button
                    onClick={() => {
                      setVirtualDate('2026-12-08');
                      setPhase('ASSIGNED');
                      addLog('PRESET: Jumped to 2-Day Urgent Ship Window (Dec 8, 2026)');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-rose-300 p-2 rounded-lg text-[11px] text-left border border-slate-700 cursor-pointer"
                  >
                    <div className="font-bold">Ship Urgent ⏳</div>
                    <div className="text-[10px] text-gray-400">Dec 8 (2d left)</div>
                  </button>

                  <button
                    onClick={() => {
                      setVirtualDate('2026-12-25');
                      setPhase('EXECUTED');
                      addLog('PRESET: Jumped to Exchange Day! (Dec 25, 2026)');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-emerald-300 p-2 rounded-lg text-[11px] text-left border border-slate-700 cursor-pointer"
                  >
                    <div className="font-bold">Exchange Day! 🎉</div>
                    <div className="text-[10px] text-gray-400">Dec 25, 2026</div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Operation Milestone Target Dates */}
          <div className="p-6 rounded-2xl border bg-slate-900 border-slate-800">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-4">
              🎯 OPERATION TARGET SCHEDULE
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

          {/* Operation Header & Stage Description */}
          <div className="p-6 rounded-2xl border bg-slate-900 border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-widest">
                  OPERATION SCHEDULE MONITOR
                </div>
                <h2 className="text-xl font-black text-white mt-1">{opName}</h2>
                <p className="text-xs text-gray-400 mt-1">{STAGE_METADATA[phase].desc}</p>
              </div>

              {/* Stage Badge Pill */}
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-bold px-3 py-1.5 rounded-full border shadow-md ${STAGE_METADATA[phase].color}`}>
                  {phase}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Milestone Badges Real-Time Monitor */}
          <div className="p-6 rounded-2xl border bg-slate-900 border-amber-500/30">
            <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>⏱️ REAL-TIME MILESTONE COUNTDOWN BADGES</span>
              <span className="text-[11px] font-normal text-gray-400">Virtual Date: {virtualDate}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              
              {/* RSVP Badge */}
              {(() => {
                const days = calculateVirtualDaysRemaining(inviteCutoffDate);
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
                const days = calculateVirtualDaysRemaining(assignmentDate);
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
                const days = calculateVirtualDaysRemaining(shippingDate);
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
                const days = calculateVirtualDaysRemaining(executionDate);
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

          {/* Phase-Scoped OpsLeader Console Action Suite */}
          <div className="p-6 rounded-2xl border bg-slate-900 border-slate-800">
            <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>🎖️ PHASE-SCOPED OPSLEADER CONSOLE BUTTONS</span>
              <span className="text-xs text-amber-400">{phase} ACTIONS</span>
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Verifies that only authorized OpsLeader action buttons appear for the current stage.
            </p>

            <div className="flex flex-wrap gap-3 font-mono text-xs">
              {phase === 'RECRUITING' && (
                <>
                  <button
                    onClick={() => {
                      setActiveModal('INVITE');
                      addLog('ACTION: Triggered [Invite Agent Modal]');
                    }}
                    className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    ➕ Invite Agent
                  </button>
                  <button
                    onClick={() => {
                      handleAdvancePhase('SETUP');
                      addLog('ACTION: Closed Recruitment -> Advanced to SETUP stage.');
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    🔒 Close Recruitment
                  </button>
                </>
              )}

              {phase === 'SETUP' && (
                <>
                  <button
                    onClick={() => {
                      setActiveModal('RULES');
                      addLog('ACTION: Opened [Bidirectional Match Rules Editor (A ⇔ B)]');
                    }}
                    className="bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    🚫 Match Rules (A ⇔ B)
                  </button>
                  <button
                    onClick={() => {
                      handleAdvancePhase('ASSIGNED');
                      addLog('ACTION: Executed Sattolo Derangement -> Advanced to ASSIGNED stage.');
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    🎲 Execute Sattolo Target Draw
                  </button>
                </>
              )}

              {(phase === 'ASSIGNED' || phase === 'EXECUTED') && (
                <>
                  <button
                    onClick={() => {
                      setActiveModal('BROADCAST');
                      addLog('ACTION: Opened [OpTeam Broadcast Alert Modal]');
                    }}
                    className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    📢 OpTeam Broadcast Alert
                  </button>
                  <button
                    onClick={() => {
                      setActiveModal('SWAP');
                      addLog('ACTION: Opened [2-Way Cascade Target Swap Console]');
                    }}
                    className="bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    🎯 2-Way Target Swap Console
                  </button>
                  <button
                    onClick={() => {
                      handleAdvancePhase('COMPLETED');
                      addLog('ACTION: Ended Operation -> Advanced to COMPLETED stage.');
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    🏁 End Operation Event
                  </button>
                </>
              )}

              {phase === 'COMPLETED' && (
                <>
                  <button
                    onClick={() => {
                      setActiveModal('DEMERIT');
                      addLog('ACTION: Opened [Demerit Penalty & Coal Citation Console]');
                    }}
                    className="bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    ⚠️ Issue Demerit Citation
                  </button>
                  <button
                    onClick={() => {
                      setActiveModal('AAR');
                      addLog('ACTION: Opened [After-Action Report Debrief Photo Feed]');
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    📸 View AAR Debrief Feed
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Modal Preview Staging Box (if active) */}
          {activeModal && (
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/50 flex items-center justify-between">
              <div className="text-xs font-mono text-amber-300">
                <span className="font-bold">MODAL STAGED:</span> [{activeModal}] Dispatch handler confirmed active.
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-xs text-gray-400 hover:text-white underline cursor-pointer"
              >
                Dismiss Preview
              </button>
            </div>
          )}

          {/* Event Log Output Terminal */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs">
            <div className="flex items-center justify-between text-gray-400 border-b border-slate-800 pb-2 mb-3">
              <span>🖥️ SIMULATION EVENT LOG</span>
              <button onClick={() => setEventLogs([])} className="text-[11px] text-gray-500 hover:text-rose-400 cursor-pointer">
                Clear Terminal
              </button>
            </div>
            <div className="h-32 overflow-y-auto space-y-1 text-slate-300">
              {eventLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={
                    log.includes('ACTION')
                      ? 'text-amber-300'
                      : log.includes('TIME') || log.includes('PRESET')
                      ? 'text-sky-300'
                      : 'text-gray-400'
                  }
                >
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
