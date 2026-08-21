import test from 'node:test';
import assert from 'node:assert';
import {
  executeLinkedListDraw,
  getValidSwapCandidates,
  executeTargetSwap,
  isMatchBlocked,
  buildExclusionIndex,
  FieldAgent,
  LinkedAssignment,
  ExclusionRuleInput,
} from './draw';
import { getSecureRandomInt } from './security';

test('CSPRNG Unbiased Integer Generator', async (t) => {
  await t.test('Produces integers strictly within [0, maxExclusive)', () => {
    for (let max = 1; max <= 50; max++) {
      for (let i = 0; i < 20; i++) {
        const val = getSecureRandomInt(max);
        assert.ok(val >= 0, `Value ${val} must be non-negative`);
        assert.ok(val < max, `Value ${val} must be strictly less than max ${max}`);
      }
    }
  });

  await t.test('Returns 0 when maxExclusive is 1 or less', () => {
    assert.strictEqual(getSecureRandomInt(1), 0);
    assert.strictEqual(getSecureRandomInt(0), 0);
    assert.strictEqual(getSecureRandomInt(-5), 0);
  });
});

test('Exclusion Rule Index Pre-Compilation', async (t) => {
  await t.test('buildExclusionIndex creates bidirectional composite keys', () => {
    const exclusions: ExclusionRuleInput[] = [
      { agentId: 'agent_1', restrictedAgentId: 'agent_2' },
      { agentId: 'agent_3', restrictedAgentId: 'agent_4' },
    ];

    const index = buildExclusionIndex(exclusions);

    assert.strictEqual(index.size, 4);
    assert.ok(index.has('agent_1:agent_2'));
    assert.ok(index.has('agent_2:agent_1'));
    assert.ok(index.has('agent_3:agent_4'));
    assert.ok(index.has('agent_4:agent_3'));
    assert.ok(!index.has('agent_1:agent_3'));
  });

  await t.test('isMatchBlocked works with both raw array and pre-compiled Set', () => {
    const exclusions: ExclusionRuleInput[] = [
      { agentId: 'A', restrictedAgentId: 'B' },
    ];
    const index = buildExclusionIndex(exclusions);

    // Array mode
    assert.strictEqual(isMatchBlocked('A', 'B', exclusions), true);
    assert.strictEqual(isMatchBlocked('B', 'A', exclusions), true);
    assert.strictEqual(isMatchBlocked('A', 'C', exclusions), false);
    assert.strictEqual(isMatchBlocked('A', 'A', exclusions), true); // Self-assignment

    // Set mode (O(1))
    assert.strictEqual(isMatchBlocked('A', 'B', index), true);
    assert.strictEqual(isMatchBlocked('B', 'A', index), true);
    assert.strictEqual(isMatchBlocked('A', 'C', index), false);
    assert.strictEqual(isMatchBlocked('A', 'A', index), true); // Self-assignment
  });
});

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

test('Linked-List Protocol - Heavily Constrained & Large-Scale Graphs (50 operatives)', () => {
  const agents: FieldAgent[] = Array.from({ length: 50 }, (_, i) => ({
    id: `agent_${i + 1}`,
    name: `Operative ${i + 1}`,
    hasWishlistAttached: true,
  }));

  // Build a complex chain of 20 exclusion rules
  const exclusions: ExclusionRuleInput[] = [];
  for (let i = 1; i <= 20; i += 2) {
    exclusions.push({
      agentId: `agent_${i}`,
      restrictedAgentId: `agent_${i + 1}`,
    });
  }

  const start = performance.now();
  const results = executeLinkedListDraw(agents, { exclusionRules: exclusions });
  const duration = performance.now() - start;

  assert.strictEqual(results.length, 50);

  // Validate no self-assignments and no exclusion rule breaches
  const blockedIndex = buildExclusionIndex(exclusions);
  for (const { agentId, targetId } of results) {
    assert.notStrictEqual(agentId, targetId, 'No self assignments allowed');
    assert.ok(!blockedIndex.has(`${agentId}:${targetId}`), `Disallowed assignment ${agentId} -> ${targetId}`);
  }

  // Ensure 1-to-1 matching
  assert.strictEqual(new Set(results.map((r) => r.agentId)).size, 50);
  assert.strictEqual(new Set(results.map((r) => r.targetId)).size, 50);
  assert.ok(duration < 50, `50-agent draw should complete in <50ms, took ${duration.toFixed(2)}ms`);
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
