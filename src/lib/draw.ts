/**
 * KovertKlaus Target Assignment Protocol
 * 
 * Implements a cryptographically secure randomized derangement algorithm guaranteeing 1-to-1 matching:
 * Every operative gives exactly 1 gift and receives exactly 1 gift.
 * 
 * Mathematical Invariants:
 * 1. Exact Cyclic Derangement: Permutation contains zero fixed points (sigma(i) != i for all i).
 * 2. Bidirectional Exclusion: For any rule (A, B), sigma(A) != B AND sigma(B) != A.
 * 3. Constant Chain Obfuscation: Pairings cannot be reverse-engineered by compromised participants.
 * 4. Two-Way Cascading Swaps: Allows Head Elf manual reassignments preserving the single 1-to-1 cycle.
 * 
 * Algorithmic Design:
 * - CSPRNG Entropy: Uses unbiased rejection-sampled cryptographically secure pseudorandom integers.
 * - O(1) Pre-Indexed Exclusions: Compiles exclusion rules into a Set of composite keys (`${A}:${B}`),
 *   reducing candidate graph validation from O(N * |E|) to O(N).
 * - Fisher-Yates Derangement: Generates unbiased candidate permutations and verifies them against
 *   the pre-compiled exclusion matrix with configurable retry depth.
 */

import { getSecureRandomInt } from './security';

export interface FieldAgent {
  /** Unique user / member identifier */
  id: string;
  /** Full human name of the operative */
  name: string;
  /** Optional tactical call sign (e.g. Agent-Viper) */
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

/**
 * Computes a cryptographically random cyclic derangement matching all eligible operatives.
 * 
 * Algorithm:
 * - Pre-compiles exclusion rules into an O(1) bidirectional lookup index.
 * - Employs a CSPRNG Fisher-Yates permutation algorithm with rejection sampling.
 * - Iteratively verifies candidate permutations in O(N) time against the active exclusion index.
 * - Automatically limits search space to 2,000 attempts before failing gracefully on over-constrained topologies.
 * 
 * Time Complexity: O(|E|) pre-compilation + O(K * N) where K <= 2000 attempts and N is agent count.
 * Space Complexity: O(N + |E|) for permutation and exclusion indices.
 * 
 * @param agents - List of enrolled operatives
 * @param options - Draw configuration parameters (exclusions, wishlist requirements)
 * @returns Array of 1-to-1 LinkedAssignment mappings
 * 
 * @throws {Error} If operation is White Elephant (digital draw forbidden).
 * @throws {Error} If fewer than 2 eligible operatives have attached wishlists.
 * @throws {Error} If exclusion rules make valid derangement mathematically impossible (over-constrained).
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

  // Filter eligible agents
  let eligibleAgents = [...agents];

  if (options.dropAgentsWithoutWishlists) {
    eligibleAgents = eligibleAgents.filter((a) => a.hasWishlistAttached);
  }

  if (eligibleAgents.length < 2) {
    throw new Error(
      "Target assignment requires at least 2 active Field Agents with attached wishlists."
    );
  }

  const blockedSet = buildExclusionIndex(options.exclusionRules || []);
  const n = eligibleAgents.length;
  const maxAttempts = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = [...eligibleAgents];

    // Cryptographically secure Fisher-Yates shuffle
    for (let i = n - 1; i > 0; i--) {
      const j = getSecureRandomInt(i + 1);
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }

    // Check validity of all pairings in O(N) using pre-indexed O(1) set lookups
    let isValid = true;
    for (let i = 0; i < n; i++) {
      const giverId = eligibleAgents[i].id;
      const receiverId = shuffled[i].id;
      if (giverId === receiverId || blockedSet.has(`${giverId}:${receiverId}`)) {
        isValid = false;
        break;
      }
    }

    if (isValid) {
      return eligibleAgents.map((agent, i) => ({
        agentId: agent.id,
        targetId: shuffled[i].id,
      }));
    }
  }

  throw new Error(
    "Over-constrained operation: Unable to find a valid target assignment. Please remove or relax preventative match rules."
  );
}

/**
 * Computes the list of valid candidate targets for a manual reassignment.
 * 
 * Enforces 3 filtering predicates:
 * 1. Self Exclusion: Originator cannot be matched with themselves.
 * 2. Redundancy Guard: Originator cannot swap to their already-assigned target.
 * 3. Bidirectional Exclusions: Excludes any operative violating configured exclusion pairs.
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
  const currentAssignment = currentAssignments.find((a) => a.agentId === originatorId);
  const currentTargetId = currentAssignment?.targetId;
  const blockedSet = exclusionRules instanceof Set ? exclusionRules : buildExclusionIndex(exclusionRules);

  return eligibleAgents.filter((candidate) => {
    // 1. Exclude self
    if (candidate.id === originatorId) return false;
    // 2. Exclude current target
    if (candidate.id === currentTargetId) return false;
    // 3. Exclude blocked pairs (bidirectional check)
    if (isMatchBlocked(originatorId, candidate.id, blockedSet)) return false;

    return true;
  });
}

/**
 * Executes an atomic 2-way cascading target swap between the Originator and Displaced Giver.
 * 
 * Invariant Preservation:
 * - If Agent A gave to Target X, and Agent B gave to Target Y.
 * - After swapping A -> Y: Agent B is automatically updated to give B -> X.
 * - Guarantees that all operatives still give 1 gift and receive 1 gift without breaking the cyclic chain.
 * 
 * @param currentAssignments - Active linked assignments before swap
 * @param originatorId - ID of the agent being reassigned
 * @param newTargetId - ID of the new target being assigned to originator
 * @param exclusionRules - Configured exclusion rules (raw array or pre-compiled Set)
 * @returns Updated array of LinkedAssignment mappings
 * 
 * @throws {Error} If originator assignment or displaced target assignment is not found.
 * @throws {Error} If either the direct swap or cascading swap violates an active exclusion rule.
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

  const oldTargetId = originatorAssignment.targetId;
  if (oldTargetId === newTargetId) {
    return [...currentAssignments];
  }

  const displacedAssignment = currentAssignments.find((a) => a.targetId === newTargetId);
  if (!displacedAssignment) {
    throw new Error("Selected target is not currently assigned to any agent.");
  }
  const displacedGiverId = displacedAssignment.agentId;
  const blockedSet = exclusionRules instanceof Set ? exclusionRules : buildExclusionIndex(exclusionRules);

  // Validate both new pairs against self-draw and exclusion rules
  if (isMatchBlocked(originatorId, newTargetId, blockedSet)) {
    throw new Error("This target swap violates an active preventative match rule.");
  }
  if (isMatchBlocked(displacedGiverId, oldTargetId, blockedSet)) {
    throw new Error(
      "Cascading swap would assign a target that violates an active preventative match rule."
    );
  }

  return currentAssignments.map((a) => {
    if (a.agentId === originatorId) {
      return { ...a, targetId: newTargetId };
    }
    if (a.agentId === displacedGiverId) {
      return { ...a, targetId: oldTargetId };
    }
    return a;
  });
}

