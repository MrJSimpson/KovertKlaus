/**
 * @file db-errors.ts
 * @description Recognises database errors caused by an unreachable or waking database.
 *
 * Tier 1 (what): `isDbConnectionError` says whether an error means the database could not be
 * reached (cold start, dropped socket, timeout) rather than a bad query. `dbUnavailableResponse` is
 * the retryable 503 both runtimes send for one.
 * Tier 2 (why): The retry wrappers (`db.ts`, `adminDb.ts`) retry only these errors, and API routes
 * answer them with a retryable 503 so pages keep their loading screen instead of showing a hard
 * error while Neon's scale-to-zero compute wakes up.
 * Tier 3 (how): Matches on the error message and Prisma error class name. No imports, so both
 * database modules and any route can use it.
 */

const CONNECTION_MESSAGES = [
  'socket',
  'connection',
  'Connection terminated',
  'closed',
  'WebSocket',
  'ECONNRESET',
  'ETIMEDOUT',
  'Connection lost',
  "Can't reach database server",
  '57P01',
  'terminating connection',
];

const CONNECTION_ERROR_NAMES = ['PrismaClientInitializationError', 'PrismaClientRustPanicError', 'PrismaClientUnknownRequestError'];

/** Body of the 503 sent while the database is unreachable. Pages retry while `retryable` is set. */
export const DB_UNAVAILABLE_BODY = {
  error: 'The North Pole servers are waking up. Please try again in a moment.',
  retryable: true,
} as const;

/** The 503 answer for a database connection error (both runtimes). */
export function dbUnavailableResponse(): Response {
  return Response.json(DB_UNAVAILABLE_BODY, { status: 503, headers: { 'Retry-After': '2' } });
}

/** Whether `err` means the database was unreachable or dropped the connection. */
export function isDbConnectionError(err: unknown): boolean {
  const e = err as { message?: unknown; name?: unknown } | null | undefined;
  const message = typeof e?.message === 'string' ? e.message : '';
  const name = typeof e?.name === 'string' ? e.name : '';
  return CONNECTION_MESSAGES.some((m) => message.includes(m)) || CONNECTION_ERROR_NAMES.some((n) => name.includes(n));
}
