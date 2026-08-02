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
 * Formats a Codename to strictly enforce the "Agent-" prefix rule across the app.
 * Example: "Alex" -> "Agent-Alex", "Agent-9867" -> "Agent-9867"
 */
export function formatCodename(codename?: string | null, fallbackName?: string | null): string {
  if (!codename || !codename.trim()) {
    if (fallbackName && fallbackName.trim()) {
      const cleanFallback = fallbackName.trim();
      return cleanFallback.toLowerCase().startsWith('agent-')
        ? cleanFallback
        : `Agent-${cleanFallback}`;
    }
    return 'Agent-Unknown';
  }
  const clean = codename.trim();
  return clean.toLowerCase().startsWith('agent-') ? clean : `Agent-${clean}`;
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

/**
 * Calculates countdown days to the next upcoming milestone in an operation lifecycle.
 */
export function getNextMilestoneCountdown(mission?: {
  status?: string;
  inviteCutoffDate?: string | Date | null;
  assignmentDate?: string | Date | null;
  shippingDate?: string | Date | null;
  executionDate?: string | Date | null;
} | null): { label: string; daysLeft: number; formattedText: string; isPast: boolean } {
  if (!mission) {
    return { label: 'Milestone', daysLeft: 0, formattedText: 'N/A', isPast: false };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let targetDate: Date | null = null;
  let label = 'Next Milestone';

  const cutoff = mission.inviteCutoffDate ? new Date(mission.inviteCutoffDate) : null;
  const assign = mission.assignmentDate ? new Date(mission.assignmentDate) : null;
  const ship = mission.shippingDate ? new Date(mission.shippingDate) : null;
  const exec = mission.executionDate ? new Date(mission.executionDate) : null;

  if (cutoff && cutoff > now && mission.status === 'RECRUITING') {
    label = 'RSVP Cutoff';
    targetDate = cutoff;
  } else if (assign && assign > now && (mission.status === 'RECRUITING' || mission.status === 'SETUP')) {
    label = 'Target Draw';
    targetDate = assign;
  } else if (ship && ship > now && mission.status === 'ASSIGNED') {
    label = 'Ship Deadline';
    targetDate = ship;
  } else if (exec && exec > now) {
    label = 'Exchange Day';
    targetDate = exec;
  } else if (exec) {
    label = 'Execution';
    targetDate = exec;
  }

  if (!targetDate) {
    return { label: 'Complete', daysLeft: 0, formattedText: 'Completed', isPast: true };
  }

  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { label, daysLeft, formattedText: `${Math.abs(daysLeft)} days ago`, isPast: true };
  } else if (daysLeft === 0) {
    return { label, daysLeft: 0, formattedText: 'Today! 🎉', isPast: false };
  } else if (daysLeft === 1) {
    return { label, daysLeft: 1, formattedText: 'Tomorrow ⏳', isPast: false };
  } else {
    return { label, daysLeft, formattedText: `In ${daysLeft} days`, isPast: false };
  }
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
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
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
