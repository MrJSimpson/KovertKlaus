'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import {
  initializePartyGame,
  getEligibleGiftsForActivePlayer,
  pickGiftFromPile,
  swapGiftWithPlayer,
  resolvePlayer1FinalChoice,
  completePartyGame,
  WhiteElephantOperative,
  WhiteElephantGameState,
} from '@/lib/whiteElephant';

const PRESETS: Record<string, WhiteElephantOperative[]> = {
  simpsons: [
    { userId: 'u-1', name: 'Homer Simpson', codename: 'DuffMan' },
    { userId: 'u-2', name: 'Marge Simpson', codename: 'BlueBeehive' },
    { userId: 'u-3', name: 'Bart Simpson', codename: 'ElBarto' },
    { userId: 'u-4', name: 'Lisa Simpson', codename: 'Saxophone' },
    { userId: 'u-5', name: 'Ned Flanders', codename: 'OkilyDokily' },
  ],
  squad: [
    { userId: 'u-10', name: 'Han Solo', codename: 'Falcon' },
    { userId: 'u-11', name: 'Chewbacca', codename: 'Chewie' },
    { userId: 'u-12', name: 'Princess Leia', codename: 'Alderaan' },
    { userId: 'u-13', name: 'Luke Skywalker', codename: 'JediKnight' },
    { userId: 'u-14', name: 'Lando Calrissian', codename: 'CloudCity' },
    { userId: 'u-15', name: 'R2-D2', codename: 'Astromech' },
  ],
  large: [
    { userId: 'u-21', name: 'Clark Griswold', codename: 'Sparky' },
    { userId: 'u-22', name: 'Ellen Griswold', codename: 'Sparkle' },
    { userId: 'u-23', name: 'Cousin Eddie', codename: 'Ten-Four' },
    { userId: 'u-24', name: 'Audrey Griswold', codename: 'Daughter' },
    { userId: 'u-25', name: 'Rusty Griswold', codename: 'Son' },
    { userId: 'u-26', name: 'Uncle Lewis', codename: 'Stogie' },
    { userId: 'u-27', name: 'Aunt Bethany', codename: 'Grace' },
    { userId: 'u-28', name: 'Mr. Shirley', codename: 'Boss' },
  ],
};

export default function WhiteElephantPartyBench() {
  const { theme, isDarkMode } = useTheme();

  // Selected Preset & Game Engine State
  const [selectedPreset, setSelectedPreset] = useState<string>('simpsons');
  const [allowPlayer1Swap, setAllowPlayer1Swap] = useState<boolean>(true);
  const [gameState, setGameState] = useState<WhiteElephantGameState>(() =>
    initializePartyGame(PRESETS.simpsons, { allowPlayer1FinalSwap: true })
  );

  // Selected Swap Target from dropdown/modal
  const [selectedSwapGiftId, setSelectedSwapGiftId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [unboxingCountdown, setUnboxingCountdown] = useState<number | null>(null);

  const resetGame = (presetKey: string = selectedPreset, p1Swap: boolean = allowPlayer1Swap) => {
    setSelectedPreset(presetKey);
    setAllowPlayer1Swap(p1Swap);
    setErrorMessage('');
    setSelectedSwapGiftId('');
    setUnboxingCountdown(null);
    setGameState(initializePartyGame(PRESETS[presetKey], { allowPlayer1FinalSwap: p1Swap }));
  };

  // Compute eligible moves for currently active player
  const { unclaimed, swappable } = getEligibleGiftsForActivePlayer(gameState);

  const activeUserId = gameState.cascadeVictimUserId || gameState.activePlayerUserId;
  const activeOperative = gameState.operatives.find((o) => o.userId === activeUserId);
  const activeHeldGift = gameState.gifts.find((g) => g.currentHolderUserId === activeUserId);

  // Actions
  const handlePickFromPile = (giftId: string) => {
    if (!activeUserId) return;
    setErrorMessage('');
    try {
      const nextState = pickGiftFromPile(gameState, activeUserId, giftId);
      setGameState(nextState);
      if (nextState.phase === 'GRAND_UNBOXING') {
        triggerUnboxingCountdown();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Pick failed');
    }
  };

  const handleSwapGift = (targetGiftId: string) => {
    if (!activeUserId) return;
    setErrorMessage('');
    try {
      const nextState = swapGiftWithPlayer(gameState, activeUserId, targetGiftId);
      setGameState(nextState);
      setSelectedSwapGiftId('');
      if (nextState.phase === 'GRAND_UNBOXING') {
        triggerUnboxingCountdown();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Swap failed');
    }
  };

  const handlePlayer1Choice = (choice: 'KEEP' | 'SWAP', targetGiftId?: string) => {
    setErrorMessage('');
    try {
      const nextState = resolvePlayer1FinalChoice(gameState, choice, targetGiftId);
      setGameState(nextState);
      triggerUnboxingCountdown();
    } catch (err: any) {
      setErrorMessage(err.message || 'Player 1 choice failed');
    }
  };

  const triggerUnboxingCountdown = () => {
    setUnboxingCountdown(3);
    const interval = setInterval(() => {
      setUnboxingCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setGameState((s) => completePartyGame(s));
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-purple-500 animate-pulse inline-block"></span>
            <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-purple-950/80 text-purple-300 border border-purple-500/30">
              WORKSHOP LAB // IN-PERSON WHITE ELEPHANT BOARD
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 text-white flex items-center gap-2">
            <span>🏷️ Labeled Blind Mystery Swap & Scoreboard</span>
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1">
            Gifts remain 100% wrapped & labeled "FROM: AGENT &lt;NAME&gt;". Track turn order, 3-swap freeze rules, and grand unboxing!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/workshop/draw"
            className="bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors"
          >
            🎯 Draw
          </Link>
          <Link
            href="/workshop/lifecycle"
            className="bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors"
          >
            ⏱️ Lifecycle
          </Link>
          <Link
            href="/workshop"
            className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors"
          >
            ← Workshop Hub
          </Link>
        </div>
      </div>

      {/* Preset Controls & Game Configuration Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-gray-400">Roster Presets:</span>
          {Object.keys(PRESETS).map((key) => (
            <button
              key={key}
              onClick={() => resetGame(key)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer border ${
                selectedPreset === key
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-950/60'
                  : 'bg-slate-800 text-gray-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {key === 'simpsons' ? '🍩 Simpsons (5)' : key === 'squad' ? '🚀 Squad (6)' : '🎄 Griswolds (8)'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-mono text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allowPlayer1Swap}
              onChange={(e) => resetGame(selectedPreset, e.target.checked)}
              className="accent-purple-500 w-3.5 h-3.5 rounded"
            />
            <span>👑 Player 1 Final Swap</span>
          </label>

          <button
            onClick={() => resetGame()}
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer"
          >
            🔄 Reset Board
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-mono">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Grand Unboxing Countdown Overlay Banner */}
      {unboxingCountdown !== null && (
        <div className="p-8 rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-950 border border-purple-500 text-center shadow-2xl animate-pulse space-y-3">
          <div className="text-sm font-mono font-bold text-purple-300 uppercase tracking-widest">
            🎉 ALL SWAP ROUNDS COMPLETE!
          </div>
          <div className="text-4xl sm:text-6xl font-black text-white">
            GRAND UNBOXING IN: {unboxingCountdown}
          </div>
          <p className="text-xs text-purple-200 font-mono">
            Get ready to unwrap your physical mystery gifts together! 🎁
          </p>
        </div>
      )}

      {/* Main Party Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Columns: Live Board & Active Player Console */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active Turn HUD Panel */}
          {gameState.phase === 'TURNS' && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-purple-500/40 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="text-[11px] font-mono text-purple-400 font-bold uppercase tracking-wider">
                    {gameState.cascadeVictimUserId ? '🔄 SWAP CASCADE IN PROGRESS' : `ROUND ${gameState.currentTurnIndex + 1} OF ${gameState.turnOrder.length}`}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5 flex items-center gap-2">
                    <span>👉 Active Turn:</span>
                    <span className="text-amber-400">Agent {activeOperative?.codename || activeOperative?.name}</span>
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-3 py-1.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/40">
                    Turn {gameState.currentTurnIndex + 1}/{gameState.turnOrder.length}
                  </span>
                </div>
              </div>

              {/* Action Decision: Pick from Pile vs. Swap */}
              <div className="space-y-4 pt-1">
                <div className="text-xs font-mono text-gray-300">
                  {activeHeldGift ? (
                    <span>Currently holding: <strong className="text-amber-300">[{activeHeldGift.displayLabel}]</strong></span>
                  ) : (
                    <span>Currently has: <strong className="text-gray-400">Empty Hands (Must Pick or Steal)</strong></span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Action A: Pick from Pile */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        🎁 1. PICK UNCLAIMED GIFT
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">{unclaimed.length} Available</span>
                    </div>

                    {unclaimed.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {unclaimed.map((gift) => (
                          <button
                            key={gift.id}
                            onClick={() => handlePickFromPile(gift.id)}
                            className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-emerald-950 text-emerald-300 border border-slate-700 hover:border-emerald-500 text-xs font-mono font-bold text-left transition-all cursor-pointer flex items-center justify-between"
                          >
                            <span>🎁 {gift.displayLabel}</span>
                            <span className="text-[10px] text-emerald-400 font-normal">Pick ▶</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs font-mono text-gray-500 border border-dashed border-slate-800 rounded-xl">
                        All gifts claimed from pile! (Swaps only)
                      </div>
                    )}
                  </div>

                  {/* Action B: Swap with Operative */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-purple-400">
                        🔀 2. SWAP WITH OPERATIVE
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">{swappable.length} Eligible</span>
                    </div>

                    {swappable.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {swappable.map((gift) => {
                          const holderOp = gameState.operatives.find((o) => o.userId === gift.currentHolderUserId);
                          return (
                            <button
                              key={gift.id}
                              onClick={() => handleSwapGift(gift.id)}
                              className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-purple-950 text-purple-200 border border-slate-700 hover:border-purple-500 text-xs font-mono font-bold text-left transition-all cursor-pointer flex items-center justify-between"
                            >
                              <div>
                                <div>🔀 {gift.displayLabel}</div>
                                <div className="text-[10px] text-gray-400 font-normal">
                                  Held by: Agent {holderOp?.codename || holderOp?.name} ({gift.swapCount}/3)
                                </div>
                              </div>
                              <span className="text-[10px] text-purple-300">Swap ▶</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs font-mono text-gray-500 border border-dashed border-slate-800 rounded-xl">
                        No eligible gifts available to swap yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Player 1 Final Swap Privilege Panel */}
          {gameState.phase === 'PLAYER_1_FINAL' && (
            <div className="p-6 rounded-3xl bg-amber-950/60 border border-amber-500 text-amber-100 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                    👑 PLAYER 1 FINAL PRIVILEGE
                  </span>
                  <h3 className="text-xl font-black text-white mt-1">
                    Agent {gameState.operatives.find((o) => o.userId === gameState.turnOrder[0])?.codename}, Final Choice!
                  </h3>
                  <p className="text-xs text-amber-200/90 font-mono mt-0.5">
                    As Player 1, you picked first with zero swap options. You may now keep your gift or make one final swap!
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={() => handlePlayer1Choice('KEEP')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-lg"
                >
                  ✓ Keep My Mystery Gift (Unwrap Now)
                </button>

                {swappable.map((gift) => {
                  const holderOp = gameState.operatives.find((o) => o.userId === gift.currentHolderUserId);
                  return (
                    <button
                      key={gift.id}
                      onClick={() => handlePlayer1Choice('SWAP', gift.id)}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
                    >
                      <span>🔀 Final Swap for [{gift.displayLabel}]</span>
                      <span className="text-[10px] opacity-75">({holderOp?.codename})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grand Unboxing Completed Celebration Summary */}
          {gameState.phase === 'COMPLETED' && (
            <div className="p-6 rounded-3xl bg-emerald-950/70 border border-emerald-500/60 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-500/30">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase bg-emerald-500 text-slate-950 px-2 py-0.5 rounded">
                    🎉 GRAND UNBOXING COMPLETE
                  </span>
                  <h3 className="text-2xl font-black text-white mt-1">
                    All Physical Gifts Unwrapped!
                  </h3>
                </div>
                <button
                  onClick={() => resetGame()}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                >
                  Play Again 🔄
                </button>
              </div>

              <p className="text-xs font-mono text-emerald-200">
                Final Giver ➔ Winner Pairings. Thank your giving agent in person!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                {gameState.gifts.map((gift) => {
                  const winnerOp = gameState.operatives.find((o) => o.userId === gift.currentHolderUserId);
                  return (
                    <div key={gift.id} className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-1">
                      <div className="text-[10px] text-gray-400 uppercase">GIFT WRAPPED BY:</div>
                      <div className="font-bold text-amber-300">Agent {gift.giverCodename} ({gift.giverName})</div>
                      <div className="text-[10px] text-gray-400 uppercase pt-1">TAKEN HOME BY:</div>
                      <div className="font-black text-emerald-300">Agent {winnerOp?.codename || winnerOp?.name} 🎁</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* The Operative Circle Board */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
                👥 OPERATIVE ROSTER & HELD GIFTS
              </h3>
              <span className="text-[11px] font-mono text-gray-400">
                Frozen: {gameState.gifts.filter((g) => g.isFrozen).length}/{gameState.gifts.length} ❄️
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gameState.turnOrder.map((userId, idx) => {
                const op = gameState.operatives.find((o) => o.userId === userId);
                const heldGift = gameState.gifts.find((g) => g.currentHolderUserId === userId);
                const isCurrentlyActive = activeUserId === userId;

                return (
                  <div
                    key={userId}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrentlyActive
                        ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-950/40 scale-[1.02]'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-gray-300 font-bold">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-xs text-white">Agent {op?.codename}</span>
                      </div>
                      {isCurrentlyActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 animate-pulse">
                          ACTIVE TURN
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-900 font-mono text-xs">
                      {heldGift ? (
                        <div className="flex items-center justify-between">
                          <span className="text-amber-300 font-bold">🎁 {heldGift.displayLabel}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              heldGift.isFrozen
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                                : 'bg-slate-800 text-gray-400 border-slate-700'
                            }`}
                          >
                            {heldGift.isFrozen ? '❄️ FROZEN' : `${heldGift.swapCount}/3 Swaps`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-[11px] italic">Empty Hands (Unclaimed)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Physical Gifts Pile & Event Logs */}
        <div className="lg:col-span-1 space-y-6">

          {/* Physical Gifts Pile Under the Tree */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                🎄 UNDER THE TREE (PILE)
              </h3>
              <span className="text-[11px] font-mono text-gray-400">{unclaimed.length} Left</span>
            </div>

            <p className="text-xs text-gray-400 font-mono leading-relaxed">
              Physical wrapped boxes labeled with giving agent's name:
            </p>

            <div className="space-y-2">
              {gameState.gifts.map((gift) => {
                const isClaimed = gift.currentHolderUserId !== null;
                const holderOp = gameState.operatives.find((o) => o.userId === gift.currentHolderUserId);

                return (
                  <div
                    key={gift.id}
                    className={`p-3 rounded-xl border font-mono text-xs flex items-center justify-between transition-all ${
                      isClaimed
                        ? 'bg-slate-950/60 border-slate-900 text-gray-500'
                        : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{gift.displayLabel}</div>
                      <div className="text-[10px] opacity-75">
                        {isClaimed ? `Held by: Agent ${holderOp?.codename}` : 'Under the tree (Unopened)'}
                      </div>
                    </div>

                    <span className="text-[10px] font-bold">
                      {isClaimed ? '✓ Claimed' : '🎁 Wrapped'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event Audit Log */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider pb-2 border-b border-slate-800">
              📜 MISSION SWAP AUDIT LOG
            </h3>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 font-mono text-xs">
              {gameState.history.map((log) => (
                <div key={log.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>Turn {log.turnNumber}</span>
                    <span className="uppercase font-bold text-purple-400">{log.action}</span>
                  </div>
                  <p className="text-gray-300 leading-snug">{log.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
