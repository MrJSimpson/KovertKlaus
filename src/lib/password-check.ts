/**
 * @file password-check.ts
 * @description Server-side password checks: length, common and contextual passwords, and known breaches.
 *
 * Tier 1 (what): `validatePasswordRules` is the synchronous check (length, a bundled list of common
 * passwords, repeated or sequential characters, the site name, the agent's own email or name).
 * `isBreachedPassword` asks Have I Been Pwned whether the password appeared in a breach.
 * `checkNewPassword` runs both and is what sign-up, password reset and password change call.
 * Tier 2 (why): Owner decision (2026-11-01, NIST SP 800-63B except length): 10+ characters, no
 * composition rules, refuse common, contextual and breached passwords. A password from a breach list
 * is the first one an attacker tries, whatever its length.
 * Tier 3 (how): The bundled list is stored as SHA-256 digests of the lowercased password (the repo's
 * rule: ban lists store digests). The breach check uses HIBP's k-anonymity range API: only the first
 * 5 hex characters of the password's SHA-1 leave the server, with padding requested so the response
 * size reveals nothing; the match happens locally. It fails open after 3 seconds or on any error, so an
 * HIBP outage never blocks sign-up. WebCrypto and fetch work in both runtimes.
 */

import crypto from 'crypto';
import { normalizePassword, passwordLength, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/password-policy';

/** SHA-256 of common passwords (lowercased, NFC). Plain text is never stored in the repo. */
const COMMON_PASSWORD_DIGESTS: ReadonlySet<string> = new Set([
  'b3d17ebbe4f2b75d27b6309cfaae1487b667301a73951e7d523a039cd2dfe110',
  'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
  'b9c950640e1b3740e98acb93e669c65766f6670dd1609ba91ff41052ba48c6f3',
  '65c21921ca10a8502757efc9aa552874d181c6206feb2845a921eb57f5e518d4',
  '5751a44782594819e4cb8aa27c2c9d87a420af82bc6a5a05bc7f19c3bb00452b',
  '1000b5df3a988c3cfbd175b8a956703b1b453396c31896e97a4d0153eda1f9cc',
  'c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646',
  '63640264849a87c90356129d99ea165e37aa5fabc1fea46906df1a7ca50db492',
  '17756315ebd47b7110359fc7b168179bf6f2df3646fcc888bc8aa05c78b38ac1',
  '28f0116ef42bf718324946f13d787a1d41274a08335d52ee833d5b577f02a32a',
  '7fd06f0e2a61fec4b93fcf78df8759e5e4e2a2da2f5a627cfad24b801416ebbb',
  '9a900403ac313ba27a1bc81f0932652b8020dac92c234d98fa0b06bf0040ecfd',
  '17f80754644d33ac685b0842a402229adbb43fc9312f7bdf36ba24237a1f1ffb',
  'f6ee94ecb014f74f887b9dcc52daecf73ab3e3333320cadd98bcb59d895c52f5',
  '99c9f119fb21abc99a3a14cf89e3b44c7de3892f5fc9e58c017f80de03d17882',
  'eabc1c385be0b295ec9d66ce5b535849461415b4b95f2c578447dad7b30a2252',
  'b117ef94c554ede113d1296020dc9a5078826e1b27762f49fbbda8445b6a02f2',
  '72399361da6a7754fec986dca5b7cbaf1c810a28ded4abaf56b2106d06cb78b0',
  '60673c6c0bd6de52ddf7b5c890a15e202fab5b567f3c9f49163b4cfc6f6cab6a',
  'dce7a17f9bff4aa7efebf32c3b3a082033be7e5f1031433f12f47e1252afc303',
  '9b0eb22aef89516d6fb4b31ccf008a68abe0d10a3fc606316389613eccf96854',
  'a68349561396ec264a350847024a4521d00beaa3358660c2709a80f31c7acdd0',
  '7d879e9d67750bab78fa850bd75c55dc6dfdcdba78b682901a5c655f04096e08',
  '762daeeccf4aee2077fa9d1b7a0b7adac2201b00c96459fcdca387c797729408',
  'e76ef5923a42fe221d21972ccc5042e16bed81b0429e910b2fa895dee3ac9692',
  '5ace4981999e9122e593ecb67311be9b4e87ea7f97d806b782a9f8c6ac0a6807',
  'ff818cb49d61e74e781e0ef4f0503da46e02328d4c000c20dcd2f9cba238a1b7',
  '421e6d60ea8fa984281ff0710c8e8005471c58e218c25016c2c0643e5ad0336d',
  '6968fd41cd89f4b46eca4dbaea58978650b7b57495aead10cfe49b8cc0d2e3cd',
  '619b799f80d41b27c30fcca99242aee20c4a4262b7ca310a763b3d941e3323ef',
  '5884f798783c02427beaf1c2fea704a8023157864ec7c8a2ca500a73690e203f',
  'e004fe36e295666618a601606e1f0ed26bce7665720ea1130bce6e967a99dfff',
  '494a715f7e9b4071aca61bac42ca858a309524e5864f0920030862a4ae7589be',
  '285d6ef2036cb5fc1b12aae7aa71af5ac939ee6178350bcff9a27dd102bf65ad',
  '41e5653fc7aeb894026d6bb7b2db7f65902b454945fa8fd65a6327047b5277fb',
  '4194d1706ed1f408d5e02d672777019f4d5385c766a8c6ca8acba3167d36a7b9',
  '7c72380bb232311151ad4ab40e965cc7dff18c2afcc2d2584a13b247d1981f15',
  'cebd52f5832e8b090f1eae9a3ca73b824262a7a32edc8f1671d025cbeeee8177',
  '7bde906661fb5217560b095c4e4482f7ed8d601b35e3169d13ae5d391e31e94d',
  '6337f5f46479e89c07cbe68b81705a654d86277ebf2d47d5bf7d04b7d3fd4c45',
  'c23546a58b36d4568ef7ce399d4d78ba418cd732fc2f62e500c7693ca1343375',
  '87d3dc99cb46588e12b5cd74832f7aa1fdc2a3152fbc73ff9843be6d7a26f496',
  'b9c491378514665e5f089452f5df6926b6fa96c2e4669593cf4ea8ac8063a196',
  'ab4d5772c634499c1456bff22f1a7d4b798bc42d3a4f54218158da5b1c80ffa0',
  'd6a10f1fd623b4ba7e9c8552b654dee47cb2195583132d95e0e54ff97661c585',
  'eac75423b1b5745c4781645e2e6280ab72c8f0e331947bf0b06fe4fa21696ef9',
  '5c070cc07ba286f8de7a02f5300885ab3ef15aaad992eb7606a7c63652d1ab09',
  '2ca72e3091c0c18253ce138e9a652d9caf6dc7861da5719e18289eae397bf208',
  '0f21e467f7754592e9ab5e2059ab4b17306786413874fb0f6d8102ba8d7d3c47',
  'd12c7559076a1649d11c4030b536562732660a9cde4947765e3bf459b29c9172',
  'b1ec7c673a7fd2b7c9b375020a0be0bd5dfe7bc4bd7d7dc3775e436c9d0aaa31',
  '1a09e9adbe9f1f3fc2d7f736697d2055fca48acc4662257482f7f3ba06a63b5b',
  '3fc851c7c2cf1502c9089117fb249870613a2f90b14821ceab8f9994311ad43c',
  'fdd92379ce34dc5b58afb9c7742dbd253ecdb54f68a659b3d25b768dcc345142',
  'd592b125806f83242d9e0c1d13eff727a9a467f13defeacd242d6b7fe7a84b48',
  '6c944ff23b3e1d5241bbbc6e80a1b794e5255db5d706839c199ad8216c92b0a2',
  '2889e78f40e4d3dcc54952e9cc1f21dea2bfecbba8143592946cb969c8d94d84',
  '45d2a17b965947d1a3f3197af2b02a32c02a8bc158d5028f6ccfa397c85b9a7e',
  'bf2cb58a68f684d95a3b78ef8f661c9a4e5b09e82cc8f9cc88cce90528caeb27',
  'd2d02ea74de2c9fab1d802db969c18d409a8663a9697977bb1c98ccdd9de4372',
  '84d9c4b849506b6d8f8075a9000e7e0a254be71060ea889fad3c88395988f4fc',
]);

/** Words a password must not be built on: the site itself. */
const SITE_WORDS = ['kovertklaus', 'kovert klaus', 'kovert'];

/** Result of a check: valid, or the reason to show the agent. */
export interface PasswordCheck {
  isValid: boolean;
  error?: string;
}

/** Context that must not make up the password. */
export interface PasswordContext {
  email?: string | null;
  name?: string | null;
}

function digest(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** True for one repeated character, or a run up or down a keyboard/number/alphabet sequence. */
function isTrivialPattern(p: string): boolean {
  const lower = p.toLowerCase();
  if (new Set(lower).size <= 2) return true;
  const runs = ['0123456789012', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm'];
  return runs.some((r) => r.includes(lower) || [...r].reverse().join('').includes(lower));
}

/** The synchronous rules. `context` adds the agent's own email and name to what is refused. */
export function validatePasswordRules(password: string, context: PasswordContext = {}): PasswordCheck {
  if (typeof password !== 'string' || passwordLength(password) < PASSWORD_MIN_LENGTH) {
    return { isValid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.` };
  }
  if (passwordLength(password) > PASSWORD_MAX_LENGTH) {
    return { isValid: false, error: `Password can be at most ${PASSWORD_MAX_LENGTH} characters long.` };
  }
  const normalized = normalizePassword(password);
  const lower = normalized.toLowerCase();
  if (COMMON_PASSWORD_DIGESTS.has(digest(lower)) || isTrivialPattern(normalized)) {
    return { isValid: false, error: 'That password is too common. Try a short phrase only you would think of.' };
  }
  const squeezed = lower.replace(/\s+/g, '');
  const local = (context.email || '').split('@')[0]?.toLowerCase() || '';
  const personal = [local, ...(context.name || '').toLowerCase().split(/\s+/)].filter((w) => w.length >= 4);
  if (SITE_WORDS.some((w) => squeezed.includes(w.replace(/\s+/g, ''))) || personal.some((w) => squeezed.includes(w))) {
    return { isValid: false, error: "Don't build your password from KovertKlaus or your own name or email." };
  }
  return { isValid: true };
}

/** SHA-1 of the normalized password, uppercase hex (the format HIBP returns). */
async function sha1Hex(password: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest('SHA-1', new TextEncoder().encode(normalizePassword(password)));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** HIBP range endpoint. */
export const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

/**
 * True when the password appears in Have I Been Pwned's breach corpus. Sends only a 5-character hash
 * prefix. Returns false (fails open) on a timeout, a network error or an unexpected reply.
 */
export async function isBreachedPassword(
  password: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 3000
): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${HIBP_RANGE_URL}${prefix}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'KovertKlaus-password-check' },
        signal: controller.signal,
      });
      if (!res.ok) return false;
      const body = await res.text();
      for (const line of body.split('\n')) {
        const [candidate, count] = line.trim().split(':');
        // Padding entries have a count of 0.
        if (candidate === suffix && Number(count) > 0) return true;
      }
      return false;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn('[PasswordCheck] breach check unavailable, allowing the password:', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Reply when the password appeared in a breach. */
export const BREACHED_PASSWORD_MESSAGE =
  'That password has appeared in a data breach elsewhere, so attackers try it first. Please choose a different one.';

/**
 * The full check for a new password: rules first, then the breach check.
 *
 * @param deps.fetchImpl - Injectable for tests.
 */
export async function checkNewPassword(
  password: string,
  context: PasswordContext = {},
  deps: { fetchImpl?: typeof fetch } = {}
): Promise<PasswordCheck> {
  const rules = validatePasswordRules(password, context);
  if (!rules.isValid) return rules;
  if (await isBreachedPassword(password, deps.fetchImpl)) return { isValid: false, error: BREACHED_PASSWORD_MESSAGE };
  return { isValid: true };
}
