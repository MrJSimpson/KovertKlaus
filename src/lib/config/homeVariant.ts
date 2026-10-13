/**
 * @file homeVariant.ts
 * @description Resolves the North Pole "Alt Home" setting to a landing page variant.
 *
 * Tier 1 (what): Maps an `altHome` value (with legacy aliases) to 'coming_soon' or 'app_home'.
 * Tier 2 (why): Shared by the server page (initial render) and the client switcher (live value)
 * so both always agree on the same input.
 * Tier 3 (how): Pure; empty or unknown values fall back to the edition default
 * (SaaS: coming_soon, self-hosted: app_home).
 */

/** Canonical landing variants. */
export type HomeVariantKey = 'coming_soon' | 'app_home';

const ALIASES: Record<string, HomeVariantKey> = {
  coming_soon: 'coming_soon',
  comingsoon: 'coming_soon',
  'coming-soon': 'coming_soon',
  comingsoonlanding: 'coming_soon',
  app_home: 'app_home',
  apphome: 'app_home',
  default: 'app_home',
};

/** Resolves an `altHome` setting to a canonical variant (edition default when empty/unknown). */
export function resolveHomeVariant(altHome: string | null | undefined, isSaas: boolean): HomeVariantKey {
  const key = (altHome || '').trim().toLowerCase();
  return ALIASES[key] ?? (isSaas ? 'coming_soon' : 'app_home');
}
