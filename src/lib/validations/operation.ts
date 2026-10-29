/**
 * KovertKlaus Operation Configuration Validator & Automatic Date Calculator
 */

import { PLATFORM_LIMIT_BOUNDS } from '@/lib/platform-limits';

export interface CreateOperationInput {
  title: string;
  description?: string;
  maxParticipants?: number;
  giftingType: 'SINGLE' | 'MULTIPLE';
  isLocalOnly: boolean;
  eventLocation?: string;
  isWhiteElephant: boolean;
  enforcePenalties?: boolean;
  /** Head Elf toggle: may a wishlist total more than `budgetMax`? Defaults to true. */
  allowWishlistOverBudget?: boolean;
  budgetMin?: number;
  budgetMax: number;
  currency?: string;
  inviteCutoffDate: string | Date; // Go/No-Go Date
  assignmentDate: string | Date;   // Target Assignment Date
  shippingDate: string | Date;     // Gift Shipping Deadline
  executionDate: string | Date;    // Exchange Execution Date
}

type FieldCheck = (value: unknown) => boolean;
const isString: FieldCheck = (v) => typeof v === 'string';
const isBoolean: FieldCheck = (v) => typeof v === 'boolean';
const isFiniteNumber: FieldCheck = (v) => typeof v === 'number' && Number.isFinite(v);

/** Fields every create request must send, with the JSON type each must have. */
const REQUIRED_CONFIG_FIELDS: Record<string, FieldCheck> = {
  title: isString,
  giftingType: (v) => v === 'SINGLE' || v === 'MULTIPLE',
  budgetMax: isFiniteNumber,
  inviteCutoffDate: isString,
  assignmentDate: isString,
  shippingDate: isString,
  executionDate: isString,
};

/** Fields a create request may leave out or send as `null`. */
const OPTIONAL_CONFIG_FIELDS: Record<string, FieldCheck> = {
  description: isString,
  maxParticipants: isFiniteNumber,
  isLocalOnly: isBoolean,
  eventLocation: isString,
  isWhiteElephant: isBoolean,
  enforcePenalties: isBoolean,
  allowWishlistOverBudget: isBoolean,
  budgetMin: isFiniteNumber,
  currency: isString,
};

/**
 * Narrows an untrusted `config` request field to {@link CreateOperationInput}.
 *
 * Tier 1 (what): Checks the JSON type of each field. Optional fields may be absent or `null`;
 * `isLocalOnly` and `isWhiteElephant` default to `false`.
 * Tier 2 (why): `validateOperationConfig` checks values, not types. A numeric title made it throw
 * and a string budget reached Prisma, so both returned a 500 instead of a 400.
 * Tier 3 (how): Pure. Returns a new object holding only the known fields, or `null` when the value
 * is not an object or any field has the wrong type. Run it before `validateOperationConfig`.
 *
 * @param value - The request body's `config` field.
 */
export function parseOperationConfig(value: unknown): CreateOperationInput | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = { isLocalOnly: false, isWhiteElephant: false };

  for (const [key, check] of Object.entries(REQUIRED_CONFIG_FIELDS)) {
    if (!check(input[key])) return null;
    out[key] = input[key];
  }
  for (const [key, check] of Object.entries(OPTIONAL_CONFIG_FIELDS)) {
    if (input[key] === undefined || input[key] === null) continue;
    if (!check(input[key])) return null;
    out[key] = input[key];
  }
  return out as unknown as CreateOperationInput;
}

/**
 * Calculates 25%, 50%, 75% timeline dates automatically if only the execution date is specified.
 * 25% -> Go/No-Go Date (Invite Cutoff)
 * 50% -> Target Assignment Date
 * 75% -> Gift Shipping Deadline
 * 100% -> Execution Date
 */
export function calculateAutomaticOperationDates(executionDateInput: string | Date): {
  inviteCutoffDate: string;
  assignmentDate: string;
  shippingDate: string;
  executionDate: string;
} {
  const now = new Date();
  const execDate = new Date(executionDateInput);

  const totalTimeMs = execDate.getTime() - now.getTime();
  
  // If execution date is in the past or today, fallback to today
  if (totalTimeMs <= 0) {
    const execIso = execDate.toISOString().split('T')[0];
    return {
      inviteCutoffDate: execIso,
      assignmentDate: execIso,
      shippingDate: execIso,
      executionDate: execIso,
    };
  }

  const goNoGoMs = now.getTime() + totalTimeMs * 0.25;
  const assignmentMs = now.getTime() + totalTimeMs * 0.50;
  const shippingMs = now.getTime() + totalTimeMs * 0.75;

  return {
    inviteCutoffDate: new Date(goNoGoMs).toISOString().split('T')[0],
    assignmentDate: new Date(assignmentMs).toISOString().split('T')[0],
    shippingDate: new Date(shippingMs).toISOString().split('T')[0],
    executionDate: execDate.toISOString().split('T')[0],
  };
}

/**
 * Validates a new Holiday Mission.
 *
 * @param maxAgents - The platform's agents-per-mission limit (`PlatformSettings.maxMissionAgents`).
 */
export function validateOperationConfig(
  input: CreateOperationInput,
  maxAgents: number = PLATFORM_LIMIT_BOUNDS.maxMissionAgents.default
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required title
  if (!input.title || !input.title.trim()) {
    errors.push('Operation title is required.');
  }

  // Budget validation
  if (!input.budgetMax || input.budgetMax <= 0) {
    errors.push('Maximum budget must be greater than $0.');
  }
  if (input.budgetMin && input.budgetMin > input.budgetMax) {
    errors.push('Minimum budget cannot exceed maximum budget.');
  }

  // Local & White Elephant Rules
  if (input.isLocalOnly && (!input.eventLocation || !input.eventLocation.trim())) {
    errors.push('Local operations require an event location address.');
  }

  if (input.isWhiteElephant && !input.isLocalOnly) {
    errors.push('White Elephant gifting is restricted to local in-person events only.');
  }

  // Operative capacity (optional; when set it must sit within the platform's limit)
  errors.push(...validateCapacity(input.maxParticipants, maxAgents));

  // All 4 Dates are Strictly Required
  if (!input.inviteCutoffDate) errors.push('Go/No-Go Date (Invite Cutoff) is required.');
  if (!input.assignmentDate) errors.push('Target Assignment Date is required.');
  if (!input.shippingDate) errors.push('Gift Shipping Deadline is required.');
  if (!input.executionDate) errors.push('Execution Date is required.');

  // Date Parsing
  const cutoff = new Date(input.inviteCutoffDate);
  const assignment = new Date(input.assignmentDate);
  const shipping = new Date(input.shippingDate);
  const execution = new Date(input.executionDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(cutoff.getTime())) errors.push('Invalid Go/No-Go Date (Invite Cutoff).');
  if (isNaN(assignment.getTime())) errors.push('Invalid Assignment Date.');
  if (isNaN(shipping.getTime())) errors.push('Invalid Shipping Date.');
  if (isNaN(execution.getTime())) errors.push('Invalid Execution Date.');

  // Strict Range Enforcement: Dates cannot be before current day or after execution day
  if (cutoff < today) {
    errors.push('Go/No-Go Date cannot be set prior to today.');
  }

  if (cutoff > execution || assignment > execution || shipping > execution) {
    errors.push('Operational timeline dates cannot be scheduled after the Execution Date.');
  }

  // Sequence Order Validation
  if (cutoff > assignment) {
    errors.push('Go/No-Go Date (Invite Cutoff) cannot be set after Target Assignment Date.');
  }

  if (assignment > shipping) {
    errors.push('Target Assignment Date cannot be set after Gift Shipping Deadline.');
  }

  if (shipping > execution) {
    errors.push('Gift Shipping Deadline cannot be set after Exchange Execution Date.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/** Smallest capacity a Head Elf can set (families and groups of 4+). The largest is the platform limit. */
export const MIN_OPERATIVES = 4;

/** The editable (non-timeline) settings of an existing Holiday Mission, after merging the patch. */
export interface OperationSettingsInput {
  title: string;
  budgetMin?: number | null;
  budgetMax: number;
  maxParticipants?: number | null;
  isLocalOnly: boolean;
  eventLocation?: string | null;
  isWhiteElephant: boolean;
  /** Agents already enrolled; capacity may not drop below this. */
  currentMemberCount: number;
}

/**
 * Validates a Head Elf's settings edit on an existing Holiday Mission.
 *
 * Tier 1 (what): Checks title, budget range, capacity and the local / White Elephant rules on the
 * merged (existing + patched) settings.
 * Tier 2 (why): Timeline dates are validated separately by `validateOperationConfig`. Running that
 * here would reject every settings edit once the Go/No-Go date has passed.
 * Tier 3 (how): Pure; returns the same `{ isValid, errors }` shape as `validateOperationConfig`.
 *
 * @param maxAgents - The platform's agents-per-mission limit (`PlatformSettings.maxMissionAgents`).
 */
export function validateOperationSettings(
  input: OperationSettingsInput,
  maxAgents: number = PLATFORM_LIMIT_BOUNDS.maxMissionAgents.default
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.title || !input.title.trim()) errors.push('Operation title is required.');
  if (!Number.isFinite(input.budgetMax) || input.budgetMax <= 0) errors.push('Maximum budget must be greater than $0.');
  if (input.budgetMin != null && (!Number.isFinite(input.budgetMin) || input.budgetMin < 0)) {
    errors.push('Minimum budget must be $0 or more.');
  }
  if (input.budgetMin != null && input.budgetMin > input.budgetMax) {
    errors.push('Minimum budget cannot exceed maximum budget.');
  }
  errors.push(...validateCapacity(input.maxParticipants, maxAgents));
  if (input.maxParticipants != null && input.maxParticipants < input.currentMemberCount) {
    errors.push(`Capacity cannot be lower than the ${input.currentMemberCount} agents already enrolled.`);
  }
  if (input.isLocalOnly && (!input.eventLocation || !input.eventLocation.trim())) {
    errors.push('Local operations require an event location address.');
  }
  if (input.isWhiteElephant && !input.isLocalOnly) {
    errors.push('White Elephant gifting is restricted to local in-person events only.');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates an optional operative capacity against `MIN_OPERATIVES`..`maxAgents`. A Head Elf may tighten
 * the platform limit, never loosen it.
 *
 * @param maxParticipants - Capacity, or null/undefined for "no explicit cap" (the platform limit applies).
 * @param maxAgents - The platform's agents-per-mission limit.
 * @returns Error messages (empty when valid).
 */
export function validateCapacity(maxParticipants: number | null | undefined, maxAgents: number): string[] {
  if (maxParticipants == null) return [];
  if (!Number.isInteger(maxParticipants) || maxParticipants < MIN_OPERATIVES || maxParticipants > maxAgents) {
    return [`Max Operative capacity must be between ${MIN_OPERATIVES} and ${maxAgents} agents.`];
  }
  return [];
}
