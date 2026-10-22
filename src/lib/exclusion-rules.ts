/**
 * @file exclusion-rules.ts
 * @description Preventative match rules (two-way blocks) checked against the mission roster.
 *
 * Tier 1 (what): `exclusionRuleProblemForMission` validates a new rule before it is saved, and
 * `removeMemberExclusionRules` deletes a removed agent's rules and reports whether the remaining
 * rules still allow one gift circle. Both runtimes (Next.js route and edge worker) call these.
 * Tier 2 (why): Rules are validated when they are made (every agent keeps 2 allowed partners and a
 * full circle exists), and a removal can still break the circle for someone else, so the Head Elf
 * is warned at once. The draw-time readiness check (`mission-repair.ts`) remains the backstop and
 * pauses the mission if the rules are invalid then.
 * Tier 3 (how): Loads members and rules, then defers to the pure checks in `draw.ts`. White
 * Elephant missions have no digital draw, so their rules are not checked.
 */

import type { PrismaClient } from '@prisma/client';
import { evaluateDrawFeasibility, exclusionRuleProblem, MIN_PARTICIPANTS, type ExclusionRuleInput } from '@/lib/draw';

/** Loads the roster (as draw agents) and the rule list for one mission. */
async function loadRosterAndRules(db: PrismaClient, exchangeId: string) {
  const [members, rules] = await Promise.all([
    db.exchangeMember.findMany({
      where: { exchangeId },
      select: { userId: true, codename: true, user: { select: { name: true } } },
    }),
    db.exclusionRule.findMany({ where: { exchangeId }, select: { memberId: true, restrictedMemberId: true } }),
  ]);
  return {
    roster: members.map((m) => ({ id: m.userId, name: m.user.name ?? m.codename ?? 'An agent', codename: m.codename })),
    rules: rules.map<ExclusionRuleInput>((r) => ({ agentId: r.memberId, restrictedAgentId: r.restrictedMemberId })),
  };
}

/**
 * Checks whether a new rule would leave the mission without a valid gift circle.
 *
 * @param db - Prisma client
 * @param exchange - The mission (ID and whether it is White Elephant)
 * @param newRule - The rule about to be created
 * @returns A user-facing error message, or `null` when the rule may be saved
 */
export async function exclusionRuleProblemForMission(
  db: PrismaClient,
  exchange: { id: string; isWhiteElephant: boolean },
  newRule: ExclusionRuleInput
): Promise<string | null> {
  if (exchange.isWhiteElephant) return null;
  const { roster, rules } = await loadRosterAndRules(db, exchange.id);
  return exclusionRuleProblem(roster, rules, newRule);
}

/**
 * Deletes every rule that names the removed agent, then re-checks the remaining roster.
 *
 * @param db - Prisma client
 * @param exchange - The mission (ID and whether it is White Elephant)
 * @param userId - The removed agent's user ID
 * @returns A warning for the Head Elf when the remaining rules no longer allow one circle, else `null`
 */
export async function removeMemberExclusionRules(
  db: PrismaClient,
  exchange: { id: string; isWhiteElephant: boolean },
  userId: string
): Promise<string | null> {
  await db.exclusionRule.deleteMany({
    where: { exchangeId: exchange.id, OR: [{ memberId: userId }, { restrictedMemberId: userId }] },
  });
  if (exchange.isWhiteElephant) return null;
  const { roster, rules } = await loadRosterAndRules(db, exchange.id);
  if (roster.length < MIN_PARTICIPANTS || rules.length === 0) return null;
  const result = evaluateDrawFeasibility(roster.map((a) => ({ ...a, hasWishlistAttached: true })), rules);
  if (result.isFeasible) return null;
  return result.status === 'TRAPPED_AGENT'
    ? `With this agent gone, ${result.trappedAgentName} has fewer than 2 possible partners. Remove a preventative match rule before the draw, or the mission will pause.`
    : 'With this agent gone, the preventative match rules no longer allow one gift circle. Remove a rule before the draw, or the mission will pause.';
}
