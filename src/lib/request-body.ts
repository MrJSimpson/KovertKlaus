/**
 * Reads and narrows untrusted JSON request bodies.
 *
 * Tier 1 (what): `readJsonBody` parses a request body into a plain object; `bodyString` and
 * `bodyObject` read one field of it with a known type.
 * Tier 2 (why): Handlers that cast the body to `any` crash on a field of the wrong type (for
 * example `.trim()` on a number), which returns a 500 instead of a 400. Narrowing at the boundary
 * keeps wrongly typed input on the same path as missing input.
 * Tier 3 (how): Pure helpers; nothing throws. A missing or wrongly typed field reads as the empty
 * value (`''` or `null`), so existing `if (!field)` checks still reject it.
 */

/**
 * Parses a request body as a JSON object.
 *
 * Invalid JSON, arrays, `null` and primitives all read as `{}`, matching the earlier
 * `request.json().catch(() => ({}))` fallback for bad JSON.
 *
 * @param request - The incoming request; its body is consumed.
 * @returns The body's fields, each still `unknown`.
 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const parsed: unknown = await request.json().catch(() => null);
  return bodyObject(parsed) ?? {};
}

/**
 * Reads a string field.
 *
 * @param value - A field from {@link readJsonBody}.
 * @returns `value` when it is a string, otherwise `''`.
 */
export function bodyString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Reads a nested object field.
 *
 * @param value - A field from {@link readJsonBody}.
 * @returns `value` when it is a non-array object, otherwise `null`.
 */
export function bodyObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
