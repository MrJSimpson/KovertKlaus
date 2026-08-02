/**
 * KovertKlaus Operation Configuration Validator
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
  inviteCutoffDate: string | Date;
  assignmentDate: string | Date;
  shippingDate?: string | Date;
  executionDate: string | Date;
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

  // Date Parsing & Sequence Validations
  const cutoff = new Date(input.inviteCutoffDate);
  const assignment = new Date(input.assignmentDate);
  const execution = new Date(input.executionDate);

  if (isNaN(cutoff.getTime())) errors.push('Invalid Invite Cutoff Date.');
  if (isNaN(assignment.getTime())) errors.push('Invalid Assignment Date.');
  if (isNaN(execution.getTime())) errors.push('Invalid Execution Date.');

  if (cutoff > assignment) {
    errors.push('Invite Cutoff Date cannot be after Assignment Date.');
  }

  if (!input.isWhiteElephant) {
    if (!input.shippingDate) {
      errors.push('Shipping Date is required for remote/standard gift exchanges.');
    } else {
      const shipping = new Date(input.shippingDate);
      if (isNaN(shipping.getTime())) errors.push('Invalid Shipping Date.');
      if (assignment >= shipping) {
        errors.push('Assignment Date must be before Shipping Date.');
      }
      if (shipping >= execution) {
        errors.push('Shipping Date must be before Execution Day.');
      }
    }
  } else {
    if (assignment >= execution) {
      errors.push('Assignment Date must be before Execution Day.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
