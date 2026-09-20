/**
 * Product Intelligence Engine
 * 
 * Provides:
 * 1. Category Detection from product titles, domains, and descriptions.
 * 2. Standardized variable schema generation (up to 3-4 fields per item).
 * 3. Dossier preference matching from user profile (sizes, colors, measurements).
 * 4. Crowdsourced Top-K frequency ranking for ProductCatalog options.
 */

export type ProductCategory =
  | 'APPAREL_TOPS'
  | 'APPAREL_BOTTOMS'
  | 'FOOTWEAR'
  | 'ELECTRONICS'
  | 'BOOKS_GAMES'
  | 'GENERAL';

export interface ItemDetail {
  label: string;
  value: string;
  [key: string]: string;
}

export interface PopularOption {
  val: string;
  count: number;
}

export interface CatalogProperties {
  category: ProductCategory;
  variables: string[];
  popularOptions?: Record<string, PopularOption[]>;
}

export interface UserDossierPreferences {
  topHalfSize?: string | null;
  shirtSize?: string | null;
  bottomHalfSize?: string | null;
  shoeSize?: string | null;
  waistMeasurement?: string | null;
  inseamMeasurement?: string | null;
  favoriteColors?: string | null;
  allergiesDiet?: string | null;
  favoriteHobbies?: string | null;
}

// Category keyword matching rules
const CATEGORY_PATTERNS: Array<{ category: ProductCategory; regex: RegExp }> = [
  {
    category: 'FOOTWEAR',
    regex: /\b(shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|loafer|loafers|cleat|cleats|footwear|slippers|running shoes)\b/i,
  },
  {
    category: 'APPAREL_BOTTOMS',
    regex: /\b(pants|jeans|shorts|trousers|leggings|joggers|sweatpants|skirt|slacks|cargo pants|boxers|briefs)\b/i,
  },
  {
    category: 'APPAREL_TOPS',
    regex: /\b(shirt|t-shirt|tee|t-shirts|hoodie|hoodies|sweater|sweaters|sweatshirt|jacket|jackets|coat|coats|top|jersey|cardigan|vest|pullover|flannel|polo)\b/i,
  },
  {
    category: 'ELECTRONICS',
    regex: /\b(phone|smartphone|laptop|tablet|ipad|headphone|headphones|earbuds|smartwatch|watch|monitor|keyboard|mouse|charger|gadget|camera|speaker|console|controller)\b/i,
  },
  {
    category: 'BOOKS_GAMES',
    regex: /\b(book|books|hardcover|paperback|novel|comic|manga|board game|puzzle|card game|nintendo|playstation|xbox|video game|rpg|d&d)\b/i,
  },
];

/**
 * Detects the product category based on product title, merchant domain, and description text.
 */
export function detectProductCategory(title: string, domain = '', description = ''): ProductCategory {
  const combined = `${title} ${domain} ${description}`.toLowerCase();

  for (const { category, regex } of CATEGORY_PATTERNS) {
    if (regex.test(combined)) {
      return category;
    }
  }

  return 'GENERAL';
}

/**
 * Returns the recommended 3-4 variable labels for a detected product category.
 */
export function getCategorySuggestedKeys(category: ProductCategory): string[] {
  switch (category) {
    case 'APPAREL_TOPS':
      return ['Size', 'Color', 'Style', 'Notes for Santa'];
    case 'APPAREL_BOTTOMS':
      return ['Size / Waist', 'Color', 'Inseam / Fit', 'Notes for Santa'];
    case 'FOOTWEAR':
      return ['Shoe Size', 'Color', 'Width', 'Notes for Santa'];
    case 'ELECTRONICS':
      return ['Model / Spec', 'Color', 'Storage / Memory', 'Notes for Santa'];
    case 'BOOKS_GAMES':
      return ['Edition / Format', 'Platform / Language', 'Notes for Santa'];
    case 'GENERAL':
    default:
      return ['Size / Spec', 'Color / Style', 'Variant', 'Notes for Santa'];
  }
}

/**
 * Matches an operative's saved profile dossier to suggested variable keys.
 * Returns suggested values for each variable label (e.g. { "Size": ["L"], "Color": ["Navy Blue", "Forest Green"] }).
 */
export function matchDossierToVariables(
  variables: string[],
  dossier: UserDossierPreferences
): Record<string, string[]> {
  const suggestions: Record<string, string[]> = {};

  const topSize = dossier.topHalfSize || dossier.shirtSize;
  const bottomSize = dossier.bottomHalfSize || dossier.waistMeasurement;
  const shoeSize = dossier.shoeSize;

  // Split favorite colors into individual color chips if comma or slash separated
  const rawColors = dossier.favoriteColors || '';
  const colorList = rawColors
    .split(/[,/&;]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const varName of variables) {
    const lower = varName.toLowerCase();

    if (lower.includes('shoe size') && shoeSize) {
      suggestions[varName] = [shoeSize.trim()];
    } else if ((lower === 'size' || lower.includes('top')) && topSize) {
      suggestions[varName] = [topSize.trim()];
    } else if ((lower.includes('waist') || lower.includes('bottom')) && bottomSize) {
      suggestions[varName] = [bottomSize.trim()];
    } else if (lower.includes('color') && colorList.length > 0) {
      suggestions[varName] = colorList;
    }
  }

  return suggestions;
}

/**
 * Maximum number of detail fields stored per item.
 */
export const MAX_ITEM_DETAILS = 4;

/**
 * Maximum number of popular options retained per variable key in ProductCatalog.
 */
export const MAX_CATALOG_OPTIONS_PER_KEY = 5;

/**
 * Updates or merges crowdsourced attribute frequency counts in ProductCatalog.properties.
 * Uses an O(1) Top-K insertion algorithm, sorting descending and retaining at most 5 options per key.
 */
export function updateCatalogIntelligence(
  existingProps: any,
  newDetails: ItemDetail[],
  categoryHint?: ProductCategory
): CatalogProperties {
  const safeProps: CatalogProperties = {
    category: categoryHint || existingProps?.category || 'GENERAL',
    variables: Array.isArray(existingProps?.variables) && existingProps.variables.length > 0
      ? existingProps.variables
      : getCategorySuggestedKeys(categoryHint || 'GENERAL'),
    popularOptions: existingProps?.popularOptions && typeof existingProps.popularOptions === 'object'
      ? { ...existingProps.popularOptions }
      : {},
  };

  if (!Array.isArray(newDetails) || newDetails.length === 0) {
    return safeProps;
  }

  const popularMap = safeProps.popularOptions || {};

  for (const detail of newDetails.slice(0, MAX_ITEM_DETAILS)) {
    const label = detail.label?.trim();
    const value = detail.value?.trim();

    if (!label || !value) continue;
    // Don't aggregate generic free-form notes into community options
    if (label.toLowerCase().includes('note')) continue;

    // Ensure variable name is tracked in variables list (up to 4)
    if (!safeProps.variables.includes(label) && safeProps.variables.length < MAX_ITEM_DETAILS) {
      safeProps.variables.push(label);
    }

    const currentList: PopularOption[] = popularMap[label] ? [...popularMap[label]] : [];
    const existingIdx = currentList.findIndex((opt) => opt.val.toLowerCase() === value.toLowerCase());

    if (existingIdx >= 0) {
      currentList[existingIdx] = {
        val: currentList[existingIdx].val, // preserve original casing
        count: currentList[existingIdx].count + 1,
      };
    } else {
      currentList.push({
        val: value.substring(0, 50), // bound string length
        count: 1,
      });
    }

    // Sort descending by popularity count
    currentList.sort((a, b) => b.count - a.count);

    // Prune to Top-5 options to prevent unbounded growth
    popularMap[label] = currentList.slice(0, MAX_CATALOG_OPTIONS_PER_KEY);
  }

  safeProps.popularOptions = popularMap;
  return safeProps;
}

/**
 * Sanitizes and bounds an array of item details before persisting to Item.properties.
 */
export function sanitizeItemDetails(details: any[]): ItemDetail[] {
  if (!Array.isArray(details)) return [];

  return details
    .slice(0, MAX_ITEM_DETAILS)
    .map((d) => ({
      label: String(d.label || '').trim().substring(0, 40),
      value: String(d.value || '').trim().substring(0, 150),
    }))
    .filter((d) => d.label.length > 0 && d.value.length > 0);
}
