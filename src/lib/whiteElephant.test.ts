import { test } from 'node:test';
import assert from 'node:assert';
import {
  initializePartyGame,
  getEligibleGiftsForActivePlayer,
  pickGiftFromPile,
  swapGiftWithPlayer,
  resolvePlayer1FinalChoice,
  completePartyGame,
  WhiteElephantOperative,
} from './whiteElephant';

const SAMPLE_OPERATIVES: WhiteElephantOperative[] = [
  { userId: 'user-1', name: 'Homer Simpson', codename: 'DuffMan' },
  { userId: 'user-2', name: 'Marge Simpson', codename: 'BlueBeehive' },
  { userId: 'user-3', name: 'Bart Simpson', codename: 'ElBarto' },
  { userId: 'user-4', name: 'Lisa Simpson', codename: 'Saxophone' },
];

test('White Elephant Engine - Initialization & Labeled Giver Tags', () => {
  const state = initializePartyGame(SAMPLE_OPERATIVES, {
    customTurnOrder: ['user-1', 'user-2', 'user-3', 'user-4'],
  });

  assert.strictEqual(state.phase, 'TURNS');
  assert.strictEqual(state.operatives.length, 4);
  assert.strictEqual(state.turnOrder.length, 4);
  assert.strictEqual(state.activePlayerUserId, 'user-1');
  assert.strictEqual(state.currentTurnIndex, 0);

  // Verify labeled mystery gifts
  assert.strictEqual(state.gifts.length, 4);
  const gift1 = state.gifts.find((g) => g.giverUserId === 'user-1');
  assert.ok(gift1);
  assert.strictEqual(gift1.displayLabel, 'From: Agent DuffMan');
  assert.strictEqual(gift1.currentHolderUserId, null);
  assert.strictEqual(gift1.swapCount, 0);
  assert.strictEqual(gift1.isFrozen, false);

  const gift3 = state.gifts.find((g) => g.giverUserId === 'user-3');
  assert.ok(gift3);
  assert.strictEqual(gift3.displayLabel, 'From: Agent ElBarto');
});

test('White Elephant Engine - Enforces minimum 3 operatives', () => {
  assert.throws(() => {
    initializePartyGame([
      { userId: 'u1', name: 'Agent 1' },
      { userId: 'u2', name: 'Agent 2' },
    ]);
  }, /White Elephant requires at least 3 participating operatives/);
});

test('White Elephant Engine - Pick from Pile advances turn queue', () => {
  const state = initializePartyGame(SAMPLE_OPERATIVES, {
    customTurnOrder: ['user-1', 'user-2', 'user-3', 'user-4'],
  });

  const eligibleBefore = getEligibleGiftsForActivePlayer(state);
  assert.strictEqual(eligibleBefore.unclaimed.length, 4);
  assert.strictEqual(eligibleBefore.swappable.length, 0); // No one holds a gift yet

  // Turn 1: User 1 picks Gift #2 (From: Agent BlueBeehive)
  const state1 = pickGiftFromPile(state, 'user-1', 'gift-user-2');
  assert.strictEqual(state1.currentTurnIndex, 1);
  assert.strictEqual(state1.activePlayerUserId, 'user-2');

  const pickedGift = state1.gifts.find((g) => g.id === 'gift-user-2');
  assert.strictEqual(pickedGift?.currentHolderUserId, 'user-1');

  // Turn 2: User 2 can pick from unclaimed OR swap with User 1
  const eligibleTurn2 = getEligibleGiftsForActivePlayer(state1);
  assert.strictEqual(eligibleTurn2.unclaimed.length, 3);
  assert.strictEqual(eligibleTurn2.swappable.length, 1);
  assert.strictEqual(eligibleTurn2.swappable[0].id, 'gift-user-2');
});

test('White Elephant Engine - Swapping increments counter and freezes at 3 swaps', () => {
  let state = initializePartyGame(SAMPLE_OPERATIVES, {
    customTurnOrder: ['user-1', 'user-2', 'user-3', 'user-4'],
    maxSwapsPerGift: 3,
  });

  // Turn 1: User 1 picks Gift from User 4
  state = pickGiftFromPile(state, 'user-1', 'gift-user-4');

  // Turn 2: User 2 picks Gift from User 3
  state = pickGiftFromPile(state, 'user-2', 'gift-user-3');

  // Turn 3: User 3 picks Gift from User 1
  state = pickGiftFromPile(state, 'user-3', 'gift-user-1');

  // Turn 4 (User 4): User 4 swaps with User 1 for Gift-User-4 (Swap 1)
  state = swapGiftWithPlayer(state, 'user-4', 'gift-user-4');
  let gift4 = state.gifts.find((g) => g.id === 'gift-user-4');
  assert.strictEqual(gift4?.swapCount, 1);
  assert.strictEqual(gift4?.isFrozen, false);

  // Next round / simulated swaps: Force swap counter up to 3
  state = {
    ...state,
    phase: 'TURNS',
    currentTurnIndex: 2,
    cascadeVictimUserId: null,
    activePlayerUserId: 'user-3',
    lastStolenGiftId: null,
    gifts: state.gifts.map((g) =>
      g.id === 'gift-user-4' ? { ...g, swapCount: 2, currentHolderUserId: 'user-2' } : g
    ),
  };

  // User 3 swaps to take Gift-User-4 (Swap 3 -> FROZEN!)
  state = swapGiftWithPlayer(state, 'user-3', 'gift-user-4');
  gift4 = state.gifts.find((g) => g.id === 'gift-user-4');
  assert.strictEqual(gift4?.swapCount, 3);
  assert.strictEqual(gift4?.isFrozen, true);

  // Attempting to swap a frozen gift throws an error
  state = { ...state, phase: 'TURNS', activePlayerUserId: 'user-1', cascadeVictimUserId: null };
  assert.throws(() => {
    swapGiftWithPlayer(state, 'user-1', 'gift-user-4');
  }, /frozen/);
});

test('White Elephant Engine - Prevents immediate swap-back', () => {
  let state = initializePartyGame(SAMPLE_OPERATIVES, {
    customTurnOrder: ['user-1', 'user-2', 'user-3', 'user-4'],
  });

  state = pickGiftFromPile(state, 'user-1', 'gift-user-2');
  state = pickGiftFromPile(state, 'user-2', 'gift-user-1');

  // User 3 steals gift-user-2 from user-1 (without holding a gift prior)
  state = {
    ...state,
    gifts: state.gifts.map((g) => (g.id === 'gift-user-3' ? { ...g, currentHolderUserId: null } : g)),
    activePlayerUserId: 'user-3',
  };

  // User 3 steals gift-user-2 from user-1
  state = swapGiftWithPlayer(state, 'user-3', 'gift-user-2');

  // User 1 is now the cascade victim and CANNOT immediately steal gift-user-2 back!
  assert.strictEqual(state.cascadeVictimUserId, 'user-1');
  assert.strictEqual(state.lastStolenGiftId, 'gift-user-2');

  assert.throws(() => {
    swapGiftWithPlayer(state, 'user-1', 'gift-user-2');
  }, /Cannot immediately swap back/);
});

test('White Elephant Engine - Player 1 Final Swap Privilege and Grand Unboxing', () => {
  let state = initializePartyGame(SAMPLE_OPERATIVES, {
    customTurnOrder: ['user-1', 'user-2', 'user-3', 'user-4'],
    allowPlayer1FinalSwap: true,
  });

  // Turn 1: User 1 picks
  state = pickGiftFromPile(state, 'user-1', 'gift-user-2');
  // Turn 2: User 2 picks
  state = pickGiftFromPile(state, 'user-2', 'gift-user-3');
  // Turn 3: User 3 picks
  state = pickGiftFromPile(state, 'user-3', 'gift-user-4');
  // Turn 4 (Final round): User 4 picks
  state = pickGiftFromPile(state, 'user-4', 'gift-user-1');

  // State transitions to PLAYER_1_FINAL
  assert.strictEqual(state.phase, 'PLAYER_1_FINAL');
  assert.strictEqual(state.activePlayerUserId, 'user-1');

  // Player 1 decides to SWAP with User 3 to get gift-user-4
  state = resolvePlayer1FinalChoice(state, 'SWAP', 'gift-user-4');

  assert.strictEqual(state.phase, 'GRAND_UNBOXING');
  const user1Gift = state.gifts.find((g) => g.currentHolderUserId === 'user-1');
  assert.strictEqual(user1Gift?.id, 'gift-user-4');

  // Complete game
  state = completePartyGame(state);
  assert.strictEqual(state.phase, 'COMPLETED');
});
