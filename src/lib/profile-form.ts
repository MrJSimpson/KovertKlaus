/**
 * @file profile-form.ts
 * @description Form state of the Profile page: loading it from the profile API, counting unsaved
 * changes, building the save request and checking a password change before it is sent.
 *
 * Tier 1 (what): `ProfileForm` (every editable field), `formFromUser`, `changedFields`, `trimForm`,
 * `profilePayload`, `passwordChangeProblem`, `standingBanner`, `statusLabel` and `COUNTRIES`.
 * Tier 2 (why): Visual refresh (2.0.0-beta, design canvas "Profile"). The page replaces Account
 * Preferences. Account Preferences read the Head Elf visibility under `allowOperatorView*`, which
 * only the hosted worker sends, so on self-hosted every save reset them to the defaults. These
 * helpers read the column names both servers send, and are tested on their own.
 * Tier 3 (how): Both servers return the `allowOrganizerView*` columns from `GET /api/users/profile`
 * (the worker adds `allowOperatorView*` aliases). Both accept `allowOperatorView*` on `PUT`; the
 * worker accepts only those names, so the payload uses them. The password change is a separate
 * request (`currentPassword`, `newPassword`) so a wrong password never blocks the rest of a save.
 */

import { passwordLength, PASSWORD_MIN_LENGTH } from './password-policy';

/** Every field the Profile page edits and saves with "Save changes". */
export interface ProfileForm {
  name: string;
  streetAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  deliveryNotes: string;
  topHalfSize: string;
  bottomHalfSize: string;
  shoeSize: string;
  chestBustMeasurement: string;
  waistMeasurement: string;
  inseamMeasurement: string;
  allergiesDiet: string;
  favoriteColors: string;
  favoriteHobbies: string;
  dislikes: string;
  /** The Head Elf may see sizes (`allowOrganizerViewSizes`). */
  showSizes: boolean;
  showMeasurements: boolean;
  showAllergies: boolean;
  showFavorites: boolean;
  emailNotifications: boolean;
}

/** Shipping countries offered (the codes stored in `User.country`). */
export const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
] as const;

/** The four visibility switches: form key, client API name, column name and database default. */
const VISIBILITY = [
  { key: 'showSizes', api: 'allowOperatorViewSizes', column: 'allowOrganizerViewSizes', fallback: true },
  { key: 'showMeasurements', api: 'allowOperatorViewMeasurements', column: 'allowOrganizerViewMeasurements', fallback: false },
  { key: 'showAllergies', api: 'allowOperatorViewAllergies', column: 'allowOrganizerViewAllergies', fallback: true },
  { key: 'showFavorites', api: 'allowOperatorViewFavorites', column: 'allowOrganizerViewFavorites', fallback: false },
] as const;

const TEXT_FIELDS = [
  'name', 'streetAddress', 'addressLine2', 'city', 'state', 'zipCode', 'deliveryNotes',
  'topHalfSize', 'bottomHalfSize', 'shoeSize', 'chestBustMeasurement', 'waistMeasurement', 'inseamMeasurement',
  'allergiesDiet', 'favoriteColors', 'favoriteHobbies', 'dislikes',
] as const;

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** The form for the `user` object of `GET /api/users/profile` (either server). */
export function formFromUser(user: Record<string, unknown>): ProfileForm {
  const form = Object.fromEntries(TEXT_FIELDS.map((f) => [f, text(user[f])])) as Record<(typeof TEXT_FIELDS)[number], string>;
  // Older accounts kept their top size in `shirtSize` only.
  if (!form.topHalfSize) form.topHalfSize = text(user.shirtSize);
  const country = text(user.country).toUpperCase();
  const visibility = Object.fromEntries(
    VISIBILITY.map((v) => {
      const value = user[v.column] ?? user[v.api];
      return [v.key, typeof value === 'boolean' ? value : v.fallback];
    }),
  ) as Pick<ProfileForm, 'showSizes' | 'showMeasurements' | 'showAllergies' | 'showFavorites'>;
  return {
    ...form,
    country: COUNTRIES.some((c) => c.code === country) ? country : 'US',
    ...visibility,
    emailNotifications: typeof user.emailNotifications === 'boolean' ? user.emailNotifications : true,
  };
}

/** Keys whose value differs between the saved form and the draft (leading and trailing spaces ignored). */
export function changedFields(saved: ProfileForm, draft: ProfileForm): (keyof ProfileForm)[] {
  return (Object.keys(draft) as (keyof ProfileForm)[]).filter((k) => {
    const a = saved[k];
    const b = draft[k];
    return typeof a === 'string' && typeof b === 'string' ? a.trim() !== b.trim() : a !== b;
  });
}

/** The draft as the server stores it: text without leading or trailing spaces. */
export function trimForm(draft: ProfileForm): ProfileForm {
  const out = { ...draft };
  for (const f of TEXT_FIELDS) out[f] = draft[f].trim();
  return out;
}

/** The `PUT /api/users/profile` body for a draft: text trimmed, visibility under its API names. */
export function profilePayload(draft: ProfileForm): Record<string, string | boolean> {
  const body: Record<string, string | boolean> = Object.fromEntries(TEXT_FIELDS.map((f) => [f, draft[f].trim()]));
  // `shirtSize` is the pre-2.0 copy of the top size; keep it in step for older readers.
  body.shirtSize = body.topHalfSize;
  body.country = draft.country;
  for (const v of VISIBILITY) body[v.api] = draft[v.key];
  body.emailNotifications = draft.emailNotifications;
  return body;
}

/**
 * What stops a password change before it is sent, or `null` when it may go. The server still runs
 * the full check (common, contextual and breached passwords; `src/lib/password-check.ts`).
 */
export function passwordChangeProblem(current: string, next: string, confirm: string): string | null {
  if (!current) return 'Enter your current password.';
  if (passwordLength(next) < PASSWORD_MIN_LENGTH) return `Your new password needs at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (next !== confirm) return 'The two new passwords do not match.';
  if (next === current) return 'Choose a password different from your current one.';
  return null;
}

/** The Service record banner for an account status (`src/lib/demerits.ts` tiers). */
export function standingBanner(status: string): { tone: 'success' | 'warning' | 'danger'; title: string; text: string } {
  if (status === 'DISABLED') {
    return { tone: 'danger', title: 'Suspended.', text: 'You cannot create or join missions.' };
  }
  if (status === 'REMOTE_RESTRICTED') {
    return { tone: 'warning', title: 'Local missions only.', text: 'You can join in-person missions. Each one you complete removes a Coal Citation.' };
  }
  return { tone: 'success', title: 'Good standing.', text: 'You can join and lead missions.' };
}

/** Readable account status for the Service record. */
export function statusLabel(status: string): string {
  return status === 'DISABLED' ? 'Suspended' : status === 'REMOTE_RESTRICTED' ? 'Local only' : 'Active';
}
