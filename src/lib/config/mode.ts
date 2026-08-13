/**
 * ============================================================================
 * KOVERTKLAUS™ INITIALIZATION VECTOR & COMMERCIAL USE NOTICE
 * Copyright (c) 2026 Joshua Simpson. All Rights Reserved.
 * ============================================================================
 * 
 * NOTICE & COMMERCIAL RESTRICTION:
 * This software initialization vector and its underlying codebase are provided
 * for non-commercial, personal, family, educational, and home-lab self-hosting 
 * use under the terms set forth in LICENSE.md.
 * 
 * ANY COMMERCIAL OPERATION, PAID SAAS RE-HOSTING, OR BUSINESS DEPLOYMENT OF 
 * THIS SYSTEM IS STRICTLY PROHIBITED WITHOUT THE EXPRESS PRIOR WRITTEN 
 * CONSENT AND COMMERCIAL LICENSING FROM JOSHUA SIMPSON (OR DESIGNATED 
 * SUCCESSOR ENTITIES).
 * 
 * Enabling `APP_MODE=saas` or attempting to bypass commercial authorization
 * mechanisms without a valid commercial agreement constitutes a breach of 
 * license terms.
 * 
 * For commercial licensing inquiries or acquisition requests, contact:
 * https://kovertklaus.com/commercial-licensing
 * ============================================================================
 */

export type AppMode = 'selfhosted' | 'saas';

export const APP_MODE: AppMode = (process.env.APP_MODE as AppMode) || 'selfhosted';
export const IS_SAAS: boolean = APP_MODE === 'saas';
export const IS_SELF_HOSTED: boolean = !IS_SAAS;

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
