/**
 * KovertKlaus - Kovert Delivery Mode (KDM) Engine
 *
 * Dedicated business logic for local stealth porch infiltration missions:
 * - High-entropy KDM token generation (KDM-XXXX-XXXX-XXXX)
 * - 1-Guess Real Name Identity Challenge verification with normalization
 * - Stealth outcome and badge resolution (🎅 Kovert Klaus vs. 🕵️ Vigilant Elf)
 */

export const KDM_TOKEN_REGEX = /^KDM-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i;

export const BADGE_KOVERT_KLAUS = 'KOVERT_KLAUS';
export const BADGE_VIGILANT_ELF = 'VIGILANT_ELF';

export interface CovertDeliveryOutcome {
  status: 'PENDING' | 'UNDETECTED' | 'BUSTED';
  badgeAwarded?: 'KOVERT_KLAUS' | 'VIGILANT_ELF' | null;
}

/**
 * Generates a high-entropy 12-character hexadecimal invitation token
 * prefixed with 'KDM-' and partitioned in groups of 4 (e.g. KDM-7F4A-9B2C-E3D1).
 */
export function generateKdmToken(): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments lacking Web Crypto
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');

  return `KDM-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

/**
 * Validates whether a given token conforms to the KDM-XXXX-XXXX-XXXX format.
 */
export function isValidKdmTokenFormat(token?: string | null): boolean {
  if (!token) return false;
  return KDM_TOKEN_REGEX.test(token.trim());
}

/**
 * Normalizes a full name for comparison:
 * - Trims whitespace and converts to lower case
 * - Strips common titles and prefixes (Agent:, Agent-, Mr., Mrs., Ms., Dr.)
 * - Removes non-alphanumeric punctuation (except space)
 * - Normalizes multiple spaces into a single space
 */
export function normalizeNameForComparison(rawName?: string | null): string {
  if (!rawName) return '';
  let clean = rawName.trim().toLowerCase();

  // Strip Agent / Title prefixes
  clean = clean.replace(/^(agent[-:\s]+|dr[\.\s]+|mr[\.\s]+|mrs[\.\s]+|ms[\.\s]+)/i, '');

  // Remove commas, hyphens, periods, quotes
  clean = clean.replace(/[,\.\-_'"#@!$%^&*()]/g, ' ');

  // Collapse multiple whitespace
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Verifies if the recipient's 1-time guess accurately identifies the secret giver's real name.
 * Handles both "First Last" and "Last First" permutations.
 */
export function verifyGiverIdentityGuess(guessedName?: string | null, actualGiverName?: string | null): boolean {
  const normGuess = normalizeNameForComparison(guessedName);
  const normActual = normalizeNameForComparison(actualGiverName);

  if (!normGuess || !normActual) return false;

  // Exact match after normalization
  if (normGuess === normActual) return true;

  // Token-based matching (handles "Zach Simpson" vs "Simpson Zach")
  const guessParts = normGuess.split(' ').filter(Boolean).sort();
  const actualParts = normActual.split(' ').filter(Boolean).sort();

  if (guessParts.length >= 2 && guessParts.length === actualParts.length) {
    const isTokensEqual = guessParts.every((part, idx) => part === actualParts[idx]);
    if (isTokensEqual) return true;
  }

  return false;
}

/**
 * Resolves the final debrief status and awards corresponding badges based on guess state.
 */
export function evaluateCovertOutcome(params: {
  targetGuessAttempted: boolean;
  targetGuessCorrect?: boolean | null;
  isGhostConfirmed?: boolean;
}): CovertDeliveryOutcome {
  const { targetGuessAttempted, targetGuessCorrect, isGhostConfirmed } = params;

  if (targetGuessAttempted && targetGuessCorrect === true) {
    return {
      status: 'BUSTED',
      badgeAwarded: 'VIGILANT_ELF',
    };
  }

  if ((targetGuessAttempted && targetGuessCorrect === false) || isGhostConfirmed) {
    return {
      status: 'UNDETECTED',
      badgeAwarded: 'KOVERT_KLAUS',
    };
  }

  return {
    status: 'PENDING',
    badgeAwarded: null,
  };
}
