/**
 * @file report.ts
 * @description Input rules for After-Action Report entries (`createReport`).
 *
 * Tier 1 (what): `validateReportInput` checks an entry's text and optional photo URL.
 * Tier 2 (why): Report photos render as `<img src>` for every agent in the mission, so only
 * web (`http(s)://`) and inline image (`data:image/…`) sources are accepted; other schemes
 * (`javascript:`, `file:`) are refused. Shared by the Next.js route and the edge worker.
 * Tier 3 (how): Pure; returns an error message, or `null` when the input is acceptable.
 */

/** Longest accepted report note, in characters. */
export const MAX_REPORT_TEXT = 2000;

/** Largest accepted inline (`data:`) photo, in characters (compressed WebP fits well within). */
export const MAX_INLINE_PHOTO_CHARS = 1_500_000;

/**
 * Validates an After-Action Report entry.
 *
 * @param thankYouText - The note (may be empty when a photo is attached).
 * @param photoUrl - Optional photo URL or `data:image/…` URI.
 * @returns An error message, or `null` if valid.
 */
export function validateReportInput(thankYouText: unknown, photoUrl: unknown): string | null {
  const text = typeof thankYouText === 'string' ? thankYouText.trim() : '';
  const photo = typeof photoUrl === 'string' ? photoUrl.trim() : '';

  if (!text && !photo) return 'A report entry needs a note or a photo.';
  if (text.length > MAX_REPORT_TEXT) return `Report notes are limited to ${MAX_REPORT_TEXT} characters.`;
  if (photo) {
    const isWeb = /^https?:\/\//i.test(photo);
    const isInlineImage = /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(photo);
    if (!isWeb && !isInlineImage) return 'Photo must be a web link or an uploaded image.';
    if (isInlineImage && photo.length > MAX_INLINE_PHOTO_CHARS) return 'Photo is too large. Please use a smaller image.';
  }
  return null;
}
