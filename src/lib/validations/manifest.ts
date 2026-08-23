/**
 * KovertKlaus Dual Manifest & Budget Limit Validator
 * 
 * Implements the Anti-Overwishing Budget Architecture (+20% Hard Cap),
 * Decoupled Wishlist Cloning, and Pre-Draw Eligibility Verification.
 */

export interface ManifestItemInput {
  id?: string;
  title: string;
  url?: string;
  price: number;
  description?: string;
  thumbnailUrl?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  isClaimed?: boolean;
}

export type BudgetStatus = 'IN_BUDGET' | 'UNDER_MIN' | 'OVER_SOFT_LIMIT' | 'OVERWISHING_HARD_BREACH';

export interface ItemBudgetValidation {
  status: BudgetStatus;
  isAllowed: boolean;
  itemPrice: number;
  softLimit: number;
  hardLimit?: number;
  budgetMin?: number;
  message: string;
  badgeStyle: string;
}

export interface DrawEligibilityResult {
  isEligible: boolean;
  totalItems: number;
  validItemsCount: number;
  breachingItemsCount: number;
  statusLabel: string;
  statusColor: string;
  bannerMessage: string;
}

/**
 * Calculates the recommended hard cap (+20% anti-overwishing buffer) from a target soft budget.
 * Example: $50.00 -> $60.00
 */
export function calculateRecommendedHardLimit(budgetMax: number, bufferPct = 0.20): number {
  if (!budgetMax || budgetMax <= 0) return 0;
  const raw = budgetMax * (1 + bufferPct);
  // Round cleanly to 2 decimal places
  return Math.round(raw * 100) / 100;
}

/**
 * Validates an individual item price against event soft and optional hard limits.
 */
export function validateItemBudget(
  price: number,
  budgetMax: number,
  budgetHardLimit?: number,
  budgetMin?: number
): ItemBudgetValidation {
  const itemPrice = Math.max(0, price || 0);
  const softLimit = Math.max(0, budgetMax || 0);
  const hardLimit = budgetHardLimit && budgetHardLimit > 0 ? budgetHardLimit : undefined;

  // 1. Check Hard Limit Breach (Anti-Overwishing Gate)
  if (hardLimit && itemPrice > hardLimit) {
    return {
      status: 'OVERWISHING_HARD_BREACH',
      isAllowed: false,
      itemPrice,
      softLimit,
      hardLimit,
      budgetMin,
      message: `🚫 Item price ($${itemPrice.toFixed(2)}) exceeds the event's $${hardLimit.toFixed(2)} anti-overwishing limit.`,
      badgeStyle: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    };
  }

  // 2. Check Under Minimum Budget (if configured)
  if (budgetMin && budgetMin > 0 && itemPrice < budgetMin) {
    return {
      status: 'UNDER_MIN',
      isAllowed: true,
      itemPrice,
      softLimit,
      hardLimit,
      budgetMin,
      message: `💡 Add-On / Stocking Stuffer ($${itemPrice.toFixed(2)} is below the $${budgetMin.toFixed(2)} min target).`,
      badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    };
  }

  // 3. Check Over Soft Target (Allowed but flagged for buyer awareness)
  if (softLimit > 0 && itemPrice > softLimit) {
    return {
      status: 'OVER_SOFT_LIMIT',
      isAllowed: true,
      itemPrice,
      softLimit,
      hardLimit,
      budgetMin,
      message: `🟡 Slightly exceeds $${softLimit.toFixed(2)} target budget.`,
      badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    };
  }

  // 4. In Budget
  return {
    status: 'IN_BUDGET',
    isAllowed: true,
    itemPrice,
    softLimit,
    hardLimit,
    budgetMin,
    message: `🟢 Within $${softLimit.toFixed(2)} target budget.`,
    badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  };
}

/**
 * Evaluates whether an operative's wishlist qualifies them for inclusion in the Sattolo draw.
 */
export function evaluateDrawEligibility(
  items: ManifestItemInput[],
  budgetMax: number,
  budgetHardLimit?: number,
  isWhiteElephant = false
): DrawEligibilityResult {
  const totalItems = items.length;

  // White Elephant: Must have exactly 1 item
  if (isWhiteElephant) {
    if (totalItems === 0) {
      return {
        isEligible: false,
        totalItems: 0,
        validItemsCount: 0,
        breachingItemsCount: 0,
        statusLabel: 'INELIGIBLE (0 Items in Pool)',
        statusColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        bannerMessage: '⚠️ DRAW INELIGIBILITY: You must register 1 gift in the Yankee Swap pool to participate in the exchange.',
      };
    }
    if (totalItems > 1) {
      return {
        isEligible: false,
        totalItems,
        validItemsCount: 1,
        breachingItemsCount: totalItems - 1,
        statusLabel: 'LIMIT EXCEEDED (Max 1 Gift)',
        statusColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        bannerMessage: '🚫 POOL OVERFLOW: White Elephant is strictly limited to 1 brought gift item per operative.',
      };
    }
    return {
      isEligible: true,
      totalItems: 1,
      validItemsCount: 1,
      breachingItemsCount: 0,
      statusLabel: 'MISSION READY (1 Gift in Pool)',
      statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      bannerMessage: '✓ MISSION READY: Your gift is registered in the Yankee Swap pool. You are cleared for the event!',
    };
  }

  // Secret Santa: Must have at least 1 valid item not breaching the hard cap
  let validItemsCount = 0;
  let breachingItemsCount = 0;

  for (const item of items) {
    const val = validateItemBudget(item.price, budgetMax, budgetHardLimit);
    if (val.isAllowed) {
      validItemsCount++;
    } else {
      breachingItemsCount++;
    }
  }

  if (totalItems === 0) {
    return {
      isEligible: false,
      totalItems: 0,
      validItemsCount: 0,
      breachingItemsCount: 0,
      statusLabel: 'INELIGIBLE (0 Items on List)',
      statusColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      bannerMessage: '⚠️ DRAW INELIGIBILITY WARNING: Your wishlist is empty. You must add at least 1 item before the Target Draw or you will be excluded!',
    };
  }

  if (validItemsCount === 0 && breachingItemsCount > 0) {
    return {
      isEligible: false,
      totalItems,
      validItemsCount: 0,
      breachingItemsCount,
      statusLabel: 'INELIGIBLE (All Items Exceed Cap)',
      statusColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      bannerMessage: `🚫 OVERWISHING ALERT: All items exceed the $${budgetHardLimit?.toFixed(2)} hard cap. Add at least 1 compliant item to qualify for the draw.`,
    };
  }

  return {
    isEligible: true,
    totalItems,
    validItemsCount,
    breachingItemsCount,
    statusLabel: `MISSION READY (${validItemsCount} Valid Items)`,
    statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    bannerMessage: `✓ MISSION READY: Your wishlist is valid. You are registered and will be included in the Target Draw!`,
  };
}

/**
 * Calculates the buyer's claimed cart spend total against the soft budget target.
 */
export function calculateClaimedBasketTotal(
  items: ManifestItemInput[],
  budgetMax: number
): {
  claimedTotal: number;
  remainingBudget: number;
  claimedCount: number;
  isSoftBudgetMet: boolean;
  statusText: string;
} {
  const claimedItems = items.filter((i) => i.isClaimed);
  const claimedTotal = claimedItems.reduce((acc, item) => acc + (item.price || 0), 0);
  const remainingBudget = Math.max(0, budgetMax - claimedTotal);
  const isSoftBudgetMet = claimedTotal >= budgetMax;

  let statusText = `Shopping in progress (${claimedItems.length} items claimed)`;
  if (claimedItems.length === 0) {
    statusText = 'No items claimed yet. Browse ideas below!';
  } else if (isSoftBudgetMet) {
    statusText = `🎉 Target spend of $${budgetMax.toFixed(2)} reached! ($${claimedTotal.toFixed(2)} total)`;
  } else {
    statusText = `$${claimedTotal.toFixed(2)} claimed / $${budgetMax.toFixed(2)} target ($${remainingBudget.toFixed(2)} remaining)`;
  }

  return {
    claimedTotal: Math.round(claimedTotal * 100) / 100,
    remainingBudget: Math.round(remainingBudget * 100) / 100,
    claimedCount: claimedItems.length,
    isSoftBudgetMet,
    statusText,
  };
}
