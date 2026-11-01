'use client';

/**
 * @file PasswordChecklist.tsx
 * @description The live password checklist shown under every new-password field.
 *
 * Tier 1 (what): Renders `PASSWORD_CHECKLIST` (src/lib/password-policy.ts): items checked as the agent
 * types get ✓/○; the common/leaked item is explained and checked by the server on save.
 * Tier 2 (why): One list for sign-up, password reset and change password, so the forms never drift
 * from the rules again (owner decision 2026-11-01: 10+ characters, no composition rules).
 * Tier 3 (how): Pure presentation; `id` lets the input point `aria-describedby` at it.
 */

import { PASSWORD_CHECKLIST } from '@/lib/password-policy';

export function PasswordChecklist({ password, id }: { password: string; id?: string }) {
  return (
    <ul id={id} className="mt-2 space-y-0.5 text-xs">
      {PASSWORD_CHECKLIST.map((item) => {
        const met = item.test ? item.test(password) : null;
        return (
          <li key={item.label} className={met ? 'text-kk-brand font-bold' : 'text-kk-muted'}>
            {met === null ? 'ⓘ' : met ? '✓' : '○'} {item.label}
          </li>
        );
      })}
    </ul>
  );
}
