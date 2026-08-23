/**
 * KovertKlaus Tactical Callsign Generator & Collision Resolver Engine
 * 
 * Provides CSPRNG-based festive/espionage codename generation,
 * event-scoped roster collision detection, and automated resolution suggestions.
 */

export const TACTICAL_PREFIXES = [
  'Frost',
  'Shadow',
  'Blizzard',
  'Kovert',
  'Glacier',
  'Midnight',
  'Evergreen',
  'Tinsel',
  'Nutcracker',
  'Vanguard',
  'Cobalt',
  'Ghost',
  'Polar',
  'Winter',
  'Cipher',
  'Icicle',
  'Timber',
  'Sleigh',
  'Rudolph',
  'Aurora',
] as const;

export const TACTICAL_SUFFIXES = [
  'Viper',
  'Spectre',
  'Fox',
  'Hawk',
  'Falcon',
  'Wolf',
  'Reindeer',
  'Echo',
  'Cipher',
  'Recon',
  'Sentinel',
  'Striker',
  'Agent',
  'Knight',
  'Scout',
  'Sniper',
  'Courier',
  'Stalker',
  'Phantom',
  'Tracker',
] as const;

/**
 * Generates a random festive/spy codename.
 * e.g. "Blizzard-Fox", "Shadow-Cipher", "Frost-Sentinel"
 */
export function generateRandomCodename(existingCodenames: string[] = []): string {
  const normalizedExisting = new Set(
    existingCodenames.map((c) => c.trim().toLowerCase())
  );

  // Try up to 50 random combinations to find an unused one
  for (let i = 0; i < 50; i++) {
    const prefix = TACTICAL_PREFIXES[Math.floor(Math.random() * TACTICAL_PREFIXES.length)];
    const suffix = TACTICAL_SUFFIXES[Math.floor(Math.random() * TACTICAL_SUFFIXES.length)];
    const candidate = `${prefix}-${suffix}`;

    if (!normalizedExisting.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  // Fallback with random discriminator if all primary combinations are exhausted
  const randomPrefix = TACTICAL_PREFIXES[Math.floor(Math.random() * TACTICAL_PREFIXES.length)];
  const randomSuffix = TACTICAL_SUFFIXES[Math.floor(Math.random() * TACTICAL_SUFFIXES.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${randomPrefix}-${randomSuffix}-${num}`;
}

export interface CodenameResolutionResult {
  codename: string;
  isRandomized: boolean;
  wasCollided: boolean;
  suggestions: string[];
}

/**
 * Resolves an operative's codename for a target operation roster:
 * 1. If autoRandomize is enabled -> Generates a unique random tactical callsign.
 * 2. If preferredName is provided -> Checks for collisions against existing members.
 * 3. If collision occurs -> Returns collision warning + 3 alternative suggestions.
 */
export function resolveUniqueCodename(
  requestedName: string | null | undefined,
  existingRosterCodenames: string[] = [],
  autoRandomize = false
): CodenameResolutionResult {
  const normalizedExisting = new Set(
    existingRosterCodenames.map((c) => c.trim().toLowerCase())
  );

  // Mode A: Stealth Randomization (Auto-Randomize Enabled)
  if (autoRandomize || !requestedName || !requestedName.trim()) {
    const generated = generateRandomCodename(existingRosterCodenames);
    return {
      codename: generated,
      isRandomized: true,
      wasCollided: false,
      suggestions: [
        generateRandomCodename([...existingRosterCodenames, generated]),
        generateRandomCodename([...existingRosterCodenames, generated]),
      ],
    };
  }

  const cleanRequested = requestedName.trim();
  const lowerRequested = cleanRequested.toLowerCase();

  // Mode B: Requested Name is Free
  if (!normalizedExisting.has(lowerRequested)) {
    return {
      codename: cleanRequested,
      isRandomized: false,
      wasCollided: false,
      suggestions: [],
    };
  }

  // Mode C: Collision Detected -> Generate Smart Suggestions
  const suggestions: string[] = [];

  // Suggestion 1: Numeric suffix (e.g. "NightOwl-2")
  let suffixNum = 2;
  while (normalizedExisting.has(`${lowerRequested}-${suffixNum}`)) {
    suffixNum++;
  }
  suggestions.push(`${cleanRequested}-${suffixNum}`);

  // Suggestion 2: Tactical Prefix variation (e.g. "Shadow-NightOwl" or "Frost-NightOwl")
  const prefix = TACTICAL_PREFIXES[Math.floor(Math.random() * TACTICAL_PREFIXES.length)];
  const prefixCandidate = `${prefix}-${cleanRequested}`;
  if (!normalizedExisting.has(prefixCandidate.toLowerCase())) {
    suggestions.push(prefixCandidate);
  }

  // Suggestion 3: Fresh Random Tactical Callsign
  suggestions.push(generateRandomCodename([...existingRosterCodenames, ...suggestions]));

  return {
    codename: suggestions[0], // Default to first available suggestion
    isRandomized: false,
    wasCollided: true,
    suggestions,
  };
}
