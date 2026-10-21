/**
 * KovertKlaus Target Assignment Protocol
 * 
 * Implements a cryptographically secure randomized derangement algorithm guaranteeing 1-to-1 matching:
 * Every operative gives exactly 1 gift and receives exactly 1 gift.
 * 
 * Mathematical Invariants:
 * 1. Single Gift Circle: The assignments form one cycle through every agent (no self-draws, no pairs drawing each other).
 * 2. Bidirectional Exclusion: For any rule (A, B), sigma(A) != B AND sigma(B) != A.
 * 3. Constant Chain Obfuscation: Pairings cannot be reverse-engineered by compromised participants.
 * 4. Circle-Preserving Swaps: A Head Elf reassignment moves the new target into place, so the circle stays whole.
 * 
 * Algorithmic Design:
 * - CSPRNG Entropy: Uses unbiased rejection-sampled cryptographically secure pseudorandom integers.
 * - O(1) Pre-Indexed Exclusions: Compiles exclusion rules into a Set of composite keys (`${A}:${B}`),
 *   reducing candidate graph validation from O(N * |E|) to O(N).
 * - Random Circle Draw: CSPRNG shuffle read as a circle, with an exact circle search (`findGiftCircle`)
 *   as the fallback for tightly constrained rosters.
 */

import { getSecureRandomInt } from './security';

export const MIN_PARTICIPANTS = 4;

export interface FieldAgent {
  /** Unique user / member identifier */
  id: string;
  /** Full human name of the operative */
  name: string;
  /** Optional tactical call sign (e.g. Agent: Viper) */
  codename?: string | null;
  /** Invariant: Operative must have an attached wishlist manifest to participate in Secret Santa */
  hasWishlistAttached: boolean;
}

export interface LinkedAssignment {
  /** Giver operative ID */
  agentId: string;
  /** Receiver target operative ID */
  targetId: string;
}

export interface ExclusionRuleInput {
  /** Originating agent ID */
  agentId: string;
  /** Blocked target agent ID (enforced bidirectionally) */
  restrictedAgentId: string;
}

export interface DrawOptions {
  /** If true, asserts White Elephant rules and forbids digital draw */
  isWhiteElephant?: boolean;
  /** If true, filters out any operatives who have not attached a wishlist */
  dropAgentsWithoutWishlists?: boolean;
  /** List of bidirectional pairing exclusions */
  exclusionRules?: ExclusionRuleInput[];
}

/**
 * Pre-compiles an array of exclusion rules into a Set of composite keys (`${agentA}:${agentB}`)
 * providing O(1) bidirectional lookup during candidate derangement verification.
 * 
 * @param rules - List of configured exclusion rules
 * @returns Set containing bidirectional composite keys for all disallowed pairs
 */
export function buildExclusionIndex(rules: ExclusionRuleInput[] = []): Set<string> {
  const blockedSet = new Set<string>();
  for (const rule of rules) {
    if (rule.agentId && rule.restrictedAgentId) {
      blockedSet.add(`${rule.agentId}:${rule.restrictedAgentId}`);
      blockedSet.add(`${rule.restrictedAgentId}:${rule.agentId}`);
    }
  }
  return blockedSet;
}

/**
 * Validates whether a proposed match between two operatives is disallowed.
 * Supports both raw ExclusionRuleInput arrays and pre-compiled Set<string> indices.
 * 
 * Enforces two strict rules:
 * 1. Identity Guard: Operatives can never be assigned to themselves (A != B).
 * 2. Bidirectional Exclusions: If a rule exists for (A -> B), both (A -> B) and (B -> A) are blocked.
 * 
 * @param agentAId - Originating giver ID
 * @param agentBId - Candidate receiver ID
 * @param exclusions - Active exclusion pairs or pre-compiled Set
 * @returns `true` if match is blocked; `false` if permitted
 */
export function isMatchBlocked(
  agentAId: string,
  agentBId: string,
  exclusions: ExclusionRuleInput[] | Set<string> = []
): boolean {
  if (agentAId === agentBId) return true; // Self-assignment is always blocked
  if (exclusions instanceof Set) {
    return exclusions.has(`${agentAId}:${agentBId}`);
  }
  return exclusions.some(
    (rule) =>
      (rule.agentId === agentAId && rule.restrictedAgentId === agentBId) ||
      (rule.agentId === agentBId && rule.restrictedAgentId === agentAId)
  );
}

/** Step cap for the circle search. Real rosters finish in far fewer; the cap keeps a pathological rule set from hanging a request. */
export const CIRCLE_SEARCH_MAX_STEPS = 200_000;

/** Result of a circle search: the agents in giving order, `null` when no circle exists, or `undefined` when the step cap ran out first. */
export type CircleSearchResult = string[] | null | undefined;

/**
 * Searches for one gift circle through every agent: an order in which each agent gives to the next
 * and the last gives to the first, with no blocked pair next to each other.
 *
 * Tier 1 (what): Because blocks are two-way, the allowed pairs form an undirected graph and a gift
 * circle is a Hamiltonian cycle in it.
 * Tier 2 (why): The search is exact, so rule validation and the draw agree on whether a circle exists.
 * Tier 3 (how): Depth-first search from a fixed start, trying neighbors with the fewest open partners
 * first, and pruning when an unvisited agent is left with fewer than 2 reachable partners. Pass
 * `randomInt` to shuffle the start and neighbor order (draws); omit it for a deterministic check.
 *
 * @param ids - Agent IDs on the roster
 * @param blocked - Pre-compiled exclusion index from `buildExclusionIndex`
 * @param options - Optional CSPRNG for shuffling and a step cap
 * @returns Agent IDs in giving order, `null` if impossible, `undefined` if the cap was reached
 */
export function findGiftCircle(
  ids: string[],
  blocked: Set<string>,
  options: { randomInt?: (maxExclusive: number) => number; maxSteps?: number } = {}
): CircleSearchResult {
  const n = ids.length;
  if (n < 3) return null;
  const { randomInt, maxSteps = CIRCLE_SEARCH_MAX_STEPS } = options;

  const order = [...ids];
  if (randomInt) shuffleInPlace(order, randomInt);
  const adjacency: number[][] = order.map((a, i) =>
    order.flatMap((b, j) => (i !== j && !blocked.has(`${a}:${b}`) ? [j] : []))
  );
  if (adjacency.some((list) => list.length < 2)) return null;
  if (randomInt) adjacency.forEach((list) => shuffleInPlace(list, randomInt));

  const visited = new Array<boolean>(n).fill(false);
  const path: number[] = [0];
  visited[0] = true;
  let steps = 0;

  /** True when every unvisited agent can still reach 2 partners (unvisited ones, the path end, or the start). */
  const stillCompletable = (end: number): boolean => {
    for (let v = 0; v < n; v++) {
      if (visited[v]) continue;
      let open = 0;
      for (const w of adjacency[v]) {
        if (!visited[w] || w === end || w === 0) open++;
        if (open >= 2) break;
      }
      if (open < 2) return false;
    }
    return true;
  };

  const extend = (end: number): boolean | undefined => {
    if (++steps > maxSteps) return undefined;
    if (path.length === n) return adjacency[end].includes(0);
    const next = adjacency[end]
      .filter((w) => !visited[w])
      .map((w) => ({ w, open: adjacency[w].filter((x) => !visited[x]).length }))
      .sort((a, b) => a.open - b.open);
    for (const { w } of next) {
      visited[w] = true;
      path.push(w);
      if (stillCompletable(w)) {
        const found = extend(w);
        if (found !== false) return found;
      }
      path.pop();
      visited[w] = false;
    }
    return false;
  };

  const found = extend(0);
  if (found === undefined) return undefined;
  return found ? path.map((i) => order[i]) : null;
}

/** CSPRNG Fisher-Yates shuffle, in place. */
function shuffleInPlace<T>(items: T[], randomInt: (maxExclusive: number) => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/** Turns a giving order into assignments: each agent gives to the next, the last to the first. */
function circleToAssignments(circle: string[]): LinkedAssignment[] {
  return circle.map((agentId, i) => ({ agentId, targetId: circle[(i + 1) % circle.length] }));
}

/** Random-order attempts before the draw falls back to the circle search. */
const RANDOM_CIRCLE_ATTEMPTS = 500;

/**
 * Draws Secret Santa targets as one gift circle through every eligible agent.
 *
 * Tier 1 (what): Every agent gives exactly 1 gift and receives exactly 1, nobody draws themselves or
 * a blocked partner, and the assignments form a single circle (no pair gives to each other).
 * Tier 2 (why): Smaller loops, such as two agents drawing each other, let agents work out who their
 * Secret Santa is.
 * Tier 3 (how): Shuffles the roster with the CSPRNG and reads it as a circle (equivalent to Sattolo's
 * algorithm: every circle is equally likely). After 500 rejected shuffles, a randomized
 * `findGiftCircle` search finds a circle when the rules are tight, or proves none exists.
 *
 * @param agents - List of enrolled operatives
 * @param options - Draw configuration parameters (exclusions, wishlist requirements)
 * @returns Array of 1-to-1 LinkedAssignment mappings forming one circle
 *
 * @throws {Error} If operation is White Elephant (digital draw forbidden).
 * @throws {Error} If fewer than 4 eligible operatives have attached wishlists.
 * @throws {Error} If exclusion rules leave no single gift circle (over-constrained).
 */
export function executeLinkedListDraw(
  agents: FieldAgent[],
  options: DrawOptions = {}
): LinkedAssignment[] {
  // Rule 1: White Elephant operations do NOT perform online target assignments.
  if (options.isWhiteElephant) {
    throw new Error(
      "White Elephant operations do not use digital target assignment. Gifting occurs in-person on Execution Day!"
    );
  }

  let eligibleAgents = [...agents];
  if (options.dropAgentsWithoutWishlists) {
    eligibleAgents = eligibleAgents.filter((a) => a.hasWishlistAttached);
  }

  if (eligibleAgents.length < MIN_PARTICIPANTS) {
    throw new Error(
      `Target assignment requires at least ${MIN_PARTICIPANTS} active Field Agents with attached wishlists.`
    );
  }

  const blockedSet = buildExclusionIndex(options.exclusionRules || []);
  const ids = eligibleAgents.map((a) => a.id);
  const n = ids.length;

  for (let attempt = 0; attempt < RANDOM_CIRCLE_ATTEMPTS; attempt++) {
    const circle = [...ids];
    shuffleInPlace(circle, getSecureRandomInt);
    let isValid = true;
    for (let i = 0; i < n; i++) {
      if (blockedSet.has(`${circle[i]}:${circle[(i + 1) % n]}`)) {
        isValid = false;
        break;
      }
    }
    if (isValid) return circleToAssignments(circle);
  }

  const circle = findGiftCircle(ids, blockedSet, { randomInt: getSecureRandomInt });
  if (circle) return circleToAssignments(circle);

  throw new Error(
    "Over-constrained operation: Unable to find a valid target assignment. Please remove or relax preventative match rules."
  );
}

/**
 * Describes moving `newTargetId` into the circle right after `originatorId`.
 *
 * Tier 1 (what): A → T, T → A's old target, and T's old giver → T's old target.
 * Tier 2 (why): The circle closes up where T left and opens where T goes in, so it stays one circle.
 * Tier 3 (how): Three assignments change; returns `null` when the move is a no-op or not possible.
 */
function planCircleMove(
  currentAssignments: LinkedAssignment[],
  originatorId: string,
  newTargetId: string
): { oldTargetId: string; displacedGiverId: string; displacedNextId: string } | null {
  const oldTargetId = currentAssignments.find((a) => a.agentId === originatorId)?.targetId;
  const displacedGiverId = currentAssignments.find((a) => a.targetId === newTargetId)?.agentId;
  const displacedNextId = currentAssignments.find((a) => a.agentId === newTargetId)?.targetId;
  if (!oldTargetId || !displacedGiverId || !displacedNextId) return null;
  if (newTargetId === originatorId || newTargetId === oldTargetId) return null;
  return { oldTargetId, displacedGiverId, displacedNextId };
}

/**
 * Computes the list of valid candidate targets for a manual reassignment.
 *
 * Tier 1 (what): Agents the originator can be moved onto without breaking the gift circle.
 * Tier 2 (why): A move changes three assignments, so a candidate is valid only if all three new
 * pairs are allowed, not just the originator's.
 * Tier 3 (how): Excludes self and the current target, then checks A → T, T → A's old target and
 * T's old giver → T's old target against the exclusion index.
 *
 * @param eligibleAgents - Full roster of participating operatives
 * @param currentAssignments - Active linked assignments
 * @param originatorId - The operative requesting or undergoing target reassignment
 * @param exclusionRules - Configured exclusion rules (raw array or pre-compiled Set)
 * @returns Array of eligible candidate operatives suitable for target reassignment
 */
export function getValidSwapCandidates(
  eligibleAgents: FieldAgent[],
  currentAssignments: LinkedAssignment[],
  originatorId: string,
  exclusionRules: ExclusionRuleInput[] | Set<string> = []
): FieldAgent[] {
  const blockedSet = exclusionRules instanceof Set ? exclusionRules : buildExclusionIndex(exclusionRules);

  return eligibleAgents.filter((candidate) => {
    const plan = planCircleMove(currentAssignments, originatorId, candidate.id);
    if (!plan) return false;
    return (
      !isMatchBlocked(originatorId, candidate.id, blockedSet) &&
      !isMatchBlocked(candidate.id, plan.oldTargetId, blockedSet) &&
      !isMatchBlocked(plan.displacedGiverId, plan.displacedNextId, blockedSet)
    );
  });
}

/**
 * Reassigns the originator's target while keeping one gift circle.
 *
 * Tier 1 (what): If A gave to X, and T sat between P and S (P → T → S), then after the move
 * A → T → X and P → S. Everyone still gives 1 gift and receives 1.
 * Tier 2 (why): Exchanging two agents' targets always splits a circle into two loops; moving T
 * keeps it whole.
 * Tier 3 (how): O(N) lookups; three assignments change. Throws if any new pair is blocked.
 *
 * @param currentAssignments - Active linked assignments before the move
 * @param originatorId - ID of the agent being reassigned
 * @param newTargetId - ID of the new target being assigned to originator
 * @param exclusionRules - Configured exclusion rules (raw array or pre-compiled Set)
 * @returns Updated array of LinkedAssignment mappings
 *
 * @throws {Error} If the originator or the new target has no assignment.
 * @throws {Error} If any new pair violates an active exclusion rule.
 */
export function executeTargetSwap(
  currentAssignments: LinkedAssignment[],
  originatorId: string,
  newTargetId: string,
  exclusionRules: ExclusionRuleInput[] | Set<string> = []
): LinkedAssignment[] {
  const originatorAssignment = currentAssignments.find((a) => a.agentId === originatorId);
  if (!originatorAssignment) {
    throw new Error("Originating operator assignment not found.");
  }
  if (originatorAssignment.targetId === newTargetId) {
    return [...currentAssignments];
  }

  const plan = planCircleMove(currentAssignments, originatorId, newTargetId);
  if (!plan) {
    throw new Error("Selected target is not currently assigned to any agent.");
  }
  const { oldTargetId, displacedGiverId, displacedNextId } = plan;
  const blockedSet = exclusionRules instanceof Set ? exclusionRules : buildExclusionIndex(exclusionRules);

  if (isMatchBlocked(originatorId, newTargetId, blockedSet)) {
    throw new Error("This target swap violates an active preventative match rule.");
  }
  if (
    isMatchBlocked(newTargetId, oldTargetId, blockedSet) ||
    isMatchBlocked(displacedGiverId, displacedNextId, blockedSet)
  ) {
    throw new Error(
      "Cascading swap would assign a target that violates an active preventative match rule."
    );
  }

  return currentAssignments.map((a) => {
    if (a.agentId === originatorId) return { ...a, targetId: newTargetId };
    if (a.agentId === newTargetId) return { ...a, targetId: oldTargetId };
    if (a.agentId === displacedGiverId) return { ...a, targetId: displacedNextId };
    return a;
  });
}

export interface DrawFeasibilityResult {
  isFeasible: boolean;
  status: 'OPTIMAL' | 'TOO_FEW_AGENTS' | 'OVER_CONSTRAINED' | 'TRAPPED_AGENT' | 'THREE_AGENT_PARADOX';
  headline: string;
  message: string;
  themeColor: 'emerald' | 'amber' | 'rose';
  trappedAgentName?: string;
}

/**
 * Pre-evaluates whether a proposed roster and set of exclusion rules allow one unbroken gift circle.
 *
 * Tier 1 (what): Checks the roster minimum, then that every agent has at least 2 allowed partners
 * (one to give to, one to receive from), then that a full circle exists.
 * Tier 2 (why): Blocks are two-way, so an agent with fewer than 2 allowed partners can never sit in
 * a circle; the circle check catches rule sets that pass the partner count but still split the group.
 * Tier 3 (how): Exact `findGiftCircle` search. If the step cap runs out (only on very unusual rule
 * sets) the result counts as feasible; the draw itself still refuses if no circle is found.
 *
 * Returns festive, user-friendly diagnostic messages to guide the Head Elf in real time.
 */
export function evaluateDrawFeasibility(
  agents: FieldAgent[],
  exclusionRules: ExclusionRuleInput[] = []
): DrawFeasibilityResult {
  const eligibleAgents = agents.filter((a) => a.hasWishlistAttached !== false);
  const n = eligibleAgents.length;

  if (n < MIN_PARTICIPANTS) {
    return {
      isFeasible: false,
      status: 'TOO_FEW_AGENTS',
      headline: '🎅 Workshop Roster Needs More Operatives!',
      message: `Santa's Workshop requires at least ${MIN_PARTICIPANTS} active Elf Agents with attached Wishlists to launch a Secret Santa mission (${n}/${MIN_PARTICIPANTS} enlisted). Perfect for families and squads of 4 or more!`,
      themeColor: 'amber',
    };
  }

  const blockedSet = buildExclusionIndex(exclusionRules);

  // Every agent needs 2 different allowed partners: one to give to, one to receive from.
  for (const agent of eligibleAgents) {
    const partners = eligibleAgents.filter(
      (candidate) => candidate.id !== agent.id && !blockedSet.has(`${agent.id}:${candidate.id}`)
    ).length;
    if (partners < 2) {
      return {
        isFeasible: false,
        status: 'TRAPPED_AGENT',
        headline: '🎀 Tangled Ribbons Detected!',
        message: `${agent.name} (${agent.codename || 'Elf Agent'}) can only be paired with ${partners === 0 ? 'nobody' : '1 other operative'}. Every agent needs at least 2: one to give to and one to receive from. Untangle a few restrictions.`,
        themeColor: 'rose',
        trappedAgentName: agent.name,
      };
    }
  }

  if (findGiftCircle(eligibleAgents.map((a) => a.id), blockedSet) === null) {
    return {
      isFeasible: false,
      status: 'OVER_CONSTRAINED',
      headline: '🎀 Ribbons a Bit Too Tight!',
      message: "These preventative match rules make an unbroken Secret Santa circle mathematically impossible. Untangle a few blocked pairs to clear Santa's flight path!",
      themeColor: 'rose',
    };
  }

  return {
    isFeasible: true,
    status: 'OPTIMAL',
    headline: '✨ Sleigh Cleared for Takeoff! 🎄',
    message: `All ${n} Elf Agents have verified secret target routes with zero rule conflicts. Ready for matching!`,
    themeColor: 'emerald',
  };
}

/**
 * Checks a proposed new exclusion rule against the current roster.
 *
 * Tier 1 (what): Returns an error message when adding the rule would leave no gift circle, else `null`.
 * Tier 2 (why): Rules are validated when they are made, so the Head Elf sees the problem at once
 * instead of at the draw.
 * Tier 3 (how): Skipped below the roster minimum (more agents may still join; the draw-time check
 * covers it). Uses `evaluateDrawFeasibility` with every enrolled agent counted.
 *
 * @param members - Enrolled agents (ID and display name)
 * @param existingRules - Rules already on the mission
 * @param newRule - The rule being added
 * @returns A user-facing error message, or `null` when the rule is acceptable
 */
export function exclusionRuleProblem(
  members: { id: string; name: string; codename?: string | null }[],
  existingRules: ExclusionRuleInput[],
  newRule: ExclusionRuleInput
): string | null {
  if (members.length < MIN_PARTICIPANTS) return null;
  const agents = members.map((m) => ({ ...m, hasWishlistAttached: true }));
  const result = evaluateDrawFeasibility(agents, [...existingRules, newRule]);
  if (result.isFeasible) return null;
  return result.status === 'TRAPPED_AGENT'
    ? `This rule would leave ${result.trappedAgentName} with fewer than 2 possible partners (one to give to, one to receive from).`
    : 'This rule would make a single gift circle through every agent impossible.';
}
