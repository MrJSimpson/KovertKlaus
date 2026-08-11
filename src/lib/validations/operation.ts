/**
 * KovertKlaus Operation Configuration Validator & Automatic Date Calculator
 */

export interface CreateOperationInput {
  title: string;
  description?: string;
  maxParticipants?: number;
  giftingType: 'SINGLE' | 'MULTIPLE';
  isLocalOnly: boolean;
  eventLocation?: string;
  isWhiteElephant: boolean;
  enforcePenalties?: boolean;
  budgetMin?: number;
  budgetMax: number;
  currency?: string;
  inviteCutoffDate: string | Date; // Go/No-Go Date
  assignmentDate: string | Date;   // Target Assignment Date
  shippingDate: string | Date;     // Gift Shipping Deadline
  executionDate: string | Date;    // Exchange Execution Date
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

export function validateOperationConfig(input: CreateOperationInput): { isValid: boolean; errors: string[] } {
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
