/**
 * KovertKlaus Demerit Governance & Auto-Rehabilitation Engine
 * 
 * Core Invariants:
 * 1. Platform Non-Intermediary Principle:
 *    Platform admins NEVER arbitrate personal disputes. Demerits and waivers
 *    are computed 100% deterministically by automated system rules.
 * 2. Intentional Neglect Standard:
 *    Penalties are only assessed if an operative has unfulfilled shipping AND zero carrier tracking proof.
 * 3. Carrier Protection Waiver:
 *    Submitting a valid tracking number (USPS, FedEx, UPS, DHL) grants automatic penalty immunity.
 * 4. Automatic Rehabilitation Engine:
 *    Fulfilling any subsequent mission (or participating in White Elephant) decrements penalty points by 1 (-1),
 *    restoring account status to ACTIVE when points drop below 3.
 */

export type AccountStatus = 'ACTIVE' | 'REMOTE_RESTRICTED' | 'DISABLED';

export interface AuditMemberInput {
  userId: string;
  userName: string;
  shippingStatus?: 'PENDING' | 'SHIPPED' | 'DELIVERED' | null;
  deliveredConfirmed?: boolean | null;
  trackingNumber?: string | null;
  currentPenaltyPoints: number;
  currentAccountStatus: AccountStatus;
  isWhiteElephant?: boolean;
}

export interface AuditOutcome {
  userId: string;
  userName: string;
  penalized: boolean;
  carrierWaived: boolean;
  demeritCleared: boolean;
  newDemeritCount: number;
  newAccountStatus: AccountStatus;
  reason: string;
}

/**
 * Resolves account access tier based on active penalty points.
 * 
 * Tiers:
 * - 0 to 2 Coal Citations: ACTIVE (Full platform access).
 * - 3 Coal Citations: REMOTE_RESTRICTED (Relegated to local in-person events only).
 * - 4+ Coal Citations: DISABLED (Suspended from creating or joining missions).
 * 
 * @param penaltyPoints - Number of active penalty points (>= 0)
 * @returns Standard AccountStatus tier
 */
export function resolveAccountStatus(penaltyPoints: number): AccountStatus {
  if (penaltyPoints >= 4) {
    return 'DISABLED';
  }
  if (penaltyPoints === 3) {
    return 'REMOTE_RESTRICTED';
  }
  return 'ACTIVE';
}

/**
 * Validates whether a provided package tracking number meets minimum standard format criteria.
 * Supports USPS (20-22 digits), FedEx (12-15 digits), UPS (1Z...), DHL (10-11 digits), or alphanumeric strings >= 8 chars.
 * 
 * @param trackingNumber - Carrier tracking identifier string
 * @returns `true` if valid tracking format; `false` otherwise
 */
export function isCarrierTrackingValid(trackingNumber: string | null | undefined): boolean {
  if (!trackingNumber) return false;
  const clean = trackingNumber.trim().replace(/[\s-]/g, '');
  return clean.length >= 8;
}

/**
 * Evaluates an operative's mission fulfillment on Execution Day and computes demerit updates.
 * 
 * @param input - Operative fulfillment parameters
 * @returns Deterministic AuditOutcome object with updated penalty points and account status
 */
export function evaluateMemberAudit(input: AuditMemberInput): AuditOutcome {
  const {
    userId,
    userName,
    shippingStatus = 'PENDING',
    deliveredConfirmed = false,
    trackingNumber,
    currentPenaltyPoints,
    currentAccountStatus,
    isWhiteElephant = false,
  } = input;

  // Case 1: White Elephant Missions
  // In-person White Elephant fulfills obligations for all attending operatives.
  if (isWhiteElephant) {
    if (currentPenaltyPoints > 0) {
      const newPenaltyPoints = Math.max(0, currentPenaltyPoints - 1);
      const newAccountStatus = resolveAccountStatus(newPenaltyPoints);
      return {
        userId,
        userName,
        penalized: false,
        carrierWaived: false,
        demeritCleared: true,
        newDemeritCount: newPenaltyPoints,
        newAccountStatus,
        reason: 'Mission completed. 1 Coal Citation removed via White Elephant participation.',
      };
    }
    return {
      userId,
      userName,
      penalized: false,
      carrierWaived: false,
      demeritCleared: false,
      newDemeritCount: 0,
      newAccountStatus: currentAccountStatus,
      reason: 'White Elephant completed in good standing.',
    };
  }

  // Case 2: Secret Santa Unfulfilled
  const isUnfulfilled = shippingStatus === 'PENDING' && !deliveredConfirmed;
  const hasTrackingProof = isCarrierTrackingValid(trackingNumber);

  if (isUnfulfilled) {
    if (hasTrackingProof) {
      // Carrier Protection Waiver Active
      return {
        userId,
        userName,
        penalized: false,
        carrierWaived: true,
        demeritCleared: false,
        newDemeritCount: currentPenaltyPoints,
        newAccountStatus: currentAccountStatus,
        reason: 'Carrier Protection Waiver: Tracking proof provided. Penalty waived.',
      };
    }

    // Intentional Neglect: Issue +1 Coal Citation
    const newPenaltyPoints = currentPenaltyPoints + 1;
    const newAccountStatus = resolveAccountStatus(newPenaltyPoints);
    return {
      userId,
      userName,
      penalized: true,
      carrierWaived: false,
      demeritCleared: false,
      newDemeritCount: newPenaltyPoints,
      newAccountStatus,
      reason: 'Intentional Neglect: Unfulfilled delivery without carrier tracking proof.',
    };
  }

  // Case 3: Secret Santa Fulfilled (Delivered or Shipped)
  if (currentPenaltyPoints > 0) {
    const newPenaltyPoints = Math.max(0, currentPenaltyPoints - 1);
    const newAccountStatus = resolveAccountStatus(newPenaltyPoints);
    return {
      userId,
      userName,
      penalized: false,
      carrierWaived: false,
      demeritCleared: true,
      newDemeritCount: newPenaltyPoints,
      newAccountStatus,
      reason: 'Mission fulfilled. 1 Coal Citation removed via automated rehabilitation.',
    };
  }

  return {
    userId,
    userName,
    penalized: false,
    carrierWaived: false,
    demeritCleared: false,
    newDemeritCount: 0,
    newAccountStatus: currentAccountStatus,
    reason: 'Mission fulfilled in good standing.',
  };
}
