/**
 * KovertKlaus — Labeled Blind Mystery White Elephant State Machine Engine
 * 
 * Rules & Invariants:
 * 1. Labeled Physical Gifts: All physical packages remain 100% wrapped and unopened during turns,
 *    clearly marked with "FROM: AGENT <CODENAME/NAME>".
 * 2. Turn Queue: Shuffled 1..N operative order.
 * 3. Pick vs. Swap: Active player picks an unclaimed gift from the pile or swaps their held gift.
 * 4. 3-Swap Freeze Rule (❄️): When a gift reaches maxSwaps (default 3), it freezes permanently.
 * 5. No Immediate Swap-Back: A player cannot immediately swap back the exact same gift on the turn it was stolen from them.
 * 6. Turn Cascade: If a player's gift is stolen, they immediately get to pick from the pile or steal another eligible gift.
 * 7. Player 1 Final Privilege: Once all rounds complete, Player 1 gets one final choice to keep or swap with any non-frozen gift.
 * 8. Grand Unboxing Finale: When all rounds resolve, transitions to synchronized Grand Unboxing!
 */

import { getSecureRandomInt } from './security';

export interface WhiteElephantOperative {
  userId: string;
  name: string;
  codename?: string;
}

export interface LabeledMysteryGift {
  id: string;
  giverUserId: string;
  giverName: string;
  giverCodename: string;
  displayLabel: string; // e.g. "From: Agent Chewie"
  currentHolderUserId: string | null;
  swapCount: number;
  isFrozen: boolean;
}

export type WhiteElephantPhase =
  | 'NOT_STARTED'
  | 'TURNS'
  | 'PLAYER_1_FINAL'
  | 'GRAND_UNBOXING'
  | 'COMPLETED';

export interface GameActionLog {
  id: string;
  turnNumber: number;
  actorUserId: string;
  actorName: string;
  action: 'PICK' | 'SWAP' | 'PASS';
  targetGiftId?: string;
  targetGiftLabel?: string;
  victimUserId?: string;
  victimName?: string;
  timestamp: string;
  description: string;
}

export interface WhiteElephantGameState {
  operationId: string;
  phase: WhiteElephantPhase;
  operatives: WhiteElephantOperative[];
  turnOrder: string[]; // User IDs in 1..N order
  currentTurnIndex: number; // Index in turnOrder (0 to N-1)
  activePlayerUserId: string | null;
  cascadeVictimUserId: string | null;
  gifts: LabeledMysteryGift[];
  history: GameActionLog[];
  lastStolenGiftId: string | null;
  allowPlayer1FinalSwap: boolean;
  maxSwapsPerGift: number;
}

export interface GameInitOptions {
  operationId?: string;
  allowPlayer1FinalSwap?: boolean;
  maxSwapsPerGift?: number;
  customTurnOrder?: string[];
}

/**
 * Fisher-Yates shuffle using CSPRNG
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Initialize a new Labeled Blind Mystery White Elephant Game State
 */
export function initializePartyGame(
  operatives: WhiteElephantOperative[],
  options: GameInitOptions = {}
): WhiteElephantGameState {
  if (!operatives || operatives.length < 3) {
    throw new Error('White Elephant requires at least 3 participating operatives.');
  }

  const allowPlayer1FinalSwap = options.allowPlayer1FinalSwap ?? true;
  const maxSwapsPerGift = options.maxSwapsPerGift ?? 3;
  const operationId = options.operationId || 'op-white-elephant';

  // Determine turn order
  let turnOrder: string[];
  if (options.customTurnOrder && options.customTurnOrder.length === operatives.length) {
    turnOrder = [...options.customTurnOrder];
  } else {
    turnOrder = shuffleArray(operatives.map((o) => o.userId));
  }

  // Initialize labeled physical mystery gifts (1 gift per operative)
  const gifts: LabeledMysteryGift[] = operatives.map((op) => {
    const codename = op.codename || op.name;
    return {
      id: `gift-${op.userId}`,
      giverUserId: op.userId,
      giverName: op.name,
      giverCodename: codename,
      displayLabel: `From: Agent ${codename}`,
      currentHolderUserId: null,
      swapCount: 0,
      isFrozen: false,
    };
  });

  return {
    operationId,
    phase: 'TURNS',
    operatives: [...operatives],
    turnOrder,
    currentTurnIndex: 0,
    activePlayerUserId: turnOrder[0],
    cascadeVictimUserId: null,
    gifts,
    history: [
      {
        id: 'log-init',
        turnNumber: 0,
        actorUserId: 'SYSTEM',
        actorName: 'SYSTEM',
        action: 'PASS',
        timestamp: new Date().toISOString(),
        description: `White Elephant Party initialized with ${operatives.length} operatives. Turn order established.`,
      },
    ],
    lastStolenGiftId: null,
    allowPlayer1FinalSwap,
    maxSwapsPerGift,
  };
}

/**
 * Helper to look up an operative by userId
 */
function findOperative(state: WhiteElephantGameState, userId: string): WhiteElephantOperative {
  const op = state.operatives.find((o) => o.userId === userId);
  if (!op) {
    return { userId, name: userId, codename: userId };
  }
  return op;
}

/**
 * Compute valid moves (unclaimed pile vs swappable held gifts) for the currently active player
 */
export function getEligibleGiftsForActivePlayer(state: WhiteElephantGameState): {
  unclaimed: LabeledMysteryGift[];
  swappable: LabeledMysteryGift[];
} {
  const activeUserId = state.cascadeVictimUserId || state.activePlayerUserId;
  if (!activeUserId || (state.phase !== 'TURNS' && state.phase !== 'PLAYER_1_FINAL')) {
    return { unclaimed: [], swappable: [] };
  }

  // 1. Unclaimed gifts currently in the pile under the tree
  const unclaimed = state.gifts.filter((g) => g.currentHolderUserId === null);

  // 2. Swappable gifts held by OTHER players
  // Invariants:
  // - Cannot swap with yourself (gifts you currently hold)
  // - Cannot swap frozen gifts (isFrozen: true)
  // - Cannot immediately swap back the exact gift just stolen from you (lastStolenGiftId)
  const swappable = state.gifts.filter((g) => {
    if (g.currentHolderUserId === null) return false;
    if (g.currentHolderUserId === activeUserId) return false;
    if (g.isFrozen) return false;
    if (state.lastStolenGiftId && g.id === state.lastStolenGiftId) return false;
    return true;
  });

  return { unclaimed, swappable };
}

/**
 * Action: Active player picks an unclaimed wrapped gift from under the tree
 */
export function pickGiftFromPile(
  state: WhiteElephantGameState,
  playerId: string,
  giftId: string
): WhiteElephantGameState {
  const activeUserId = state.cascadeVictimUserId || state.activePlayerUserId;
  if (playerId !== activeUserId) {
    throw new Error(`It is not player ${playerId}'s turn.`);
  }

  const gift = state.gifts.find((g) => g.id === giftId);
  if (!gift) {
    throw new Error(`Gift ${giftId} not found.`);
  }
  if (gift.currentHolderUserId !== null) {
    throw new Error(`Gift ${gift.displayLabel} has already been claimed.`);
  }

  const operative = findOperative(state, playerId);

  // Update gift holder
  const updatedGifts = state.gifts.map((g) =>
    g.id === giftId ? { ...g, currentHolderUserId: playerId } : g
  );

  const newLog: GameActionLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    turnNumber: state.currentTurnIndex + 1,
    actorUserId: playerId,
    actorName: operative.codename || operative.name,
    action: 'PICK',
    targetGiftId: gift.id,
    targetGiftLabel: gift.displayLabel,
    timestamp: new Date().toISOString(),
    description: `Agent ${operative.codename || operative.name} picked [${gift.displayLabel}] from under the tree.`,
  };

  // If this was a cascade victim resolving their turn, clear cascade and advance main turn
  const nextTurnIndex = state.currentTurnIndex + 1;
  const isLastTurn = nextTurnIndex >= state.turnOrder.length;

  if (isLastTurn) {
    if (state.allowPlayer1FinalSwap) {
      return {
        ...state,
        phase: 'PLAYER_1_FINAL',
        currentTurnIndex: nextTurnIndex,
        activePlayerUserId: state.turnOrder[0],
        cascadeVictimUserId: null,
        gifts: updatedGifts,
        history: [newLog, ...state.history],
        lastStolenGiftId: null,
      };
    } else {
      return {
        ...state,
        phase: 'GRAND_UNBOXING',
        currentTurnIndex: nextTurnIndex,
        activePlayerUserId: null,
        cascadeVictimUserId: null,
        gifts: updatedGifts,
        history: [newLog, ...state.history],
        lastStolenGiftId: null,
      };
    }
  }

  return {
    ...state,
    phase: 'TURNS',
    currentTurnIndex: nextTurnIndex,
    activePlayerUserId: state.turnOrder[nextTurnIndex],
    cascadeVictimUserId: null,
    gifts: updatedGifts,
    history: [newLog, ...state.history],
    lastStolenGiftId: null,
  };
}

/**
 * Action: Active player swaps their held gift with another player's held gift
 */
export function swapGiftWithPlayer(
  state: WhiteElephantGameState,
  thiefPlayerId: string,
  targetGiftId: string
): WhiteElephantGameState {
  const activeUserId = state.cascadeVictimUserId || state.activePlayerUserId;
  if (thiefPlayerId !== activeUserId) {
    throw new Error(`It is not player ${thiefPlayerId}'s turn.`);
  }

  const targetGift = state.gifts.find((g) => g.id === targetGiftId);
  if (!targetGift) {
    throw new Error(`Target gift ${targetGiftId} not found.`);
  }
  if (!targetGift.currentHolderUserId) {
    throw new Error(`Gift ${targetGift.displayLabel} has not been claimed yet. Use pickGiftFromPile instead.`);
  }
  if (targetGift.currentHolderUserId === thiefPlayerId) {
    throw new Error(`Cannot swap with your own gift.`);
  }
  if (targetGift.isFrozen) {
    throw new Error(`Gift ${targetGift.displayLabel} is frozen (3/3 swaps) and cannot be stolen!`);
  }
  if (state.lastStolenGiftId && targetGift.id === state.lastStolenGiftId) {
    throw new Error(`Cannot immediately swap back the exact gift just stolen from you!`);
  }

  const victimPlayerId = targetGift.currentHolderUserId;
  const thiefOp = findOperative(state, thiefPlayerId);
  const victimOp = findOperative(state, victimPlayerId);

  // Find gift currently held by thief (if any)
  const thiefHeldGift = state.gifts.find((g) => g.currentHolderUserId === thiefPlayerId);

  const newTargetSwapCount = targetGift.swapCount + 1;
  const isTargetNowFrozen = newTargetSwapCount >= state.maxSwapsPerGift;

  const updatedGifts = state.gifts.map((g) => {
    if (g.id === targetGiftId) {
      return {
        ...g,
        currentHolderUserId: thiefPlayerId,
        swapCount: newTargetSwapCount,
        isFrozen: isTargetNowFrozen,
      };
    }
    // If thief already held a gift, transfer it to victim (2-way trade)
    if (thiefHeldGift && g.id === thiefHeldGift.id) {
      const newThiefHeldSwapCount = g.swapCount + 1;
      return {
        ...g,
        currentHolderUserId: victimPlayerId,
        swapCount: newThiefHeldSwapCount,
        isFrozen: newThiefHeldSwapCount >= state.maxSwapsPerGift,
      };
    }
    return g;
  });

  const newLog: GameActionLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    turnNumber: state.currentTurnIndex + 1,
    actorUserId: thiefPlayerId,
    actorName: thiefOp.codename || thiefOp.name,
    action: 'SWAP',
    targetGiftId: targetGift.id,
    targetGiftLabel: targetGift.displayLabel,
    victimUserId: victimPlayerId,
    victimName: victimOp.codename || victimOp.name,
    timestamp: new Date().toISOString(),
    description: `Agent ${thiefOp.codename || thiefOp.name} swapped gifts with Agent ${
      victimOp.codename || victimOp.name
    } to claim [${targetGift.displayLabel}]!`,
  };

  // Case A: If thief had NO gift prior to this swap (standard theft), victim becomes cascade victim
  if (!thiefHeldGift) {
    return {
      ...state,
      phase: 'TURNS',
      cascadeVictimUserId: victimPlayerId,
      gifts: updatedGifts,
      history: [newLog, ...state.history],
      lastStolenGiftId: targetGift.id,
    };
  }

  // Case B: 2-way trade completed. Advance to next turn in queue.
  const nextTurnIndex = state.currentTurnIndex + 1;
  const isLastTurn = nextTurnIndex >= state.turnOrder.length;

  if (isLastTurn) {
    if (state.allowPlayer1FinalSwap) {
      return {
        ...state,
        phase: 'PLAYER_1_FINAL',
        currentTurnIndex: nextTurnIndex,
        activePlayerUserId: state.turnOrder[0],
        cascadeVictimUserId: null,
        gifts: updatedGifts,
        history: [newLog, ...state.history],
        lastStolenGiftId: null,
      };
    } else {
      return {
        ...state,
        phase: 'GRAND_UNBOXING',
        currentTurnIndex: nextTurnIndex,
        activePlayerUserId: null,
        cascadeVictimUserId: null,
        gifts: updatedGifts,
        history: [newLog, ...state.history],
        lastStolenGiftId: null,
      };
    }
  }

  return {
    ...state,
    phase: 'TURNS',
    currentTurnIndex: nextTurnIndex,
    activePlayerUserId: state.turnOrder[nextTurnIndex],
    cascadeVictimUserId: null,
    gifts: updatedGifts,
    history: [newLog, ...state.history],
    lastStolenGiftId: null,
  };
}

/**
 * Action: Player 1 exercises their final swap privilege or passes
 */
export function resolvePlayer1FinalChoice(
  state: WhiteElephantGameState,
  choice: 'KEEP' | 'SWAP',
  targetGiftId?: string
): WhiteElephantGameState {
  if (state.phase !== 'PLAYER_1_FINAL') {
    throw new Error(`Player 1 Final Choice can only be resolved during PLAYER_1_FINAL phase.`);
  }

  const player1Id = state.turnOrder[0];
  const player1Op = findOperative(state, player1Id);

  if (choice === 'KEEP' || !targetGiftId) {
    const keepLog: GameActionLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      turnNumber: state.currentTurnIndex + 1,
      actorUserId: player1Id,
      actorName: player1Op.codename || player1Op.name,
      action: 'PASS',
      timestamp: new Date().toISOString(),
      description: `Player 1 (Agent ${player1Op.codename || player1Op.name}) elected to KEEP their mystery gift for the Grand Unboxing!`,
    };

    return {
      ...state,
      phase: 'GRAND_UNBOXING',
      activePlayerUserId: null,
      cascadeVictimUserId: null,
      history: [keepLog, ...state.history],
    };
  }

  // Player 1 executes swap
  const targetGift = state.gifts.find((g) => g.id === targetGiftId);
  if (!targetGift || !targetGift.currentHolderUserId) {
    throw new Error(`Invalid target gift for Player 1 swap.`);
  }
  if (targetGift.currentHolderUserId === player1Id) {
    throw new Error(`Player 1 cannot swap with their own gift.`);
  }
  if (targetGift.isFrozen) {
    throw new Error(`Gift ${targetGift.displayLabel} is frozen and cannot be swapped.`);
  }

  const victimPlayerId = targetGift.currentHolderUserId;
  const victimOp = findOperative(state, victimPlayerId);
  const player1HeldGift = state.gifts.find((g) => g.currentHolderUserId === player1Id);

  const updatedGifts = state.gifts.map((g) => {
    if (g.id === targetGiftId) {
      return { ...g, currentHolderUserId: player1Id, swapCount: g.swapCount + 1 };
    }
    if (player1HeldGift && g.id === player1HeldGift.id) {
      return { ...g, currentHolderUserId: victimPlayerId, swapCount: g.swapCount + 1 };
    }
    return g;
  });

  const swapLog: GameActionLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    turnNumber: state.currentTurnIndex + 1,
    actorUserId: player1Id,
    actorName: player1Op.codename || player1Op.name,
    action: 'SWAP',
    targetGiftId: targetGift.id,
    targetGiftLabel: targetGift.displayLabel,
    victimUserId: victimPlayerId,
    victimName: victimOp.codename || victimOp.name,
    timestamp: new Date().toISOString(),
    description: `Player 1 (Agent ${player1Op.codename || player1Op.name}) executed their Final Swap Privilege with Agent ${
      victimOp.codename || victimOp.name
    } to claim [${targetGift.displayLabel}]!`,
  };

  return {
    ...state,
    phase: 'GRAND_UNBOXING',
    activePlayerUserId: null,
    cascadeVictimUserId: null,
    gifts: updatedGifts,
    history: [swapLog, ...state.history],
  };
}

/**
 * Trigger Grand Unboxing completion
 */
export function completePartyGame(state: WhiteElephantGameState): WhiteElephantGameState {
  return {
    ...state,
    phase: 'COMPLETED',
    history: [
      {
        id: `log-complete-${Date.now()}`,
        turnNumber: state.currentTurnIndex + 1,
        actorUserId: 'SYSTEM',
        actorName: 'SYSTEM',
        action: 'PASS',
        timestamp: new Date().toISOString(),
        description: '🎉 Grand Unboxing Completed! All gifts unwrapped in good holiday cheer.',
      },
      ...state.history,
    ],
  };
}
