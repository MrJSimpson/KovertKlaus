/**
 * KovertKlaus Target Assignment Protocol
 * 
 * Randomized derangement algorithm that guarantees 1-to-1 matching
 * (every operative gives 1 gift and receives 1 gift) while obfuscating
 * chain predictability so revealing one pair does not reveal the rest of the group.
 * Includes support for strictly bidirectional preventative match rules and 2-way target swaps.
 */

export interface FieldAgent {
  id: string;
  name: string;
  codename?: string | null;
  hasWishlistAttached: boolean;
}

export interface LinkedAssignment {
  agentId: string;
  targetId: string;
}

export interface ExclusionRuleInput {
  agentId: string;
  restrictedAgentId: string;
}

export interface DrawOptions {
  isWhiteElephant?: boolean;
  dropAgentsWithoutWishlists?: boolean;
  exclusionRules?: ExclusionRuleInput[];
}

/**
 * Checks whether a match between agentA and agentB is blocked.
 * Enforces 100% bidirectional exclusion rules (A <-> B).
 */
export function isMatchBlocked(
  agentAId: string,
  agentBId: string,
  exclusionRules: ExclusionRuleInput[] = []
): boolean {
  if (agentAId === agentBId) return true; // Self-assignment is always blocked
  return exclusionRules.some(
    (rule) =>
      (rule.agentId === agentAId && rule.restrictedAgentId === agentBId) ||
      (rule.agentId === agentBId && rule.restrictedAgentId === agentAId)
  );
}

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

  const exclusionRules = options.exclusionRules || [];
  const n = eligibleAgents.length;
  const maxAttempts = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = [...eligibleAgents];

    // Sattolo's / Fisher-Yates shuffle for randomized derangements
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }

    // Check validity of all pairings against self-draw and bidirectional exclusion rules
    let isValid = true;
    for (let i = 0; i < n; i++) {
      const giverId = eligibleAgents[i].id;
      const receiverId = shuffled[i].id;
      if (isMatchBlocked(giverId, receiverId, exclusionRules)) {
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
 * Returns candidate agents that can be assigned as a new target for the originating operator.
 * Filters out:
 * 1. The Originating Operator (self)
 * 2. The Current Target
 * 3. Any agent blocked by bidirectional exclusion rules
 */
export function getValidSwapCandidates(
  eligibleAgents: FieldAgent[],
  currentAssignments: LinkedAssignment[],
  originatorId: string,
  exclusionRules: ExclusionRuleInput[] = []
): FieldAgent[] {
  const currentAssignment = currentAssignments.find((a) => a.agentId === originatorId);
  const currentTargetId = currentAssignment?.targetId;

  return eligibleAgents.filter((candidate) => {
    // 1. Exclude self
    if (candidate.id === originatorId) return false;
    // 2. Exclude current target
    if (candidate.id === currentTargetId) return false;
    // 3. Exclude blocked pairs (bidirectional check)
    if (isMatchBlocked(originatorId, candidate.id, exclusionRules)) return false;

    return true;
  });
}

/**
 * Executes a 2-way cascade target swap between Originating Operator and Displaced Giver.
 * Preserves the invariant that every operative gives 1 gift and receives 1 gift.
 */
export function executeTargetSwap(
  currentAssignments: LinkedAssignment[],
  originatorId: string,
  newTargetId: string,
  exclusionRules: ExclusionRuleInput[] = []
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

  // Validate both new pairs against self-draw and exclusion rules
  if (isMatchBlocked(originatorId, newTargetId, exclusionRules)) {
    throw new Error("This target swap violates an active preventative match rule.");
  }
  if (isMatchBlocked(displacedGiverId, oldTargetId, exclusionRules)) {
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
