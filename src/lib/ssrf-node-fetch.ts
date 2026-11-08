/**
 * @file ssrf-node-fetch.ts
 * @description Node-only `fetch` for the product scraper that refuses to connect to non-public addresses.
 *
 * Tier 1 (what): `createSsrfSafeFetch` returns a `fetch` whose sockets can only reach public
 * unicast addresses. `isPublicAddress` is the address classifier behind it.
 * Tier 2 (why): `isSafePublicUrl` judges the URL text only. A public domain whose DNS record points
 * at `192.168.x.x` passed it, so a self-hosted Node server could be steered into the owner's LAN.
 * Resolving first and fetching second would leave a DNS-rebinding gap (the record can change between
 * the check and the connection), so the check runs inside the socket's own DNS lookup: the address
 * that is validated is the address that is connected to.
 * Tier 3 (how): An undici `Agent` gets a `connect.lookup` hook that resolves every address for the
 * hostname and fails if any of them is non-public. Literal IP hosts skip DNS lookup in `net.connect`,
 * so they are classified before the request. Blocked connections surface as `ProductFetchError`
 * with reason `BLOCKED_ADDRESS`, which the scraper logs as `BLOCKED_SSRF`. Cloudflare Workers cannot
 * use this module (no socket-level DNS hook) and do not need it: the Workers runtime cannot reach
 * private networks, so `src/worker.ts` keeps the runtime `fetch`.
 */

import dns from 'node:dns';
import net from 'node:net';
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici';
import { ProductFetchError } from './product-fetch';

/** IPv4 ranges that are not public unicast (IANA special-purpose registry). */
const NON_PUBLIC_IPV4: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
];

/**
 * IPv6 ranges that are not public unicast. IPv4-mapped addresses (`::ffff:a.b.c.d`) need no rule of
 * their own: `BlockList` matches them against the IPv4 rules above. A `::ffff:0:0/96` rule would do
 * the reverse and match every IPv4 address.
 */
const NON_PUBLIC_IPV6: ReadonlyArray<readonly [string, number]> = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64 (embeds an IPv4 address)
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard
  ['2001::', 23], // IETF protocol assignments, incl. Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 (embeds an IPv4 address)
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // deprecated site-local
  ['ff00::', 8], // multicast
];

const NON_PUBLIC = new net.BlockList();
for (const [address, prefix] of NON_PUBLIC_IPV4) NON_PUBLIC.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of NON_PUBLIC_IPV6) NON_PUBLIC.addSubnet(address, prefix, 'ipv6');

/**
 * True when `address` is a literal IPv4 or IPv6 address in public unicast space.
 *
 * @param address - IP address without brackets (e.g. `93.184.216.34`, `2606:4700::1111`).
 * @returns `false` for anything that is not an IP literal or falls in a non-public range.
 */
export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return false;
  return !NON_PUBLIC.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

const BLOCKED_CODE = 'ERR_SSRF_BLOCKED_ADDRESS';

/** Raised inside the socket lookup when a hostname resolves to a non-public address. */
class BlockedAddressError extends Error implements NodeJS.ErrnoException {
  readonly code = BLOCKED_CODE;

  constructor(hostname: string, address?: string) {
    super(address ? `${hostname} resolves to non-public address ${address}` : `${hostname} has no addresses`);
    this.name = 'BlockedAddressError';
  }
}

/** `dns.lookup` in its `all: true` form, injectable for tests. */
export type ResolveAll = (
  hostname: string,
  options: dns.LookupAllOptions,
  callback: (error: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void,
) => void;

const systemResolveAll: ResolveAll = (hostname, options, callback) => dns.lookup(hostname, options, callback);

/**
 * Builds a `net.connect` lookup that only yields public addresses.
 *
 * @param resolveAll - Resolver returning every address for a hostname (defaults to `dns.lookup`).
 * @param isAllowed - Address classifier (defaults to `isPublicAddress`).
 * @returns A lookup that fails with `ERR_SSRF_BLOCKED_ADDRESS` if any resolved address is not allowed,
 * so a record mixing public and private addresses cannot be used to reach the private one.
 */
export function createGuardedLookup(
  resolveAll: ResolveAll = systemResolveAll,
  isAllowed: (address: string) => boolean = isPublicAddress,
): net.LookupFunction {
  return (hostname, options, callback) => {
    resolveAll(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        callback(error, '', 0);
        return;
      }
      const list = addresses ?? [];
      const blocked = list.find((entry) => !isAllowed(entry.address));
      if (list.length === 0 || blocked) {
        callback(new BlockedAddressError(hostname, blocked?.address), '', 0);
        return;
      }
      if (options.all) {
        callback(null, list);
      } else {
        callback(null, list[0].address, list[0].family);
      }
    });
  };
}

/** Finds a `BlockedAddressError` anywhere in an error's `cause` chain or `AggregateError` list. */
function findBlocked(error: unknown, depth = 0): Error | null {
  if (!(error instanceof Error) || depth > 5) return null;
  if ((error as NodeJS.ErrnoException).code === BLOCKED_CODE) return error;
  if (error instanceof AggregateError) {
    for (const inner of error.errors) {
      const found = findBlocked(inner, depth + 1);
      if (found) return found;
    }
  }
  return findBlocked(error.cause, depth + 1);
}

/** Options for `createSsrfSafeFetch`; both are for tests. */
export interface SsrfSafeFetchOptions {
  resolveAll?: ResolveAll;
  isAllowed?: (address: string) => boolean;
}

/** A guarded `fetch` plus `close`, which releases its pooled connections. */
export type SsrfSafeFetch = typeof fetch & { close: () => Promise<void> };

/**
 * Creates a `fetch` for untrusted URLs that can only connect to public addresses.
 * Pass it to `fetchProductPage` as `fetchImpl`; every redirect hop goes through the same check.
 *
 * @param options - Optional resolver and classifier overrides.
 * @returns The guarded fetch. Blocked targets reject with `ProductFetchError` (`BLOCKED_ADDRESS`)
 * before any request bytes are sent.
 */
export function createSsrfSafeFetch(options: SsrfSafeFetchOptions = {}): SsrfSafeFetch {
  const isAllowed = options.isAllowed ?? isPublicAddress;
  const dispatcher = new Agent({ connect: { lookup: createGuardedLookup(options.resolveAll, isAllowed) } });

  const guardedFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) !== 0 && !isAllowed(host)) {
      throw new ProductFetchError(`Address ${host} is not public`, 'BLOCKED_ADDRESS');
    }
    try {
      const undiciInit = { ...init, dispatcher } as unknown as UndiciRequestInit;
      return (await undiciFetch(url, undiciInit)) as unknown as Response;
    } catch (error) {
      const blocked = findBlocked(error);
      if (blocked) throw new ProductFetchError(blocked.message, 'BLOCKED_ADDRESS');
      throw error;
    }
  };

  return Object.assign(guardedFetch, { close: () => dispatcher.close() }) as SsrfSafeFetch;
}
