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
  budgetMin?: number;
  budgetMax: number;
  currency?: string;
  inviteCutoffDate: string | Date; // Go/No-Go Date
  assignmentDate: string | Date;   // Target Assignment Date
  shippingDate: string | Date;     // Gift Shipping Deadline (Required for all operations)
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
  
  // If execution date is in the past or today, fallback to 1-day offsets
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

  // Date Parsing & Sequence Validations
  const cutoff = new Date(input.inviteCutoffDate);
  const assignment = new Date(input.assignmentDate);
  const shipping = new Date(input.shippingDate);
  const execution = new Date(input.executionDate);

  if (isNaN(cutoff.getTime())) errors.push('Invalid Go/No-Go Date (Invite Cutoff).');
  if (isNaN(assignment.getTime())) errors.push('Invalid Assignment Date.');
  if (isNaN(shipping.getTime())) errors.push('Invalid Shipping Date.');
  if (isNaN(execution.getTime())) errors.push('Invalid Execution Date.');

  if (cutoff > assignment) {
    errors.push('Go/No-Go Date (Invite Cutoff) cannot be after Assignment Date.');
  }

  if (assignment >= shipping) {
    errors.push('Assignment Date must be before Shipping Date.');
  }

  if (shipping >= execution) {
    errors.push('Shipping Date must be before Execution Date.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
