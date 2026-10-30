/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_PLATFORM_SETTINGS,
  getPlatformSettings,
  hostedMissionLimitError,
  isAlphaStage,
  missionCapacity,
  missionFullError,
  missionJoinError,
  RECRUITMENT_CLOSED_ERROR,
  PLATFORM_LIMIT_BOUNDS,
  RUNNING_MISSION_STATUSES,
  toPlatformSettings,
  validatePlatformSettings,
} from './platform-limits';

test('Platform limits - defaults are the owner decisions of 2026-10-29', () => {
  assert.deepStrictEqual(DEFAULT_PLATFORM_SETTINGS, {
    maxActiveHostedMissions: 5,
    maxMissionAgents: 50,
    maxWishlistItems: 20,
    maxItemQuantity: 25,
    releaseStage: 'ALPHA',
  });
  for (const b of Object.values(PLATFORM_LIMIT_BOUNDS)) assert.ok(b.min <= b.default && b.default <= b.max);
});

test('Platform limits - a PATCH outside the bounds is refused, inside is accepted', () => {
  assert.deepStrictEqual(validatePlatformSettings({ maxMissionAgents: 50, releaseStage: 'BETA', title: 'ignored' }), []);
  assert.deepStrictEqual(validatePlatformSettings({}), []);
  const errors = validatePlatformSettings({ maxMissionAgents: 0, maxActiveHostedMissions: 21, maxWishlistItems: 2.5, maxItemQuantity: 'lots', releaseStage: 'GA' });
  assert.strictEqual(errors.length, 5);
  assert.match(errors[0], /from 1 to 20/);
  assert.match(errors[1], /Agents per mission must be a whole number from 4 to 100/);
  assert.match(errors[4], /Release stage must be one of ALPHA, BETA/);
  assert.strictEqual(validatePlatformSettings({ maxMissionAgents: '50' }).length, 0); // form values may arrive as strings
});

test('Platform limits - stored values are clamped; a missing row or bad stage falls back to defaults', () => {
  assert.deepStrictEqual(toPlatformSettings(null), DEFAULT_PLATFORM_SETTINGS);
  const s = toPlatformSettings({ maxActiveHostedMissions: 999, maxMissionAgents: -3, maxWishlistItems: null, maxItemQuantity: 7.9, releaseStage: 'PRE_ALPHA' });
  assert.deepStrictEqual(s, { maxActiveHostedMissions: 20, maxMissionAgents: 4, maxWishlistItems: 20, maxItemQuantity: 7, releaseStage: 'ALPHA' });
  assert.strictEqual(toPlatformSettings({ releaseStage: 'BETA' }).releaseStage, 'BETA');
  assert.strictEqual(isAlphaStage('ALPHA'), true);
  assert.strictEqual(isAlphaStage('BETA'), false);
});

test('Platform limits - a failed read returns the defaults instead of throwing', async () => {
  const broken = { systemConfig: { findUnique: async () => { throw new Error('column "releaseStage" does not exist'); } } };
  assert.deepStrictEqual(await getPlatformSettings(broken), DEFAULT_PLATFORM_SETTINGS);
  const beta = { systemConfig: { findUnique: async () => ({ releaseStage: 'BETA', maxMissionAgents: 30 }) } };
  const s = await getPlatformSettings(beta);
  assert.strictEqual(s.releaseStage, 'BETA');
  assert.strictEqual(s.maxMissionAgents, 30);
});

test('Platform limits - a Head Elf may run up to the limit of unfinished missions', async () => {
  let where: any;
  const db = (count: number) => ({ exchange: { count: async (args: any) => ((where = args.where), count) } }) as any;
  assert.strictEqual(await hostedMissionLimitError(db(4), 'u1', DEFAULT_PLATFORM_SETTINGS), null);
  assert.deepStrictEqual(where, { organizerId: 'u1', status: { in: [...RUNNING_MISSION_STATUSES] } });
  assert.ok(!RUNNING_MISSION_STATUSES.includes('COMPLETED' as any) && !RUNNING_MISSION_STATUSES.includes('CANCELLED' as any));
  assert.match((await hostedMissionLimitError(db(5), 'u1', DEFAULT_PLATFORM_SETTINGS)) ?? '', /already running 5 missions/);
});

test('Platform limits - mission capacity: the Head Elf may tighten, never loosen', () => {
  const s = { ...DEFAULT_PLATFORM_SETTINGS, maxMissionAgents: 50 };
  assert.strictEqual(missionCapacity(null, s), 50);
  assert.strictEqual(missionCapacity(12, s), 12);
  assert.strictEqual(missionCapacity(80, s), 50);
  assert.strictEqual(missionFullError(null, 49, s), null);
  assert.match(missionFullError(null, 50, s) ?? '', /maximum operative capacity/);
  assert.ok(missionFullError(12, 12, s));
});

test('Platform limits - joining needs a recruiting mission with room', () => {
  const s = DEFAULT_PLATFORM_SETTINGS;
  assert.strictEqual(missionJoinError({ status: 'RECRUITING', maxParticipants: 10 }, 9, s), null);
  assert.match(missionJoinError({ status: 'RECRUITING', maxParticipants: 10 }, 10, s) ?? '', /maximum operative capacity/);
  for (const status of ['SETUP', 'MATCHED', 'SHIPPED', 'EXECUTED', 'COMPLETED', 'CANCELLED']) {
    assert.strictEqual(missionJoinError({ status, maxParticipants: null }, 0, s), RECRUITMENT_CLOSED_ERROR, status);
  }
});
