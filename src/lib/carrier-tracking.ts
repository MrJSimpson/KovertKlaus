/**
 * Multi-Carrier Tracking Number Recognition & Deep-Linking Engine
 * 
 * Supports real-time deterministic format recognition for:
 * - USPS (United States Postal Service)
 * - UPS (United Parcel Service)
 * - FedEx (Federal Express)
 * - DHL (DHL Express)
 * - Other (Generic / regional courier fallback >= 8 chars)
 */

export type CarrierType = 'USPS' | 'UPS' | 'FEDEX' | 'DHL' | 'OTHER' | 'UNKNOWN';

export interface CarrierDetectionResult {
  carrier: CarrierType;
  carrierName: string;
  normalizedTracking: string;
  trackingUrl: string | null;
  isValid: boolean;
  badgeLabel: string;
  badgeColor: {
    bg: string;
    border: string;
    text: string;
  };
}

/**
 * Normalizes a tracking number by trimming whitespace and removing formatting hyphens/spaces.
 */
export function normalizeTrackingNumber(rawTracking: string | null | undefined): string {
  if (!rawTracking) return '';
  return rawTracking.trim().replace(/[\s-]+/g, '').toUpperCase();
}

/**
 * Validates whether a tracking number matches acceptable carrier standards.
 * Minimum 8 alphanumeric characters.
 */
export function isCarrierTrackingValid(rawTracking: string | null | undefined): boolean {
  const normalized = normalizeTrackingNumber(rawTracking);
  return normalized.length >= 8 && /^[A-Z0-9]+$/.test(normalized);
}

/**
 * Generates an official external tracking URL for a given carrier.
 */
export function getCarrierTrackingUrl(carrier: CarrierType, normalizedTracking: string): string | null {
  if (!normalizedTracking) return null;

  switch (carrier) {
    case 'USPS':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(normalizedTracking)}`;
    case 'UPS':
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(normalizedTracking)}`;
    case 'FEDEX':
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(normalizedTracking)}`;
    case 'DHL':
      return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(normalizedTracking)}`;
    case 'OTHER':
      return `https://www.google.com/search?q=tracking+${encodeURIComponent(normalizedTracking)}`;
    case 'UNKNOWN':
    default:
      return null;
  }
}

/**
 * Detects the carrier from a tracking number using deterministic pattern matching.
 */
export function detectCarrier(rawTracking: string | null | undefined): CarrierDetectionResult {
  const normalized = normalizeTrackingNumber(rawTracking);

  if (!normalized || normalized.length < 8 || !/^[A-Z0-9]+$/.test(normalized)) {
    return {
      carrier: 'UNKNOWN',
      carrierName: 'Unknown Carrier',
      normalizedTracking: normalized,
      trackingUrl: null,
      isValid: false,
      badgeLabel: 'Invalid Tracking',
      badgeColor: {
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        text: 'text-rose-400',
      },
    };
  }

  // 1. UPS: 1Z followed by 16 alphanumeric characters (18 total), or T followed by 10 digits
  if (/^1Z[A-Z0-9]{16}$/i.test(normalized) || /^T\d{10}$/i.test(normalized)) {
    return {
      carrier: 'UPS',
      carrierName: 'United Parcel Service (UPS)',
      normalizedTracking: normalized,
      trackingUrl: getCarrierTrackingUrl('UPS', normalized),
      isValid: true,
      badgeLabel: 'UPS',
      badgeColor: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
      },
    };
  }

  // 2. USPS:
  // - 20 to 22 digits starting with 91, 92, 93, 94, 95
  // - 20 digits starting with 82
  // - 13 characters: 2 letters, 9 digits, ending in "US" (e.g. EA123456789US)
  if (
    /^(9[1-5]\d{18,20}|82\d{18})$/.test(normalized) ||
    /^[A-Z]{2}\d{9}US$/i.test(normalized) ||
    /^(7\d{19}|03\d{18})$/.test(normalized)
  ) {
    return {
      carrier: 'USPS',
      carrierName: 'United States Postal Service (USPS)',
      normalizedTracking: normalized,
      trackingUrl: getCarrierTrackingUrl('USPS', normalized),
      isValid: true,
      badgeLabel: 'USPS',
      badgeColor: {
        bg: 'bg-sky-500/10',
        border: 'border-sky-500/30',
        text: 'text-sky-400',
      },
    };
  }

  // 3. FedEx:
  // - 12 digits (FedEx Express)
  // - 15 digits (FedEx Ground)
  // - 20 or 22 digits starting with 96
  // - Door tag: DT + 12 digits
  if (
    /^\d{12}$/.test(normalized) ||
    /^\d{15}$/.test(normalized) ||
    /^96\d{18,20}$/.test(normalized) ||
    /^DT\d{12}$/i.test(normalized)
  ) {
    return {
      carrier: 'FEDEX',
      carrierName: 'Federal Express (FedEx)',
      normalizedTracking: normalized,
      trackingUrl: getCarrierTrackingUrl('FEDEX', normalized),
      isValid: true,
      badgeLabel: 'FedEx',
      badgeColor: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
      },
    };
  }

  // 4. DHL:
  // - 10 or 11 digits
  // - JJD + 18 digits or JVGL + 18 digits
  if (
    /^\d{10,11}$/.test(normalized) ||
    /^(JJD|JVGL)\d{18}$/i.test(normalized)
  ) {
    return {
      carrier: 'DHL',
      carrierName: 'DHL Express',
      normalizedTracking: normalized,
      trackingUrl: getCarrierTrackingUrl('DHL', normalized),
      isValid: true,
      badgeLabel: 'DHL',
      badgeColor: {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        text: 'text-yellow-400',
      },
    };
  }

  // 5. Generic / Regional courier fallback (valid tracking >= 8 chars)
  return {
    carrier: 'OTHER',
    carrierName: 'Regional / Other Courier',
    normalizedTracking: normalized,
    trackingUrl: getCarrierTrackingUrl('OTHER', normalized),
    isValid: true,
    badgeLabel: 'Carrier Parcel',
    badgeColor: {
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30',
      text: 'text-slate-300',
    },
  };
}
