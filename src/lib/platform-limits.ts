/**
 * @file platform-limits.ts
 * @description Admin-set platform limits and the release stage, with the bounds that keep them safe.
 *
 * Tier 1 (what): `PLATFORM_LIMIT_BOUNDS` and `RELEASE_STAGES` say what an admin may set,
 * `validatePlatformSettings` checks a North Pole PATCH against them, `getPlatformSettings` reads the
 * current values, and `hostedMissionLimitError` / `missionCapacity` / `missionFullError` enforce the
 * mission limits. Both runtimes use them.
 * Tier 2 (why): Beta opens sign-ups (2026-10-29). Owner decisions: settings an admin may tune live in the
 * database; each has server-side bounds, so an admin can make the app run better but never set a value
 * that breaks it; a Head Elf may only tighten a platform limit, never loosen it. The annual free
 * allowances stay unenforced until after beta; the 5 running missions per Head Elf and 50 agents per
 * mission keep the database small and stop pointless abuse. Security limits (sign-in and sign-up
 * throttles) are not here: they stay in code.
 * Tier 3 (how): Values come from the `SystemConfig` singleton. A missing row, a failed read, or a value
 * outside its bounds (e.g. edited directly in SQL) falls back to the default or is clamped, so the app
 * always runs on a sane value.
 */

import type { PrismaClient } from '@prisma/client';

/** One admin-editable integer setting. */
export interface LimitBounds {
  min: number;
  max: number;
  default: number;
  label: string;
}

/** Bounds for every platform limit an admin can edit in the North Pole. */
export const PLATFORM_LIMIT_BOUNDS = {
  maxActiveHostedMissions: { min: 1, max: 20, default: 5, label: 'Missions a Head Elf can run at once' },
  maxMissionAgents: { min: 4, max: 100, default: 50, label: 'Agents per mission' },
  maxWishlistItems: { min: 1, max: 50, default: 20, label: 'Items per Secret Santa wishlist' },
  maxItemQuantity: { min: 1, max: 99, default: 25, label: 'Quantity per wishlist item' },
} as const satisfies Record<string, LimitBounds>;

/** Name of a bounded platform limit. */
export type PlatformLimitKey = keyof typeof PLATFORM_LIMIT_BOUNDS;

const LIMIT_KEYS = Object.keys(PLATFORM_LIMIT_BOUNDS) as PlatformLimitKey[];

/** Release stages an admin can switch between. `ALPHA` closes registration to agents without a code. */
export const RELEASE_STAGES = ['ALPHA', 'BETA'] as const;

/** A release stage an admin can choose. */
export type ReleaseStage = (typeof RELEASE_STAGES)[number];

/** Stage used before the setting exists or when it cannot be read. */
export const DEFAULT_RELEASE_STAGE: ReleaseStage = 'ALPHA';

/** The current platform limits and release stage. */
export type PlatformSettings = Record<PlatformLimitKey, number> & { releaseStage: ReleaseStage };

/** Defaults: what the app runs on when `SystemConfig` is empty or unreachable. */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  ...(Object.fromEntries(LIMIT_KEYS.map((k) => [k, PLATFORM_LIMIT_BOUNDS[k].default])) as Record<PlatformLimitKey, number>),
  releaseStage: DEFAULT_RELEASE_STAGE,
};

/** Missions that still hold a Head Elf's attention: anything not completed or cancelled. */
export const RUNNING_MISSION_STATUSES = ['SETUP', 'RECRUITING', 'MATCHED', 'SHIPPED', 'EXECUTED'] as const;

/** True when `value` is a release stage an admin can choose. */
export function isReleaseStage(value: unknown): value is ReleaseStage {
  return typeof value === 'string' && (RELEASE_STAGES as readonly string[]).includes(value);
}

/** True while registration needs an activation or invite code. */
export function isAlphaStage(stage: ReleaseStage): boolean {
  return stage === 'ALPHA';
}

/**
 * Checks the platform settings in an untrusted North Pole PATCH body. Fields that are absent are not
 * checked; present ones must be whole numbers within their bounds, or a known release stage.
 *
 * @returns One message per invalid field (empty when the body is safe to save).
 */
export function validatePlatformSettings(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const key of LIMIT_KEYS) {
    if (body[key] === undefined) continue;
    const { min, max, label } = PLATFORM_LIMIT_BOUNDS[key];
    const n = Number(body[key]);
    if (!Number.isInteger(n) || n < min || n > max) errors.push(`${label} must be a whole number from ${min} to ${max}.`);
  }
  if (body.releaseStage !== undefined && !isReleaseStage(body.releaseStage)) {
    errors.push(`Release stage must be one of ${RELEASE_STAGES.join(', ')}.`);
  }
  return errors;
}

/** Brings a stored value back within bounds; a non-number becomes the default. */
function clampLimit(key: PlatformLimitKey, value: unknown): number {
  const { min, max, default: fallback } = PLATFORM_LIMIT_BOUNDS[key];
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** The fields `toPlatformSettings` reads from a `SystemConfig` row. */
export type PlatformSettingsSource = Partial<Record<PlatformLimitKey | 'releaseStage', unknown>>;

/** Platform settings from a `SystemConfig` row (or `null`), clamped to bounds. */
export function toPlatformSettings(row: PlatformSettingsSource | null | undefined): PlatformSettings {
  if (!row) return { ...DEFAULT_PLATFORM_SETTINGS };
  const limits = Object.fromEntries(LIMIT_KEYS.map((k) => [k, clampLimit(k, row[k])])) as Record<PlatformLimitKey, number>;
  return { ...limits, releaseStage: isReleaseStage(row.releaseStage) ? row.releaseStage : DEFAULT_RELEASE_STAGE };
}

/** Anything that can load the `SystemConfig` singleton: `adminDb`, or the worker's cached reader. */
export interface SystemConfigReader {
  systemConfig: { findUnique: (args: { where: { id: string } }) => Promise<PlatformSettingsSource | null> };
}

/** Reads the current platform settings. Never throws: a failed read returns the defaults. */
export async function getPlatformSettings(reader: SystemConfigReader): Promise<PlatformSettings> {
  try {
    return toPlatformSettings(await reader.systemConfig.findUnique({ where: { id: 'singleton' } }));
  } catch (err) {
    console.error('[PlatformLimits] could not read SystemConfig, using defaults:', err);
    return { ...DEFAULT_PLATFORM_SETTINGS };
  }
}

/**
 * Why `userId` may not create another mission, or `null` when they may.
 *
 * @param db - App-role client (missions are in the app schema).
 */
export async function hostedMissionLimitError(db: PrismaClient, userId: string, settings: PlatformSettings): Promise<string | null> {
  const running = await db.exchange.count({ where: { organizerId: userId, status: { in: [...RUNNING_MISSION_STATUSES] } } });
  if (running < settings.maxActiveHostedMissions) return null;
  return `You are already running ${running} missions, the most a Head Elf can run at once (${settings.maxActiveHostedMissions}). Finish or cancel one to start another.`;
}

/** A mission's real capacity: the Head Elf's cap when set, never above the platform limit. */
export function missionCapacity(maxParticipants: number | null | undefined, settings: PlatformSettings): number {
  return maxParticipants ? Math.min(maxParticipants, settings.maxMissionAgents) : settings.maxMissionAgents;
}

/** Error for joining a mission that has left recruiting (drawn, finished or cancelled). */
export const RECRUITMENT_CLOSED_ERROR = 'Recruitment for this mission has closed. Operatives cannot join active or completed missions.';

/**
 * Why an agent may not join `mission` now, or `null` when they may: it must still be recruiting and
 * have room. Used by sign-up with an invite code and by KDM token joins; emailed invitations check the same two rules.
 */
export function missionJoinError(
  mission: { status: string; maxParticipants: number | null | undefined },
  memberCount: number,
  settings: PlatformSettings
): string | null {
  if (mission.status !== 'RECRUITING') return RECRUITMENT_CLOSED_ERROR;
  return missionFullError(mission.maxParticipants, memberCount, settings);
}

/** Why another agent may not join, or `null` when there is room. */
export function missionFullError(maxParticipants: number | null | undefined, memberCount: number, settings: PlatformSettings): string | null {
  return memberCount >= missionCapacity(maxParticipants, settings) ? 'This exchange has reached its maximum operative capacity.' : null;
}
