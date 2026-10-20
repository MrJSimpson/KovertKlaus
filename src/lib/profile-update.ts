import { sanitizeText } from './security';

/**
 * Operative Dossier text fields the preferences modal can edit.
 *
 * Each key matches a nullable `String` column on the `User` model.
 */
const DOSSIER_TEXT_FIELDS = [
  'streetAddress',
  'addressLine2',
  'city',
  'state',
  'zipCode',
  'country',
  'deliveryNotes',
  'shirtSize',
  'topHalfSize',
  'bottomHalfSize',
  'shoeSize',
  'chestBustMeasurement',
  'waistMeasurement',
  'inseamMeasurement',
  'favoriteColors',
  'allergiesDiet',
  'dislikes',
  'favoriteHobbies',
] as const;

/**
 * Head Elf visibility toggles, keyed by the client-facing `allowOperatorView*`
 * name and mapped to the `allowOrganizerView*` column on the `User` model.
 */
const VISIBILITY_FIELDS = {
  allowOperatorViewSizes: 'allowOrganizerViewSizes',
  allowOperatorViewMeasurements: 'allowOrganizerViewMeasurements',
  allowOperatorViewAllergies: 'allowOrganizerViewAllergies',
  allowOperatorViewFavorites: 'allowOrganizerViewFavorites',
} as const;

type VisibilityColumn = (typeof VISIBILITY_FIELDS)[keyof typeof VISIBILITY_FIELDS];

/**
 * Prisma `select` fragment for every dossier column returned to the profile owner.
 */
export const PROFILE_DOSSIER_SELECT = {
  ...Object.fromEntries(DOSSIER_TEXT_FIELDS.map((field) => [field, true])),
  ...Object.fromEntries(Object.values(VISIBILITY_FIELDS).map((column) => [column, true])),
} as Record<(typeof DOSSIER_TEXT_FIELDS)[number] | VisibilityColumn, true>;

/**
 * Builds the dossier portion of a profile update from an untrusted request body.
 *
 * Only whitelisted fields are copied. Text is sanitized, and the client's
 * `allowOperatorView*` toggles are renamed to their `allowOrganizerView*` columns.
 *
 * @param body - Parsed JSON body from the profile PUT/PATCH request.
 * @returns Prisma update data for the dossier columns present in `body`.
 */
export function buildProfileUpdate(body: Record<string, unknown>): Record<string, string | boolean> {
  const data: Record<string, string | boolean> = {};

  for (const field of DOSSIER_TEXT_FIELDS) {
    const value = body[field];
    if (value !== undefined && value !== null) data[field] = sanitizeText(String(value));
  }

  for (const [clientKey, column] of Object.entries(VISIBILITY_FIELDS)) {
    if (body[clientKey] !== undefined) data[column] = Boolean(body[clientKey]);
  }

  return data;
}

/**
 * Adds the client-facing `allowOperatorView*` names to a user record.
 *
 * @param user - User record selected with `PROFILE_DOSSIER_SELECT`.
 * @returns The visibility toggles under their `allowOperatorView*` names.
 */
export function organizerVisibilityAliases(user: Partial<Record<VisibilityColumn, boolean>>): Record<string, boolean | undefined> {
  return Object.fromEntries(
    Object.entries(VISIBILITY_FIELDS).map(([clientKey, column]) => [clientKey, user[column]])
  );
}
