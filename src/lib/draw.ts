/**
 * KovertKlaus Target Assignment Protocol
 * 
 * Randomized derangement algorithm that guarantees 1-to-1 matching
 * (every operative gives 1 gift and receives 1 gift) while obfuscating
 * chain predictability so revealing one pair does not reveal the rest of the group.
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

export interface DrawOptions {
  isWhiteElephant?: boolean;
  dropAgentsWithoutWishlists?: boolean;
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

  // Randomized derangement algorithm using Sattolo's algorithm / cycle shuffling
  // Ensures zero self-assignments and obfuscated chain order
  const shuffled = [...eligibleAgents];
  const n = shuffled.length;

  // Sattolo's algorithm for uniform random derangements (single cycle with randomized position)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i); // Random index from 0 to i-1
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  const assignments: LinkedAssignment[] = [];
  for (let i = 0; i < n; i++) {
    const giver = eligibleAgents[i];
    const receiver = shuffled[i];

    // Double check derangement constraint (no self-assignments)
    if (giver.id === receiver.id) {
      // Swap with next candidate if exact match occurs
      const nextIdx = (i + 1) % n;
      const temp = shuffled[i];
      shuffled[i] = shuffled[nextIdx];
      shuffled[nextIdx] = temp;
    }
  }

  // Build final assignments
  for (let i = 0; i < n; i++) {
    assignments.push({
      agentId: eligibleAgents[i].id,
      targetId: shuffled[i].id,
    });
  }

  return assignments;
}
