/**
 * @file systemConfigUpdate.ts
 * @description The single, allowlist-only builder for North Pole `SystemConfig` PATCH updates.
 *
 * Tier 1 (what): Maps an untrusted admin PATCH body to Prisma update data for the `SystemConfig`
 * singleton, coercing each field to its column type.
 * Tier 2 (why): Passing the body straight to Prisma let a request write any column (including
 * `id` and `appMode`). Naming each field means only operator-editable settings can change. The
 * Next.js route (self-hosted) and the edge worker (SaaS) both use this builder, so they accept
 * exactly the same fields.
 * Tier 3 (how): `buildSystemConfigUpdate(body, adminId)` is pure and unit-tested. `appMode` is
 * deliberately absent: the edition is an environment invariant, never a database setting.
 */

const STRING_FIELDS = [
  'activeThemeId',
  'activeSeason',
  'maintenanceMessage',
  'altHome',
  'emailProvider',
  'emailFrom',
  'emailFromName',
  'brevoApiKey',
  'brevoSenderEmail',
  'brevoSenderName',
  'smtpHost',
  'smtpUser',
  'smtpPass',
  'smtpFrom',
  'resendApiKey',
  'defaultCurrency',
] as const;

const BOOLEAN_FIELDS = ['announcementBannerActive', 'maintenanceMode', 'smtpSecure', 'lifecycleCronEnabled'] as const;

const NUMBER_FIELDS = [
  'freeAnnualHostAllowance',
  'freeAnnualJoinAllowance',
  'paidEventPriceUsd',
  'maxFreeParticipants',
  'maxWishlistItems',
  'defaultBudgetMin',
  'defaultBudgetMax',
] as const;

/**
 * Builds the `SystemConfig` update from an untrusted admin PATCH body.
 *
 * @param body - Parsed JSON body from the config PATCH request.
 * @param adminId - The verified admin making the change (recorded as `updatedByAdminId`).
 * @returns Prisma update data containing only allowlisted fields present in `body`.
 */
export function buildSystemConfigUpdate(body: Record<string, unknown>, adminId: string): Record<string, unknown> {
  const data: Record<string, unknown> = { updatedByAdminId: adminId };

  for (const field of STRING_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field] === null ? null : String(body[field]);
  }
  for (const field of BOOLEAN_FIELDS) {
    if (body[field] !== undefined) data[field] = Boolean(body[field]);
  }
  for (const field of NUMBER_FIELDS) {
    if (body[field] !== undefined) {
      const n = Number(body[field]);
      if (Number.isFinite(n)) data[field] = n;
    }
  }

  if (body.smtpPort !== undefined) {
    const port = Number(body.smtpPort);
    data.smtpPort = Number.isFinite(port) && port > 0 ? port : 587;
  }
  if (body.lifecycleCronIntervalMinutes !== undefined) {
    const minutes = Number(body.lifecycleCronIntervalMinutes);
    data.lifecycleCronIntervalMinutes = Number.isFinite(minutes) ? Math.max(1, minutes) : 60;
  }

  return data;
}
