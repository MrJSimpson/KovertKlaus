/**
 * @file exchange-route.ts
 * @description Serving `/exchange/<code>` from the static export.
 *
 * Tier 1 (what): `rewriteExchangeShellPath` maps any mission URL to the one prerendered shell,
 * `/exchange/preview`; `resolveExchangeCode` recovers the real code on the client.
 * Tier 2 (why): The SaaS build is a static export, and `generateStaticParams` can only list codes
 * known at build time, so only `/exchange/preview` exists in `out/`. Without a rewrite every real
 * mission link (dashboard, invites, nudges, refresh) hit the 404 page. The shell's own route
 * params also say `preview`, so the page must read the code from the browser URL.
 * Tier 3 (how): The worker rewrites HTML and Next's RSC/segment payload requests
 * (`<code>.txt`, `<code>/__next.*.txt`) to the shell before falling back to static assets.
 */

/** The only `/exchange/[code]` page the static export builds. */
export const EXCHANGE_SHELL_CODE = 'preview';

const CODE_PATTERN = /^[A-Za-z0-9-]{3,16}$/;
const EXCHANGE_PATH = /^\/exchange\/([^/]+?)(\.txt|\.html)?(\/.*)?$/;

/**
 * Returns the asset path to serve for a mission URL, or null when no rewrite applies.
 *
 * @param pathname - Request path, e.g. `/exchange/KKJA-CM7P`.
 */
export function rewriteExchangeShellPath(pathname: string): string | null {
  const m = pathname.match(EXCHANGE_PATH);
  if (!m) return null;
  const [, code, ext = '', rest = ''] = m;
  if (code.toLowerCase() === EXCHANGE_SHELL_CODE || !CODE_PATTERN.test(code)) return null;
  return `/exchange/${EXCHANGE_SHELL_CODE}${ext}${rest}`;
}

/**
 * The mission code the page should load, upper-cased.
 *
 * @param paramCode - `useParams().code` (always `preview` on the static shell).
 * @param browserPath - `window.location.pathname`, or null during prerender.
 */
export function resolveExchangeCode(paramCode: unknown, browserPath: string | null): string {
  const fromUrl = browserPath?.match(/^\/exchange\/([^/.]+)/)?.[1];
  const code = fromUrl ? decodeURIComponent(fromUrl) : typeof paramCode === 'string' ? paramCode : '';
  return code.toUpperCase();
}
