/**
 * @file auth-flow.ts
 * @description URL rules for the public entry pages: Home, Sign in, Create account and join by code.
 *
 * Tier 1 (what): `readAuthParams` reads `?code`, `?email`, `?invite`, `?next` from the address;
 * `afterAuthPath` says where to go once signed in; `formatMissionCode` / `missionCodePath` turn a
 * typed code into `/exchange/XXXX-XXXX`.
 * Tier 2 (why): The visual refresh (2.0.0-beta) gives Sign in and Create account their own page
 * (owner decision 2026-11-18), so the landing no longer holds the forms. Invitation and approval
 * emails still link to `/register?code=…&email=…[&invite=…]` and must keep working; "Start a mission"
 * sends visitors through sign-up to the create dialog.
 * Tier 3 (how): Pure. `next` is an allowlisted key, never a URL, so it cannot redirect anywhere else.
 */

/** Where a visitor goes after signing in, keyed by `?next=`. Anything else goes to the dashboard. */
export const AFTER_AUTH_PATHS = {
  start: '/dashboard?start=1',
  join: '/dashboard?join=1',
} as const;

export type AfterAuthKey = keyof typeof AFTER_AUTH_PATHS;

export interface AuthParams {
  /** Mission code from an invitation (`/register?code=`), or an alpha activation code. Uppercased. */
  code: string | null;
  /** Pre-filled email from an invitation or approval email. */
  email: string | null;
  /** Signed per-invitation token (`?invite=`): joins without Head Elf approval. */
  invite: string | null;
  /** Allowlisted destination after sign-in, or `null` for the dashboard. */
  next: AfterAuthKey | null;
}

/**
 * Reads the entry page's query string.
 *
 * @param search - `window.location.search` (with or without the leading `?`)
 * @returns Trimmed values; empty values become `null`
 */
export function readAuthParams(search: string): AuthParams {
  const p = new URLSearchParams(search);
  const text = (k: string) => {
    const v = p.get(k)?.trim();
    return v ? v : null;
  };
  const code = text('code') ?? text('alphaCode');
  const next = text('next');
  return {
    code: code ? code.toUpperCase() : null,
    email: text('email'),
    invite: text('invite'),
    next: next && Object.prototype.hasOwnProperty.call(AFTER_AUTH_PATHS, next) ? (next as AfterAuthKey) : null,
  };
}

/** The page to open after a successful sign-in or sign-up. */
export function afterAuthPath(next: AfterAuthKey | null): string {
  return next ? AFTER_AUTH_PATHS[next] : '/dashboard';
}

/**
 * Formats typed text as a mission code while the visitor types: letters and digits only,
 * uppercased, at most 8, with a dash after the fourth (`ab12cd34` → `AB12-CD34`).
 */
export function formatMissionCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/**
 * The mission page for a typed code, or `null` until the code is complete (8 characters).
 * The mission page shows the preview and handles sign-in and the join request.
 */
export function missionCodePath(raw: string): string | null {
  const code = formatMissionCode(raw);
  return code.replace('-', '').length === 8 ? `/exchange/${code}` : null;
}
