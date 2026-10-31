/**
 * @file LegalAgreement.tsx
 * @description The "By continuing you agree to..." line shown on every sign-up form.
 *
 * Tier 1 (what): One short sentence linking the Terms of Service and Privacy Policy.
 * Tier 2 (why): Public beta sign-up (owner decision 2026-10-31): people agree to the terms when they
 * create an account, so every form that can create one shows the links.
 * Tier 3 (how): Plain links that open in a new tab, so a half-filled form is not lost.
 */

export function LegalAgreement({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-kk-muted ${className}`}>
      By continuing, you agree to the{' '}
      <a href="/terms" target="_blank" rel="noreferrer" className="text-kk-accent underline underline-offset-2">Terms of Service</a>{' '}
      and{' '}
      <a href="/privacy" target="_blank" rel="noreferrer" className="text-kk-accent underline underline-offset-2">Privacy Policy</a>.
    </p>
  );
}
