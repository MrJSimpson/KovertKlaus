import crypto from 'crypto';

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
 * Fallback HMAC session secret for development when SESSION_SECRET is unset.
 */
const DEFAULT_SESSION_SECRET = 'kovertklaus-session-hmac-secret-vault-do-not-use-in-production-min32chars';

/**
 * Retrieves the cryptographic secret used for HMAC token signing and verification.
 */
export function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || DEFAULT_SESSION_SECRET;
}

/**
 * Creates a cryptographically signed HMAC-SHA256 token payload.
 * Output format: `<payload>.<base64url_signature>`
 *
 * @param data - The raw identifier or payload (e.g. userId or adminId)
 * @param secret - The signing secret (defaults to getSessionSecret())
 * @returns The signed token string
 */
export function signToken(data: string, secret = getSessionSecret()): string {
  if (!data) return '';
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed token using constant-time comparison.
 *
 * @param token - The signed token string (<payload>.<signature>)
 * @param secret - The signing secret (defaults to getSessionSecret())
 * @returns The verified payload string, or `null` if verification fails or token is tampered.
 */
export function verifyToken(token: string | null | undefined, secret = getSessionSecret()): string | null {
  if (!token || typeof token !== 'string') return null;
  const lastDotIndex = token.lastIndexOf('.');
  if (lastDotIndex === -1) return null;

  const data = token.substring(0, lastDotIndex);
  const signature = token.substring(lastDotIndex + 1);

  if (!data || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expectedBuf.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  return data;
}

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
 * Returns a cryptographically secure, uniformly distributed random integer
 * in the half-open interval [0, maxExclusive) using rejection sampling to eliminate modulo bias.
 *
 * @param maxExclusive - Upper bound (exclusive). Must be > 0.
 * @returns An integer n where 0 <= n < maxExclusive.
 */
export function getSecureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const range = maxExclusive;
  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % range);
  const buffer = new Uint32Array(1);

  let randomVal: number;
  do {
    crypto.getRandomValues(buffer);
    randomVal = buffer[0];
  } while (randomVal >= limit);

  return randomVal % range;
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
  crypto.getRandomValues(bytes);

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
 * to internal/private IP ranges, loopback/metadata endpoints, or DNS rebinding wildcards.
 */
export function isSafePublicUrl(urlString: string): { safe: boolean; error?: string } {
  try {
    const trimmed = (urlString || '').trim();
    if (!trimmed) {
      return { safe: false, error: 'URL cannot be empty.' };
    }

    const parsed = new URL(trimmed);

    // Protocol enforcement: Only http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, error: 'Only http and https protocols are permitted.' };
    }

    // Reject userinfo in URL (e.g. http://user:pass@host)
    if (parsed.username || parsed.password) {
      return { safe: false, error: 'URLs containing embedded credentials are forbidden.' };
    }

    const rawHostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Loopback & Localhost checks
    if (
      rawHostname === 'localhost' ||
      rawHostname === '127.0.0.1' ||
      rawHostname === '::1' ||
      rawHostname === '0.0.0.0' ||
      rawHostname.endsWith('.local') ||
      rawHostname.endsWith('.internal') ||
      rawHostname.endsWith('.localhost') ||
      rawHostname.endsWith('.lan')
    ) {
      return { safe: false, error: 'Access to loopback/local addresses is forbidden.' };
    }

    // DNS Rebinding and wildcard service check
    const rebindPatterns = [
      /(^|\.)nip\.io$/,
      /(^|\.)sslip\.io$/,
      /(^|\.)xip\.io$/,
      /(^|\.)localtest\.me$/,
      /(^|\.)vcap\.me$/,
      /(^|\.)burpcollaborator\.net$/,
      /(^|\.)oastify\.com$/,
      /\.127\.0\.0\.1(\.|$)/,
      /\.169\.254(\.|$)/,
    ];
    if (rebindPatterns.some((pattern) => pattern.test(rawHostname))) {
      return { safe: false, error: 'Access to dynamic DNS/rebinding domains is forbidden.' };
    }

    // AWS / Cloud Metadata endpoint checks
    if (rawHostname === '169.254.169.254' || rawHostname === 'instance-data' || rawHostname === 'fd00:ec2::254') {
      return { safe: false, error: 'Access to cloud metadata endpoint is forbidden.' };
    }

    // IPv6 Private & Local checks
    if (
      rawHostname.startsWith('fc') ||
      rawHostname.startsWith('fd') ||
      rawHostname.startsWith('fe80') ||
      rawHostname === '::' ||
      rawHostname.startsWith('::ffff:127.') ||
      rawHostname.startsWith('::ffff:10.') ||
      rawHostname.startsWith('::ffff:192.168.')
    ) {
      return { safe: false, error: 'Access to private IPv6 addresses is forbidden.' };
    }

    // Check if hostname is an integer representation of an IP (e.g. 2130706433 = 127.0.0.1)
    if (/^\d+$/.test(rawHostname)) {
      return { safe: false, error: 'Numeric integer IP addresses are forbidden.' };
    }

    // Check if hostname is hexadecimal or octal IP format (e.g. 0x7f000001 or 017700000001)
    if (/^0x[0-9a-f]+$/i.test(rawHostname) || /^0[0-7]+$/.test(rawHostname)) {
      return { safe: false, error: 'Hexadecimal or octal IP addresses are forbidden.' };
    }

    // Standard IPv4 dotted-decimal range check
    const ipParts = rawHostname.split('.').map((p) => parseInt(p, 10));
    if (ipParts.length === 4 && ipParts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
      const [a, b] = ipParts;
      if (
        a === 0 ||                           // 0.0.0.0/8 (Current network)
        a === 10 ||                          // 10.0.0.0/8 (Private network)
        a === 127 ||                         // 127.0.0.0/8 (Loopback)
        a === 169 && b === 254 ||            // 169.254.0.0/16 (Link-local / Cloud metadata)
        a === 172 && b >= 16 && b <= 31 ||   // 172.16.0.0/12 (Private network)
        a === 192 && b === 168 ||            // 192.168.0.0/16 (Private network)
        a === 100 && b >= 64 && b <= 127 ||  // 100.64.0.0/10 (Carrier-grade NAT)
        a === 198 && (b === 18 || b === 19) // 198.18.0.0/15 (Benchmarking)
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
