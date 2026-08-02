import test from 'node:test';
import assert from 'node:assert';
import { executeLinkedListDraw, FieldAgent } from './draw';

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
