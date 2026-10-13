import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * @file adminSetup.ts
 * @description First-run administrator setup for self-hosted installations.
 *
 * Tier 1 (what): When no `AdminUser` exists and no `INITIAL_ADMIN_PASSWORD` is configured,
 * the server issues a one-time setup token, prints it to the server console, and accepts it
 * exactly once at `/northpole/setup` to create the first administrator with a password the
 * operator chooses.
 * Tier 2 (why): No default administrator password ships in the repository. Printing the
 * token to the server console proves the person completing setup can see the server itself,
 * which closes the "first visitor claims admin" race that a plain setup page would open.
 * Tier 3 (how): The token lives only in process memory, stored as a SHA-256 digest on
 * `globalThis` so instrumentation and every route bundle share one value. Restarting the
 * server issues a fresh token. SaaS deployments set `INITIAL_ADMIN_PASSWORD` and never
 * reach this path.
 */

/** Shape of the in-process setup token record kept on `globalThis`. */
interface SetupTokenRecord {
  digest: Buffer;
  issuedAt: Date;
}

const GLOBAL_KEY = '__kovertklausAdminSetupToken';

type GlobalWithSetup = typeof globalThis & { [GLOBAL_KEY]?: SetupTokenRecord | null };

/**
 * Returns the SHA-256 digest of a token string.
 *
 * Tier 1: Hashes the token so the plaintext is never kept after it is printed.
 * Tier 2: Fixed-length digests let `timingSafeEqual` compare without leaking length.
 * Tier 3: Pure function; safe to unit test.
 */
export function digestSetupToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/**
 * Issues a new one-time setup token, replacing any previous one.
 *
 * Tier 1: Generates 32 random bytes (base64url) and stores only their digest.
 * Tier 2: 256 bits of entropy makes guessing infeasible without rate limiting.
 * Tier 3: Returns the plaintext once so the caller can print it. Nothing else can recover it.
 */
export function issueSetupToken(): string {
  const token = randomBytes(32).toString('base64url');
  (globalThis as GlobalWithSetup)[GLOBAL_KEY] = { digest: digestSetupToken(token), issuedAt: new Date() };
  return token;
}

/**
 * Reports whether a setup token is currently outstanding in this process.
 */
export function hasActiveSetupToken(): boolean {
  return Boolean((globalThis as GlobalWithSetup)[GLOBAL_KEY]);
}

/**
 * Verifies a candidate token against the outstanding one in constant time.
 *
 * Tier 1: Returns true only for the exact token most recently issued.
 * Tier 2: `timingSafeEqual` over fixed-length digests avoids timing side channels.
 * Tier 3: Does not consume the token; call `revokeSetupToken()` after a successful setup.
 */
export function verifySetupToken(candidate: string | undefined | null): boolean {
  const record = (globalThis as GlobalWithSetup)[GLOBAL_KEY];
  if (!record || typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 256) {
    return false;
  }
  return timingSafeEqual(record.digest, digestSetupToken(candidate.trim()));
}

/**
 * Permanently clears the outstanding setup token (after setup completes).
 */
export function revokeSetupToken(): void {
  (globalThis as GlobalWithSetup)[GLOBAL_KEY] = null;
}

/**
 * Issues a token if none is outstanding and prints the operator banner to the server console.
 *
 * Tier 1: Idempotent per process: prints once, then stays quiet until a restart.
 * Tier 2: The console (`docker logs kovertklaus-app`) is the only place the token appears.
 * Tier 3: Callers must first confirm that no administrator exists.
 */
export function announceSetupToken(): void {
  if (hasActiveSetupToken()) return;
  const token = issueSetupToken();
  const rule = '='.repeat(72);
  console.log(
    [
      '',
      rule,
      ' 🎅 KovertKlaus first-run setup: no administrator account exists yet.',
      '',
      ` Open /northpole/setup and enter this one-time setup token:`,
      '',
      `   ${token}`,
      '',
      ' The token is valid until setup completes or the server restarts.',
      ' Restarting the server issues a new token.',
      rule,
      '',
    ].join('\n')
  );
}
