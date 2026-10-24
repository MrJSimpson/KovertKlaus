/**
 * @file product-fetch.ts
 * @description Fetches a product page for the scraper, shared by the edge worker and the Next.js route.
 *
 * Tier 1 (what): `fetchProductPage` downloads a store page within one time budget, following at most
 * `MAX_PRODUCT_REDIRECTS` redirects, and re-checks every redirect target with `isSafePublicUrl`.
 * Tier 2 (why): Both runtimes used `redirect: 'error'` so a public link could not redirect to an
 * internal address. Cloudflare Workers rejects that value before sending anything, so every SaaS
 * scrape failed silently. `redirect: 'manual'` works in Workers and Node alike.
 * Tier 3 (how): Each hop is fetched with `redirect: 'manual'`; a 3xx `Location` is resolved against
 * the current URL and validated before it is followed. Failures throw `ProductFetchError` with a
 * `reason` the caller logs. `fetchImpl` is injectable for tests.
 */

import { isSafePublicUrl } from './security';

/** Redirects followed before giving up (e.g. http → https → www → regional store). */
export const MAX_PRODUCT_REDIRECTS = 3;

/** Total time budget across all hops, so the manual-entry fallback opens quickly. */
export const PRODUCT_FETCH_TIMEOUT_MS = 2500;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Why a product page could not be fetched. */
export type ProductFetchFailure =
  | 'TIMEOUT'
  | 'BLOCKED_REDIRECT'
  | 'TOO_MANY_REDIRECTS'
  | 'HTTP_STATUS'
  | 'NETWORK';

/** A failed product page fetch, with a reason for the scraper log. */
export class ProductFetchError extends Error {
  constructor(
    message: string,
    readonly reason: ProductFetchFailure,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProductFetchError';
  }
}

/** A fetched product page. */
export interface ProductPage {
  html: string;
  /** URL the HTML came from, after redirects. */
  finalUrl: string;
  redirects: number;
}

/** Options for `fetchProductPage`. */
export interface ProductFetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Fetches `url` (already checked with `isSafePublicUrl`), following safe redirects only.
 * Throws `ProductFetchError` on a timeout, an unsafe or excessive redirect, a non-2xx status or a
 * network failure.
 */
export async function fetchProductPage(url: string, options: ProductFetchOptions = {}): Promise<ProductPage> {
  const { timeoutMs = PRODUCT_FETCH_TIMEOUT_MS, maxRedirects = MAX_PRODUCT_REDIRECTS, fetchImpl = fetch } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let current = url;
    for (let redirects = 0; ; redirects++) {
      const response = await fetchImpl(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: REQUEST_HEADERS,
      });

      const location = response.headers.get('location');
      if (REDIRECT_STATUSES.has(response.status) && location) {
        await response.body?.cancel().catch(() => {});
        if (redirects >= maxRedirects) {
          throw new ProductFetchError(`More than ${maxRedirects} redirects`, 'TOO_MANY_REDIRECTS', response.status);
        }
        const next = new URL(location, current).toString();
        const check = isSafePublicUrl(next);
        if (!check.safe) {
          throw new ProductFetchError(`Redirect to ${next} blocked: ${check.error}`, 'BLOCKED_REDIRECT', response.status);
        }
        current = next;
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new ProductFetchError(`HTTP ${response.status}`, 'HTTP_STATUS', response.status);
      }

      return { html: await response.text(), finalUrl: current, redirects };
    }
  } catch (error) {
    if (error instanceof ProductFetchError) throw error;
    if (controller.signal.aborted) {
      throw new ProductFetchError(`No response within ${timeoutMs} ms`, 'TIMEOUT');
    }
    throw new ProductFetchError(error instanceof Error ? error.message : String(error), 'NETWORK');
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Scraper log action and details for a failed fetch (`logScraperEvent`). */
export function describeFetchFailure(error: unknown): {
  action: 'BLOCKED_SSRF' | 'TIMEOUT' | 'SCRAPE_FAILURE';
  details: Record<string, unknown>;
} {
  if (error instanceof ProductFetchError) {
    const action = error.reason === 'BLOCKED_REDIRECT' ? 'BLOCKED_SSRF' : error.reason === 'TIMEOUT' ? 'TIMEOUT' : 'SCRAPE_FAILURE';
    return { action, details: { reason: error.reason, status: error.status, error: error.message.slice(0, 300) } };
  }
  // Fetched fine, but parsing or saving the page failed
  return { action: 'SCRAPE_FAILURE', details: { reason: 'PROCESSING', error: (error instanceof Error ? error.message : String(error)).slice(0, 300) } };
}
