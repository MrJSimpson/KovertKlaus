/**
 * KovertKlaus Dual Manifest & Budget Limit Validator
 * 
 * Implements the Anti-Overwishing Budget Architecture (+20% Hard Cap),
 * Decoupled Wishlist Cloning, and Pre-Draw Eligibility Verification.
 */

import { isSafePublicUrl, sanitizeText } from '../security';
import { sanitizeItemDetails, ItemDetail } from '../product-intelligence';

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

export interface SanitizedManifestItemPayload {
  name: string;
  url: string;
  price: number;
  description: string | null;
  thumbnailUrl: string | null;
  properties?: {
    isPersonalized?: boolean;
    details?: ItemDetail[];
    [key: string]: any;
  };
  isPersonalized: boolean;
}

/**
 * Validates, bounds, and sanitizes manifest item input across Next.js and Edge Worker.
 * Enforces text-only sanitization for personalized items (no URL required) and SSRF checks for URL items.
 */
export function validateAndSanitizeManifestItem(data: {
  title?: string;
  url?: string;
  description?: string;
  thumbnail?: string;
  price?: number | string;
  properties?: {
    isPersonalized?: boolean;
    details?: any[];
    [key: string]: any;
  };
}): { valid: true; data: SanitizedManifestItemPayload } | { valid: false; error: string } {
  const cleanUrl = typeof data.url === 'string' ? data.url.trim() : '';
  const isExplicitPersonalized = Boolean(data.properties?.isPersonalized);
  const isPersonalized = isExplicitPersonalized || cleanUrl.length === 0;

  if (cleanUrl.length > 0) {
    const urlCheck = isSafePublicUrl(cleanUrl);
    if (!urlCheck.safe) {
      return { valid: false, error: urlCheck.error || 'Invalid or forbidden URL' };
    }
  } else if (!isPersonalized) {
    return { valid: false, error: 'URL or personalized gift details are required' };
  }

  const rawTitle = data.title || '';
  const cleanTitle = sanitizeText(rawTitle).trim().substring(0, 100);
  if (!cleanTitle && isPersonalized) {
    return { valid: false, error: 'Item title is required for personalized gifts' };
  }

  const numPrice = Number(data.price);
  const cleanPrice = !isNaN(numPrice) ? Math.max(0, Math.min(Math.round(numPrice * 100) / 100, 100000)) : 0;
  const cleanDesc = data.description ? sanitizeText(data.description).trim().substring(0, 500) : null;
  const finalDesc = cleanDesc && cleanDesc.length > 0 ? cleanDesc : null;
  const cleanThumb = data.thumbnail && typeof data.thumbnail === 'string' ? data.thumbnail.trim() : null;
  const details = Array.isArray(data.properties?.details) ? sanitizeItemDetails(data.properties.details) : [];

  const itemProperties: Record<string, any> = {};
  if (isPersonalized) {
    itemProperties.isPersonalized = true;
  }
  if (details.length > 0) {
    itemProperties.details = details;
  }

  return {
    valid: true,
    data: {
      name: cleanTitle || 'Wished-for Item',
      url: cleanUrl,
      price: cleanPrice,
      description: finalDesc,
      thumbnailUrl: cleanThumb || null,
      properties: Object.keys(itemProperties).length > 0 ? itemProperties : undefined,
      isPersonalized,
    },
  };
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
