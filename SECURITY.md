# Security Policy & Defensive Architecture 🔒

At **KovertKlaus**, security, cryptographic integrity, and operative privacy are paramount. This document outlines our security policy, vulnerability disclosure process, and foundational defensive engineering architecture.

---

## 🛡️ Supported Versions

We actively maintain and provide security updates for the following release lines:

| Version | Status | Security Support |
| :--- | :--- | :--- |
| `1.1.x-beta` | Current beta | Full |
| `< 1.1.0` | Superseded | None (upgrade to the latest release) |

Security fixes ship as patch releases on the current line (see [`docs/VERSIONING.md`](./docs/VERSIONING.md)).

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability or potential exploit within KovertKlaus, please do **NOT** disclose it publicly via GitHub Issues, Discussions, or social media.

Instead, please send an encrypted or direct disclosure report to:
✉️ **`admin@kovertklaus.com`**

### What to Include in Your Report
1. **Description**: A clear summary of the issue, affected endpoint(s), and potential impact.
2. **Steps to Reproduce**: A minimal, reproducible proof-of-concept (PoC) or script.
3. **Environment**: Version, deployment mode (Cloudflare Edge Worker or Self-Hosted Docker), and relevant configuration flags.

### Response SLA
- **Initial Acknowledgment**: Within 24 hours.
- **Triage & Assessment**: Within 72 hours.
- **Remediation & Patch Release**: Within 7 business days for critical vulnerabilities.

---

## 🏛️ Core Security Invariants

KovertKlaus enforces five defensive layers at the architectural level:

### 1. Cryptographic Session Tokens & Constant-Time Verification
- **Signed, Expiring Tokens**: Session cookies (`kovertklaus_session`, `kovertklaus_admin_session`) carry a payload of session kind, subject ID and expiry, signed with HMAC-SHA256 under the server's `SESSION_SECRET` (`src/lib/session-token.ts`):
  $$\text{Token} = \text{kind} \parallel \text{"."} \parallel \text{subjectId} \parallel \text{"."} \parallel \text{expiresAt} \parallel \text{"."} \parallel \text{HMAC-SHA256}(\text{payload}, \text{secret})$$
- **Bounded Lifetimes**: User sessions last 24 hours and renew while the agent stays active; admin sessions last 8 hours and never renew. Because kind and expiry are inside the signature, an expired token, or a user token presented as an admin token, is rejected even if a client keeps it. Older tokens without kind or expiry are rejected outright.
- **Revocation on Password Change**: Changing a password revokes every user token issued before the change, signing out all other devices.
- **Constant-Time Verification**: Signature checks use `crypto.timingSafeEqual` to prevent timing side channels.
- **Unsigned UUID Rejection**: Raw, unsigned UUIDs or malformed identifiers are immediately rejected at the controller boundary.

### 2. Parameter Tampering & Identity Isolation
- **No Identity Fallbacks**: Authenticated endpoints derive the active user's identity strictly from the verified cryptographic session context.
- **Explicit Parameter Rejection**: Identity cannot be overridden or passed via request bodies (`body.userId`) or query strings (`?userId=...`). Any mismatched identity in mutating operations results in an immediate `403 Forbidden` or `401 Unauthorized`.

### 3. Zero-Trust E-Commerce Link Scraper & Anti-SSRF Defense
Operatives can paste product URLs into their Wishlist Manifests. To keep that from becoming Server-Side Request Forgery (SSRF), every URL is checked by `isSafePublicUrl` (`src/lib/security.ts`) before it is fetched by `fetchProductPage` (`src/lib/product-fetch.ts`):
- **Protocol Allowlist**: Only `http:` and `https:`. URLs with embedded credentials (`user:pass@host`) are refused.
- **Alternative IP Notations**: Integer (`2130706433`), hexadecimal (`0x7f000001`) and octal host forms are refused.
- **Private, Local & Metadata Ranges**: Refuses `localhost`, `.local`, `.internal`, `.lan` and single-label hostnames; IPv4 `0.0.0.0/8`, `10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16` (including cloud metadata `169.254.169.254`), `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10` and `198.18.0.0/15`; IPv6 loopback, unique-local and link-local addresses; and wildcard-DNS services such as `nip.io` and `sslip.io`.
- **Re-Checked Redirects**: Redirects are followed manually (`redirect: 'manual'`), at most 3 hops, and every redirect target passes the same check before it is requested.
- **Fast Failover**: All hops share one 2500 ms budget, after which the request is aborted and the manual-entry form opens.
- **Connect-Time Address Check (Node / self-hosted)**: The URL checks above only see the hostname's text, so a public domain whose DNS points at a private address (e.g. `lvh.me` → `127.0.0.1`) would pass them. On Node, the scraper therefore fetches through `createSsrfSafeFetch` (`src/lib/ssrf-node-fetch.ts`): the socket's own DNS lookup refuses to connect if **any** resolved address is outside public unicast space (every IPv4 and IPv6 special-purpose range, including IPv4-mapped, NAT64 and 6to4 forms), and literal IP hosts are classified the same way. Because the address checked is the address connected to, a DNS record that changes between check and connection (DNS rebinding) does not get through. This applies to every redirect hop.
- **Hosted Service (Cloudflare Workers)**: The Workers runtime has no socket-level DNS hook, so this layer does not run there; Workers `fetch` cannot reach private networks in the first place.

### 4. Server-Side PII & Target Graph Isolation
- **Zero Client-Side Filtering for PII**: Sensitive exchange data—including Secret Santa target assignments, recipient physical shipping addresses, and exclusion graph matrices—is filtered and redacted at the database query and controller layer before payload serialization.
- **Who Sees Assignments**: Each Elf Agent sees only their own target. The mission's Head Elf can see every assignment, because target swaps and mission repair need it; the Head Elf's view of a target's dossier fields is further limited by that target's own privacy toggles (`src/lib/exchange-view.ts`). Everyone else in a mission is shown by codename.

### 5. Cryptographically Secure Pseudo-Random Number Generation (CSPRNG)
- **CSPRNG Only**: All randomness (the target draw in `src/lib/draw.ts`, invite codes, Kovert Delivery keys, tokens and IDs) comes from Web Crypto / Node CSPRNG (`crypto.getRandomValues` / `crypto.randomFillSync`) through `src/lib/security.ts`. With no CSPRNG available it throws instead of degrading. `Math.random()` is not used anywhere in `src/` or `scripts/`, and `src/lib/random-source.test.ts` fails the build if it returns.
- **Zero Modulo Bias**: Random integers for the draw use rejection sampling (`getSecureRandomInt`), so every participant order is equally likely.

---

## 🧪 Security Regression Testing

The security invariants are continuously validated by our automated test suite:
```bash
npm test
```
The most relevant suites are `src/lib/security.test.ts` (SSRF guard, CSPRNG), `src/lib/session-token.test.ts` (signed, expiring sessions), `src/lib/product-fetch.test.ts` (redirect re-checks) and `src/worker.test.ts` (edge/Node parity).
All automated tests must pass with 0 errors before any pull request or deployment is approved.
