/**
 * @file exclusion-rules.test.ts
 * @description Tests for the client shape of preventative match rules.
 *
 * Tier 1 (what): `toClientExclusionRules` returns rules the mission page and the rules dialog can
 * label and feed to the feasibility check.
 * Tier 2 (why): Both runtimes once sent raw rows (`memberId`, `member`) while the client read
 * `agentId`/`agent`, so the Head Elf saw blank rules and the page's draw check ignored every rule
 * (feedback 2026-11-09).
 * Tier 3 (how): Pure function tests; the typed assignment to `OperationExclusionRule` makes `tsc`
 * fail if the server and client shapes drift apart again.
 */

import test from 'node:test';
import assert from 'node:assert';
import type { OperationExclusionRule } from '@/components/PreventativeMatchModal';
import { evaluateDrawFeasibility, type ExclusionRuleInput } from './draw';
import { toClientExclusionRules } from './exclusion-rules';

const members = [
  { userId: 'u-a', codename: 'Viper', user: { name: 'Alice' } },
  { userId: 'u-b', codename: 'Falcon', user: { name: 'Bob' } },
  { userId: 'u-c', codename: null, user: { name: 'Cara' } },
  { userId: 'u-d', codename: 'Comet', user: { name: 'Dev' } },
];

test('toClientExclusionRules', async (t) => {
  await t.test('maps stored user IDs to agent IDs with roster labels', () => {
    const rules: OperationExclusionRule[] = toClientExclusionRules(
      [{ id: 'r1', memberId: 'u-a', restrictedMemberId: 'u-c', member: { name: 'Alice' }, restrictedMember: { name: 'Cara' } }],
      members
    );
    assert.deepStrictEqual(rules, [
      {
        id: 'r1',
        agentId: 'u-a',
        restrictedAgentId: 'u-c',
        agent: { id: 'u-a', name: 'Alice', codename: 'Viper' },
        restrictedAgent: { id: 'u-c', name: 'Cara', codename: null },
      },
    ]);
  });

  await t.test('labels an agent missing from the roster', () => {
    const [withFallback] = toClientExclusionRules(
      [{ id: 'r2', memberId: 'u-gone', restrictedMemberId: 'u-b', member: { name: 'Gwen' } }],
      members
    );
    assert.strictEqual(withFallback.agent.name, 'Gwen');
    const [withoutFallback] = toClientExclusionRules([{ id: 'r3', memberId: 'u-gone', restrictedMemberId: 'u-b' }], members);
    assert.strictEqual(withoutFallback.agent.name, 'Former agent');
    assert.strictEqual(withoutFallback.restrictedAgent.name, 'Bob');
  });

  await t.test('the converted rules reach the feasibility check', () => {
    // Alice blocked from Bob and Cara keeps one partner (Dev): no valid circle.
    const rules = toClientExclusionRules(
      [
        { id: 'r4', memberId: 'u-a', restrictedMemberId: 'u-b' },
        { id: 'r5', memberId: 'u-a', restrictedMemberId: 'u-c' },
      ],
      members
    );
    const inputs: ExclusionRuleInput[] = rules.map((r) => ({ agentId: r.agentId, restrictedAgentId: r.restrictedAgentId }));
    const agents = members.map((m) => ({ id: m.userId, name: m.user.name, hasWishlistAttached: true }));
    assert.strictEqual(evaluateDrawFeasibility(agents, inputs).isFeasible, false);
    assert.strictEqual(evaluateDrawFeasibility(agents, []).isFeasible, true);
  });
});
