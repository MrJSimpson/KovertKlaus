/**
 * @file quota-config.ts
 * @description The Brevo sending allowance as a North Pole setting: its fields, bounds and validation.
 *
 * Tier 1 (what): `EMAIL_QUOTA_BOUNDS` and `EMAIL_QUOTA_PERIODS` say what an admin may set;
 * `validateEmailQuotaSettings` checks a North Pole PATCH; `toQuotaConfig` reads the stored row,
 * clamped to the bounds. `daily-limit.ts` turns it into the sending cap.
 * Tier 2 (why): Owner decision (2026-10-31): the quota is a database setting edited in the North
 * Pole, not a Worker env var (`EMAIL_DAILY_QUOTA` is gone). Brevo's free tier is 300 a day; its paid
 * tier is a monthly allowance (for example 50,000), so a MONTH period counts from a reset day, with an
 * optional per-day cap so one busy day cannot spend the month. Like the platform limits, every field
 * has server-side bounds, so an admin can tune sending but never set a value that breaks it.
 * Tier 3 (how): Columns on the `SystemConfig` singleton (`emailQuotaPeriod`, `emailQuota`,
 * `emailQuotaResetDay`, `emailDailyCap`). The reset day stops at 28 so every month has it. A missing
 * row, a failed read or an out-of-bounds value falls back to the default or is clamped.
 */

/** How the allowance is counted. */
export const EMAIL_QUOTA_PERIODS = ['DAY', 'MONTH'] as const;

/** A quota period an admin can choose. */
export type EmailQuotaPeriod = (typeof EMAIL_QUOTA_PERIODS)[number];

interface Bounds {
  min: number;
  max: number;
  default: number;
  label: string;
}

/** What an admin may set for each number. */
export const EMAIL_QUOTA_BOUNDS = {
  emailQuota: { min: 10, max: 1_000_000, default: 300, label: 'Emails allowed per period' },
  emailQuotaResetDay: { min: 1, max: 28, default: 1, label: 'Monthly reset day' },
  emailDailyCap: { min: 0, max: 1_000_000, default: 0, label: 'Daily cap in monthly mode (0 = none)' },
} as const satisfies Record<string, Bounds>;

/** A number field of the quota setting. */
export type EmailQuotaNumberKey = keyof typeof EMAIL_QUOTA_BOUNDS;

/** The stored allowance, clamped and ready to use. */
export interface QuotaConfig {
  period: EmailQuotaPeriod;
  quota: number;
  resetDay: number;
  /** Per-day cap in MONTH mode; 0 means none. Ignored in DAY mode. */
  dailyCap: number;
}

/** Today's behaviour before anyone edits the setting: Brevo free tier, 300 a day. */
export const DEFAULT_QUOTA_CONFIG: QuotaConfig = { period: 'DAY', quota: 300, resetDay: 1, dailyCap: 0 };

/** True when `value` is a quota period an admin can choose. */
export function isEmailQuotaPeriod(value: unknown): value is EmailQuotaPeriod {
  return typeof value === 'string' && (EMAIL_QUOTA_PERIODS as readonly string[]).includes(value);
}

/**
 * Errors in a North Pole PATCH's quota fields; empty when they are valid. Absent fields are not
 * checked; present ones must be whole numbers within their bounds, or a known period.
 */
export function validateEmailQuotaSettings(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(EMAIL_QUOTA_BOUNDS) as EmailQuotaNumberKey[]) {
    if (body[key] === undefined) continue;
    const n = Number(body[key]);
    const b = EMAIL_QUOTA_BOUNDS[key];
    if (!Number.isInteger(n) || n < b.min || n > b.max) errors.push(`${b.label} must be a whole number from ${b.min} to ${b.max}.`);
  }
  if (body.emailQuotaPeriod !== undefined && !isEmailQuotaPeriod(body.emailQuotaPeriod)) {
    errors.push(`Email quota period must be one of ${EMAIL_QUOTA_PERIODS.join(', ')}.`);
  }
  return errors;
}

function clamp(value: unknown, b: Bounds): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return b.default;
  return Math.min(b.max, Math.max(b.min, Math.round(n)));
}

/** The allowance from a `SystemConfig` row (or nothing), clamped to the bounds. */
export function toQuotaConfig(row?: Partial<Record<'emailQuotaPeriod' | EmailQuotaNumberKey, unknown>> | null): QuotaConfig {
  if (!row) return { ...DEFAULT_QUOTA_CONFIG };
  return {
    period: isEmailQuotaPeriod(row.emailQuotaPeriod) ? row.emailQuotaPeriod : DEFAULT_QUOTA_CONFIG.period,
    quota: row.emailQuota === undefined ? DEFAULT_QUOTA_CONFIG.quota : clamp(row.emailQuota, EMAIL_QUOTA_BOUNDS.emailQuota),
    resetDay: row.emailQuotaResetDay === undefined ? DEFAULT_QUOTA_CONFIG.resetDay : clamp(row.emailQuotaResetDay, EMAIL_QUOTA_BOUNDS.emailQuotaResetDay),
    dailyCap: row.emailDailyCap === undefined ? DEFAULT_QUOTA_CONFIG.dailyCap : clamp(row.emailDailyCap, EMAIL_QUOTA_BOUNDS.emailDailyCap),
  };
}
