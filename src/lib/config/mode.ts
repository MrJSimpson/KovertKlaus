/**
 * ============================================================================
 * KOVERTKLAUS™ INITIALIZATION VECTOR & SYSTEM MODE CONFIGURATION
 * Copyright (c) 2026 Joshua Simpson. All Rights Reserved.
 * ============================================================================
 * 
 * INITIALIZATION VECTOR EXPLANATION:
 * The `MODE` environment variable serves as the fundamental startup initialization 
 * vector for KovertKlaus.
 * 
 * 1. `MODE="SELFHOSTED"` (Default):
 *    - Designed for personal, family, non-profit, and home-lab self-hosting.
 *    - Unlocks maximum configuration flexibility across all runtime parameters.
 *    - Activates local initialization vectors (e.g. auto-bootstrapping the initial 
 *      'santa' administrator account with mandatory NIST first-login password reset).
 *    - Permits unlimited operations and participants without SaaS billing gates.
 * 
 * 2. `MODE="SAAS"`:
 *    - Designed for cloud-hosted, multi-tenant commercial operations (kovertklaus.com).
 *    - Ignores self-hosted initialization vectors (bypassing local admin auto-seeding
 *      as cloud environments use separate centralized provisioning).
 *    - Enables SaaS-specific feature sets: multi-tenant quotas, commercial Stripe 
 *      billing modules, customer waitlist capture, and Cloudflare Worker optimizations.
 * ============================================================================
 */

export type Mode = 'SELFHOSTED' | 'SAAS';

const rawMode = (process.env.MODE || process.env.APP_MODE || 'SELFHOSTED').trim().toUpperCase();

export const MODE: Mode = rawMode === 'SAAS' ? 'SAAS' : 'SELFHOSTED';
export const IS_SAAS: boolean = MODE === 'SAAS';
export const IS_SELF_HOSTED: boolean = !IS_SAAS;

// Compatibility alias
export const APP_MODE = IS_SAAS ? 'saas' : 'selfhosted';

/**
 * Capability Matrix for Feature Gating
 */
export const FEATURES = {
  /** Self-hosted deployment mode */
  selfHostedMode: IS_SELF_HOSTED,
  /** SaaS multi-tenant operation mode */
  saasMode: IS_SAAS,
  /** Stripe payment & commercial billing integration */
  stripeBilling: IS_SAAS && Boolean(process.env.STRIPE_SECRET_KEY),
  /** Multi-tenant account resource quotas */
  multiTenancyQuotas: IS_SAAS,
  /** Package tracking Demerit immunity waiver (Active everywhere) */
  demeritImmunityWaiver: true,
} as const;
