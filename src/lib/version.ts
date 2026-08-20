/**
 * KovertKlaus Versioning & Release Lifecycle Configuration
 * 
 * Defines the application semantic version, active release tier,
 * and milestone trajectory toward Beta Season 1 Launch.
 */

export const APP_VERSION = '0.1.0-prealpha';
export const APP_VERSION_LABEL = 'v0.1.0-prealpha';
export const RELEASE_STAGE = 'PRE_ALPHA' as const;

export const RELEASE_TIMELINE = {
  PRE_ALPHA: {
    version: 'v0.1.0-prealpha',
    startDate: '2026-08-20',
    description: 'Core Engine Refactoring, Algorithmic Derangements & Email Dispatch Test Harness',
  },
  ALPHA: {
    version: 'v0.2.0-alpha',
    targetDate: '2026-10-01',
    description: 'Closed Family & Tester Dogfooding, Multi-Carrier Webhooks & Mobile Polish',
  },
  BETA: {
    version: 'v1.0.0-beta',
    targetDate: '2026-11-01',
    description: 'Season 1 Public Winter Launch (Nov 1 - Jan 31), Live Exchanges & Cloudflare SaaS Gate',
  },
  GA: {
    version: 'v1.0.0',
    targetDate: '2027-01-31',
    description: 'General Availability & Q2 Spring Egg Hunt Rotation',
  },
} as const;
