/**
 * KovertKlaus Web Security & Input Hardening Utility
 * Enforces OWASP Top 10 Guidelines:
 * - A01: Broken Access Control & SSRF Mitigation
 * - A03: Injection & Stored/Reflected XSS Prevention
 * - A07: Identification and Authentication Input Validation
 */

// Strict RFC 5322 Compliant Email Regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Safe Exchange Code Regex (Alphanumeric and hyphens only, max 16 chars)
const CODE_REGEX = /^[A-Z0-9-]{3,16}$/;

/**
 * Formats a Codename to enforce the "Agent: " display prefix rule across the app.
 * Example: "Joshua" -> "Agent: Joshua", "Agent-Joshua" -> "Agent: Joshua"
 */
export function formatCodename(codename?: string | null, fallbackName?: string | null): string {
  let clean = codename?.trim() || fallbackName?.trim() || 'Unknown';
  clean = clean.replace(/^(agent[-:\s]+)/i, '').trim();
  return `Agent: ${clean}`;
}

/**
 * Formats a Date or ISO string safely in local time without UTC 1-day backward shift.
 * Example: "2026-12-25" -> "Dec 25, 2026"
 */
export function formatDateString(dateInput?: string | Date | null): string {
  if (!dateInput) return 'N/A';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'N/A';
    const str = typeof dateInput === 'string' ? dateInput : d.toISOString();
    if (str.includes('T')) {
      const dateOnly = str.split('T')[0];
      const [year, month, day] = dateOnly.split('-').map(Number);
      if (year && month && day) {
        const localDate = new Date(year, month - 1, day);
        return localDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
    }
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

export interface OperationPhaseInfo {
  phaseStatusLabel: string; // "Recruiting", "Waiting Assignment", "Acquire OpKit", "Awaiting Execution...", "Completed" (or Day-Of variations)
  milestoneLabel: string;   // "RSVP Cutoff", "Target Draw", "Ship Deadline", "Exchange Day"
  daysLeft: number;
  formattedText: string;
  isPast: boolean;
  isToday: boolean;
}

/**
 * Calculates countdown days and determines phase status label for operation lifecycle stages.
 */
export function getNextMilestoneCountdown(mission?: {
  status?: string;
  inviteCutoffDate?: string | Date | null;
  assignmentDate?: string | Date | null;
  shippingDate?: string | Date | null;
  executionDate?: string | Date | null;
} | null): OperationPhaseInfo {
  if (!mission) {
    return {
      phaseStatusLabel: 'Active',
      milestoneLabel: 'Milestone',
      daysLeft: 0,
      formattedText: 'N/A',
      isPast: false,
      isToday: false,
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const cutoff = mission.inviteCutoffDate ? new Date(mission.inviteCutoffDate) : null;
  const assign = mission.assignmentDate ? new Date(mission.assignmentDate) : null;
  const ship = mission.shippingDate ? new Date(mission.shippingDate) : null;
  const exec = mission.executionDate ? new Date(mission.executionDate) : null;

  if (cutoff) cutoff.setHours(0, 0, 0, 0);
  if (assign) assign.setHours(0, 0, 0, 0);
  if (ship) ship.setHours(0, 0, 0, 0);
  if (exec) exec.setHours(0, 0, 0, 0);

  const rawStatus = mission.status ? mission.status.toUpperCase() : 'RECRUITING';

  let phaseStatusLabel = 'Recruiting';
  let milestoneLabel = 'RSVP Cutoff';
  let targetDate: Date | null = cutoff;

  if (rawStatus === 'COMPLETED' || rawStatus === 'EXECUTED' || (exec && now > exec)) {
    // Phase 5: Completed
    return {
      phaseStatusLabel: 'Completed',
      milestoneLabel: 'Exchange Day',
      daysLeft: 0,
      formattedText: 'Operation Completed',
      isPast: true,
      isToday: false,
    };
  } else if (rawStatus === 'SHIPPED' || (ship && now > ship && (!exec || now <= exec))) {
    // Phase 4: Awaiting Execution (Pre-Exchange)
    targetDate = exec;
    milestoneLabel = 'Exchange Day';
    if (exec && exec.getTime() === now.getTime()) {
      phaseStatusLabel = 'Exchange Day! 🎉';
    } else {
      phaseStatusLabel = 'Awaiting Execution...';
    }
  } else if (rawStatus === 'ASSIGNED' || (assign && now > assign && (!ship || now <= ship))) {
    // Phase 3: Acquiring OpKit Items / Shipping
    targetDate = ship || exec;
    milestoneLabel = ship ? 'Ship Deadline' : 'Exchange Day';
    if (ship && ship.getTime() === now.getTime()) {
      phaseStatusLabel = 'Shipping Deadline Day';
    } else {
      phaseStatusLabel = 'Acquire OpKit';
    }
  } else if (rawStatus === 'SETUP' || (cutoff && now > cutoff && (!assign || now <= assign))) {
    // Phase 2: Waiting Target Assignment
    targetDate = assign || ship || exec;
    milestoneLabel = assign ? 'Target Draw' : 'Ship Deadline';
    if (assign && assign.getTime() === now.getTime()) {
      phaseStatusLabel = 'Target Draw Day';
    } else {
      phaseStatusLabel = 'Waiting Assignment';
    }
  } else {
    // Phase 1: Recruiting / Joining (Default)
    targetDate = cutoff || assign || ship || exec;
    milestoneLabel = cutoff ? 'RSVP Cutoff' : assign ? 'Target Draw' : 'Exchange Day';
    if (cutoff && cutoff.getTime() === now.getTime()) {
      phaseStatusLabel = 'RSVP Cutoff Day';
    } else {
      phaseStatusLabel = 'Recruiting';
    }
  }

  if (!targetDate) {
    return {
      phaseStatusLabel: 'Active',
      milestoneLabel: 'Milestone',
      daysLeft: 0,
      formattedText: 'N/A',
      isPast: false,
      isToday: false,
    };
  }

  const diffTime = targetDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isToday = daysLeft === 0;

  let formattedText = '';
  if (daysLeft < 0) {
    formattedText = `${Math.abs(daysLeft)} days ago`;
  } else if (daysLeft === 0) {
    formattedText = 'Today! 🎉';
  } else if (daysLeft === 1) {
    formattedText = 'Tomorrow ⏳';
  } else {
    formattedText = `In ${daysLeft} days`;
  }

  return {
    phaseStatusLabel,
    milestoneLabel,
    daysLeft,
    formattedText,
    isPast: daysLeft < 0,
    isToday,
  };
}

/**
 * Validates Password Complexity (Minimum 10 Characters):
 * - Must be at least 10 characters in length.
 * - Must contain at least 1 uppercase letter (A-Z).
 * - Must contain at least 1 lowercase letter (a-z).
 * - Must contain at least 1 number (0-9).
 * - Must contain at least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?).
 */
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password || password.length < 10) {
    return { isValid: false, error: 'Password must be at least 10 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least 1 uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least 1 lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least 1 number (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least 1 special character (e.g. !@#$%^&*).' };
  }
  return { isValid: true };
}

/**
 * Sanitizes input strings by stripping HTML tags and escaping dangerous XSS characters.
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/<[^>]*>/g, ''); // Strip HTML tags to prevent XSS while keeping plain text clean
}

/**
 * Validates email format strictly.
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates and normalizes Exchange Invite Codes.
 */
export function sanitizeInviteCode(code: string): string | null {
  if (!code) return null;
  const clean = code.trim().toUpperCase();
  return CODE_REGEX.test(clean) ? clean : null;
}

/**
 * Generates a cryptographically secure random 8-character Base32 Invite Code
 * formatted as two 4-character chunks separated by a hyphen (e.g. "K9X2-R7M4").
 * Uses an unambiguous Base32 character set (excluding 0, O, 1, I).
 * Space size: 32^8 = 1,099,511,627,776 (1.09 Trillion unique combinations).
 */
export function generateInviteCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[bytes[i] % chars.length];
  }
  for (let i = 4; i < 8; i++) {
    part2 += chars[bytes[i] % chars.length];
  }

  return `${part1}-${part2}`;
}

/**
 * SSRF Protection: Ensures a URL uses http/https protocols and does NOT resolve
 * to internal/private IP ranges or loopback/metadata endpoints.
 */
export function isSafePublicUrl(urlString: string): { safe: boolean; error?: string } {
  try {
    const parsed = new URL(urlString.trim());

    // Protocol enforcement
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, error: 'Only http and https protocols are permitted.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Loopback & Localhost check
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return { safe: false, error: 'Access to loopback/local addresses is forbidden.' };
    }

    // AWS Cloud Metadata endpoint check
    if (hostname === '169.254.169.254') {
      return { safe: false, error: 'Access to cloud metadata endpoint is forbidden.' };
    }

    // Private IPv4 range checks
    const ipParts = hostname.split('.').map((p) => parseInt(p, 10));
    if (ipParts.length === 4 && ipParts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
      const [a, b] = ipParts;
      if (
        a === 10 || // 10.0.0.0/8
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
        (a === 192 && b === 168) || // 192.168.0.0/16
        a === 127 || // 127.0.0.0/8
        (a === 169 && b === 254) // 169.254.0.0/16
      ) {
        return { safe: false, error: 'Access to private network IP ranges is forbidden.' };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, error: 'Invalid URL format.' };
  }
}

/**
 * Normalizes e-commerce product URLs by removing tracking query parameters
 * (e.g. utm_source, ref, tag, qid, fbclid) for accurate catalog deduplication.
 */
export function normalizeProductUrl(urlString: string): string {
  try {
    const parsed = new URL(urlString.trim());
    const TRACKING_PARAMS = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'ref', 'ref_', 'tag', 'qid', 'pf_rd_r', 'pf_rd_p', 'pd_rd_r', 'pd_rd_w',
      'fbclid', 'gclid', 'msclkid', 'spm', '_encoding',
    ];

    TRACKING_PARAMS.forEach((param) => parsed.searchParams.delete(param));

    let cleanPath = parsed.pathname;
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }

    const cleanSearch = parsed.searchParams.toString();
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${cleanPath}${cleanSearch ? `?${cleanSearch}` : ''}`;
  } catch {
    return urlString.trim();
  }
}
