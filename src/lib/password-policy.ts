/**
 * @file password-policy.ts
 * @description The agent password rules every form and route shares (browser-safe: no Node imports).
 *
 * Tier 1 (what): `PASSWORD_MIN_LENGTH` / `PASSWORD_MAX_LENGTH`, `normalizePassword`, `passwordLength`
 * and `PASSWORD_CHECKLIST` (what the sign-up, reset and change-password forms show). The server-side
 * checks (common and breached passwords) live in `password-check.ts`.
 * Tier 2 (why): Owner decision (2026-11-01): follow NIST SP 800-63B except the length. The minimum stays
 * at 10 characters (NIST asks 15 without MFA) because longer is too much for some agents and the
 * data is low-risk; in exchange the composition rules (uppercase, number, symbol) are dropped, long
 * passphrases are allowed, and common and known-breached passwords are refused.
 * Tier 3 (how): Length counts Unicode code points after NFC normalization, so an accented letter
 * counts once however it was typed. 128 code points is plenty for a passphrase and caps hashing cost.
 */

/** Fewest characters an agent password may have (owner decision; NIST would say 15 without MFA). */
export const PASSWORD_MIN_LENGTH = 10;

/** Most characters allowed: long passphrases welcome, with a ceiling against hashing abuse. */
export const PASSWORD_MAX_LENGTH = 128;

/** The password as it is checked and hashed: NFC-normalized, nothing else changed (spaces kept). */
export function normalizePassword(password: string): string {
  return password.normalize('NFC');
}

/** Length in Unicode code points after normalization. */
export function passwordLength(password: string): number {
  return [...normalizePassword(password)].length;
}

/** One line of the live checklist under a password field. */
export interface PasswordChecklistItem {
  label: string;
  /** Checked as the agent types; `null` when it can only be checked on save (by the server). */
  test: ((password: string) => boolean) | null;
}

/** What the password forms show. */
export const PASSWORD_CHECKLIST: PasswordChecklistItem[] = [
  { label: `At least ${PASSWORD_MIN_LENGTH} characters (a short phrase works well)`, test: (p) => passwordLength(p) >= PASSWORD_MIN_LENGTH },
  { label: 'Not a common or leaked password (checked when you save)', test: null },
];
