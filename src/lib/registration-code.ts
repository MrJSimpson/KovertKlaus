/**
 * @file registration-code.ts
 * @description Resolves the code a new agent registers with: a pre-launch activation code or a mission invite code.
 *
 * Tier 1 (what): `resolveRegistrationCode` returns the matched `PreLaunchApproval` or mission, or the error
 * response to send. Both runtimes' `POST /api/users` use it.
 * Tier 2 (why): The two runtimes each carried a copy of this logic, and outside alpha both copies skipped the
 * recruiting and capacity checks: a sign-up with the code of a drawn or full mission was enrolled anyway.
 * One function keeps the checks the same in every release stage and runtime.
 * Tier 3 (how): During alpha a code is required. In any stage, a code is first matched against the email's
 * `PreLaunchApproval`, then against a mission code; a code that matches neither is refused rather than
 * ignored, because the agent meant to join something. A matched mission must be recruiting and have room.
 */

import type { PreLaunchApproval, Prisma, PrismaClient } from '@prisma/client';

/** A mission with its members, as enrollment needs it. */
export type RegistrationMission = Prisma.ExchangeGetPayload<{ include: { members: true } }>;

/** Outcome of `resolveRegistrationCode`. */
export type RegistrationCodeResult =
  | { ok: true; approval: PreLaunchApproval | null; mission: RegistrationMission | null }
  | { ok: false; status: number; error: string };

/**
 * Matches the code a new agent registered with.
 *
 * @param db - App-role client.
 * @param email - The new agent's email, trimmed and lower-cased.
 * @param rawCode - The code from the request body, or an empty string.
 * @param isAlpha - Whether registration is closed to agents without a code.
 */
export async function resolveRegistrationCode(db: PrismaClient, email: string, rawCode: string, isAlpha: boolean): Promise<RegistrationCodeResult> {
  if (!rawCode) {
    if (!isAlpha) return { ok: true, approval: null, mission: null };
    return {
      ok: false,
      status: 403,
      error: 'Direct registration is closed during Alpha. You must be invited to a Secret Santa mission, or enter your approved Pre-Launch Alpha activation cipher.',
    };
  }

  const code = rawCode.trim().toUpperCase();
  const approval = await db.preLaunchApproval.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, inviteCode: code } });
  if (approval) return { ok: true, approval, mission: null };

  const mission = await db.exchange.findUnique({ where: { code }, include: { members: true } });
  if (!mission) {
    return {
      ok: false,
      status: 404,
      error: isAlpha
        ? 'Invalid invitation code or pre-launch alpha cipher. Please verify your activation link.'
        : 'Invalid mission invite code. Please check your invite link, or register without a code.',
    };
  }
  if (mission.status !== 'RECRUITING') {
    return { ok: false, status: 400, error: 'Recruitment for this mission has closed. Operatives cannot join active or completed missions.' };
  }
  if (mission.maxParticipants && mission.members.length >= mission.maxParticipants) {
    return { ok: false, status: 400, error: 'This exchange has reached its maximum operative capacity.' };
  }
  return { ok: true, approval: null, mission };
}
