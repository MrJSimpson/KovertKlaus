'use client';

/**
 * @file PasswordChecklist.tsx
 * @description The live password checklist shown under every new-password field.
 *
 * Tier 1 (what): Renders `PASSWORD_CHECKLIST` (src/lib/password-policy.ts): an item turns into a
 * filled check as the agent types; the common/leaked item is checked by the server on save.
 * Tier 2 (why): One list for sign-up, password reset and change password, so the forms never drift
 * from the rules again (owner decision 2026-11-01: 10+ characters, no composition rules). Styled as
 * the visual refresh's Create account checklist (2.0.0-beta), with the real rules, not the mockup's.
 * Tier 3 (how): Pure presentation; `id` lets the input point `aria-describedby` at it. Each item
 * also says "done" / "not yet" to screen readers, since the mark alone is visual.
 */

import { PASSWORD_CHECKLIST, passwordLength } from '@/lib/password-policy';

export function PasswordChecklist({ password, id }: { password: string; id?: string }) {
  const length = passwordLength(password);
  return (
    <ul id={id} aria-live="polite" className="list-none m-0 mt-1 px-3.5 py-3 grid gap-1.5 text-[13px] leading-5 bg-kk-inset border border-kk-border rounded-[var(--kk-radius-md)]">
      {PASSWORD_CHECKLIST.map((item, i) => {
        const met = item.test ? item.test(password) : null;
        const label = i === 0 && length > 0 ? `${item.label}: ${length} so far` : item.label;
        return (
          <li key={item.label} className={`flex gap-2 items-center ${met ? 'text-kk-ink font-semibold' : 'text-kk-muted'}`}>
            <span
              aria-hidden="true"
              className={`inline-flex w-4 h-4 shrink-0 items-center justify-center rounded-full text-[11px] leading-none font-bold ${
                met ? 'bg-kk-primary text-kk-on-primary' : met === null ? 'border-2 border-dashed border-kk-border-control' : 'border-2 border-kk-border-control'
              }`}
            >
              {met ? '✓' : ''}
            </span>
            {label}
            <span className="sr-only">{met === null ? ' (checked when you continue)' : met ? ' (done)' : ' (not yet)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
