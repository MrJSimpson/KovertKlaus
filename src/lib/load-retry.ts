/**
 * @file load-retry.ts
 * @description Page-load fetches that wait out a waking database instead of failing.
 *
 * Tier 1 (what): `fetchJsonWithRetry` fetches a JSON endpoint and retries server errors and network
 * failures on a fixed schedule (about half a minute in all), calling `onRetry` before each wait.
 * Tier 2 (why): Neon's scale-to-zero compute can take longer to wake than the server's own retries,
 * so the first loads of the day failed and the mission page showed "Operation Access Denied" to
 * agents who had access. Pages now keep their loading screen while the database wakes. Client
 * errors (401, 403, 404) are real answers and return at once.
 * Tier 3 (how): No imports, so client components can use it. A body that is not JSON (an edge error
 * page) counts as a failed attempt. After the last attempt the last response is returned, or the
 * last network error thrown. `fetchFn` and `sleep` are injectable for tests.
 */

/** Waits between attempts: seven attempts over about 27 seconds. */
export const LOAD_RETRY_DELAYS_MS = [1000, 2000, 3000, 5000, 8000, 8000];

/** A loaded response: HTTP status and the parsed body (`{}` when the body was not JSON). */
export interface LoadResult {
  status: number;
  ok: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each page reads its endpoint's own fields
  json: any;
}

/** Whether a response status is worth retrying (server-side and gateway errors, not 501). */
export function isRetryableStatus(status: number): boolean {
  return status >= 500 && status !== 501;
}

/**
 * Fetches `url` and parses JSON, retrying server errors and network failures.
 *
 * @param onRetry - Called with the attempt number (1-based) before each wait, e.g. to show "waking up".
 */
export async function fetchJsonWithRetry(
  url: string,
  options: {
    init?: RequestInit;
    onRetry?: (attempt: number) => void;
    delays?: number[];
    fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
    sleep?: (ms: number) => Promise<void>;
  } = {}
): Promise<LoadResult> {
  const delays = options.delays ?? LOAD_RETRY_DELAYS_MS;
  const fetchFn = options.fetchFn ?? ((u, i) => fetch(u, i));
  const sleep = options.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));

  for (let attempt = 0; ; attempt++) {
    const last = attempt >= delays.length;
    let result: LoadResult | null = null;
    try {
      const res = await fetchFn(url, options.init);
      const json = await res.json().catch(() => null);
      // A 2xx with an unreadable body is as broken as a 5xx (an edge error page served as 200).
      const status = json === null && res.ok ? 502 : res.status;
      result = { status, ok: res.ok && json !== null, json: json ?? {} };
    } catch (err) {
      if (last) throw err;
    }
    if (result && (last || !isRetryableStatus(result.status))) return result;
    options.onRetry?.(attempt + 1);
    await sleep(delays[attempt]);
  }
}
