import test from 'node:test';
import assert from 'node:assert';
import {
  executeLinkedListDraw,
  getValidSwapCandidates,
  executeTargetSwap,
  isMatchBlocked,
  FieldAgent,
  LinkedAssignment,
  ExclusionRuleInput,
} from './draw';

test('Linked-List Protocol - Cyclic Derangement (4 agents)', () => {
  const agents: FieldAgent[] = [
    { id: '1', name: 'Agent Alpha', hasWishlistAttached: true },
    { id: '2', name: 'Agent Bravo', hasWishlistAttached: true },
    { id: '3', name: 'Agent Charlie', hasWishlistAttached: true },
    { id: '4', name: 'Agent Delta', hasWishlistAttached: true },
  ];

  const results = executeLinkedListDraw(agents);

  assert.strictEqual(results.length, 4);

  // Verify no self-assignment
  for (const { agentId, targetId } of results) {
    assert.notStrictEqual(agentId, targetId, `Agent ${agentId} drawn themselves!`);
  }

  // Verify exact 1-to-1 givers and receivers
  const givers = new Set(results.map((r) => r.agentId));
  const receivers = new Set(results.map((r) => r.targetId));

  assert.strictEqual(givers.size, 4);
  assert.strictEqual(receivers.size, 4);
});

test('Linked-List Protocol - Drops agents without wishlists when requested', () => {
  const agents: FieldAgent[] = [
    { id: '1', name: 'Agent Alpha', hasWishlistAttached: true },
    { id: '2', name: 'Agent Bravo', hasWishlistAttached: false },
    { id: '3', name: 'Agent Charlie', hasWishlistAttached: true },
  ];

  const results = executeLinkedListDraw(agents, { dropAgentsWithoutWishlists: true });

  assert.strictEqual(results.length, 2);
  const givers = results.map((r) => r.agentId);
  assert.ok(!givers.includes('2'), 'Agent Bravo without wishlist was not dropped!');
});

test('Linked-List Protocol - Rejects digital draw for White Elephant', () => {
  const agents: FieldAgent[] = [
    { id: '1', name: 'Agent Alpha', hasWishlistAttached: true },
    { id: '2', name: 'Agent Bravo', hasWishlistAttached: true },
  ];

  assert.throws(() => {
    executeLinkedListDraw(agents, { isWhiteElephant: true });
  }, /White Elephant operations do not use digital target assignment/);
});

test('Linked-List Protocol - Respects Bidirectional Exclusion Rules', () => {
  const agents: FieldAgent[] = [
    { id: '1', name: 'Chewie', hasWishlistAttached: true },
    { id: '2', name: 'Han', hasWishlistAttached: true },
    { id: '3', name: 'Leia', hasWishlistAttached: true },
    { id: '4', name: 'Luke', hasWishlistAttached: true },
  ];

  // Block Chewie <-> Han
  const exclusions: ExclusionRuleInput[] = [
    { agentId: '1', restrictedAgentId: '2' },
  ];

  for (let i = 0; i < 20; i++) {
    const results = executeLinkedListDraw(agents, { exclusionRules: exclusions });
    const chewieMatch = results.find((r) => r.agentId === '1')?.targetId;
    const hanMatch = results.find((r) => r.agentId === '2')?.targetId;

    assert.notStrictEqual(chewieMatch, '2', 'Chewie was assigned Han despite exclusion rule!');
    assert.notStrictEqual(hanMatch, '1', 'Han was assigned Chewie despite bidirectional rule!');
  }
});

test('Linked-List Protocol - Throws Error on Over-Constrained Operations', () => {
  const agents: FieldAgent[] = [
    { id: '1', name: 'Chewie', hasWishlistAttached: true },
    { id: '2', name: 'Han', hasWishlistAttached: true },
  ];

  // Impossible exclusion rule for 2 agents
  const exclusions: ExclusionRuleInput[] = [
    { agentId: '1', restrictedAgentId: '2' },
  ];

  assert.throws(() => {
    executeLinkedListDraw(agents, { exclusionRules: exclusions });
  }, /Over-constrained operation/);
});

test('Candidate Filtering - getValidSwapCandidates excludes self, current target, and blocked pairs', () => {
  const agents: FieldAgent[] = [
    { id: '1', name: 'Chewie', hasWishlistAttached: true },
    { id: '2', name: 'Han', hasWishlistAttached: true },
    { id: '3', name: 'Leia', hasWishlistAttached: true },
    { id: '4', name: 'Luke', hasWishlistAttached: true },
  ];

  const currentAssignments: LinkedAssignment[] = [
    { agentId: '1', targetId: '2' }, // Chewie -> Han
    { agentId: '2', targetId: '1' }, // Han -> Chewie
    { agentId: '3', targetId: '4' }, // Leia -> Luke
    { agentId: '4', targetId: '3' }, // Luke -> Leia
  ];

  // Block Chewie <-> Luke
  const exclusions: ExclusionRuleInput[] = [
    { agentId: '1', restrictedAgentId: '4' },
  ];

  // Ask for candidates for Chewie (id '1'), whose current target is Han (id '2')
  const candidates = getValidSwapCandidates(agents, currentAssignments, '1', exclusions);

  // Candidates should EXCLUDE:
  // - Chewie (self, id '1')
  // - Han (current target, id '2')
  // - Luke (exclusion rule, id '4')
  // ONLY candidate remaining should be Leia (id '3')
  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].id, '3');
});

test('Target Swap Engine - Executes 2-Way Cascade Target Swap', () => {
  const currentAssignments: LinkedAssignment[] = [
    { agentId: '1', targetId: '2' }, // Chewie -> Han
    { agentId: '3', targetId: '4' }, // Leia -> Luke
  ];

  // Swap Chewie's target from Han ('2') to Luke ('4')
  const updatedAssignments = executeTargetSwap(currentAssignments, '1', '4');

  const chewieNewTarget = updatedAssignments.find((a) => a.agentId === '1')?.targetId;
  const leiaNewTarget = updatedAssignments.find((a) => a.agentId === '3')?.targetId;

  // Chewie gets Luke ('4')
  assert.strictEqual(chewieNewTarget, '4');
  // Leia gets Han ('2') (displaced target cascade)
  assert.strictEqual(leiaNewTarget, '2');
});
