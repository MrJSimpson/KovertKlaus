/**
 * @file version.ts
 * @description Application version, release stage and the milestone trajectory to Season 1.
 *
 * Tier 1 (what): `APP_VERSION` is shown in the UI badges. The release stage that gates registration is a
 * North Pole setting (`SystemConfig.releaseStage`, src/lib/platform-limits.ts), not a constant.
 * Tier 2 (why): One place for the running version, so badges, announcements and the changelog agree.
 * Tier 3 (how): `package.json` `version` is the source of truth; bump both in the release pull request
 * (docs/VERSIONING.md). `src/lib/version.test.ts` fails the build if they, the newest CHANGELOG
 * section or the newest announcement drift apart.
 */

export const APP_VERSION = '0.6.3-alpha';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;

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
