/**
 * @file version.ts
 * @description Application version shown in the UI.
 *
 * Tier 1 (what): `APP_VERSION` is shown in the UI badges. The release stage that gates registration is a
 * North Pole setting (`SystemConfig.releaseStage`, src/lib/platform-limits.ts), not a constant.
 * Tier 2 (why): One place for the running version, so badges, announcements and the changelog agree.
 * Tier 3 (how): `package.json` `version` is the source of truth; bump both in the release pull request
 * (docs/VERSIONING.md). `src/lib/version.test.ts` fails the build if they, the newest CHANGELOG
 * section or the newest announcement drift apart.
 */

export const APP_VERSION = '1.1.2-beta';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;

