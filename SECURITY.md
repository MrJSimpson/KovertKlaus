# Security Policy & Defensive Architecture 🔒

At **KovertKlaus**, security, cryptographic integrity, and operative privacy are paramount. This document outlines our security policy, vulnerability disclosure process, and foundational defensive engineering architecture.

---

## 🛡️ Supported Versions

We actively maintain and provide security updates for the following release lines:

| Version | Status | Security Support |
| :--- | :--- | :--- |
| `0.1.x-prealpha` | Active Development | Full (Current) |
| `< 0.1.0` | Deprecated | None |

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
- **Signed Tokens Only**: Session cookies (`kovertklaus_session`) and tokens contain an explicit HMAC-SHA256 signature generated with the server's `SESSION_SECRET`:
  $$\text{Token} = \text{userId} \parallel \text{"."} \parallel \text{HMAC-SHA256}(\text{userId}, \text{secret})$$
- **Constant-Time Verification**: All token signature validations utilize `crypto.timingSafeEqual` to prevent side-channel timing attacks.
- **Unsigned UUID Rejection**: Raw, unsigned UUIDs or malformed identifiers are immediately rejected at the controller boundary.

### 2. Parameter Tampering & Identity Isolation
- **No Identity Fallbacks**: Authenticated endpoints derive the active user's identity strictly from the verified cryptographic session context.
- **Explicit Parameter Rejection**: Identity cannot be overridden or passed via request bodies (`body.userId`) or query strings (`?userId=...`). Any mismatched identity in mutating operations results in an immediate `403 Forbidden` or `401 Unauthorized`.

### 3. Zero-Trust E-Commerce Link Scraper & Anti-SSRF Defense
To allow operatives to paste product URLs into their Wishlist Manifests without exposing the server to Server-Side Request Forgery (SSRF), all external URL fetching in `src/lib/scraper.ts` enforces:
- **Protocol Whitelisting**: Strictly `http:` and `https:`.
- **IP Format Disambiguation**: Blocks alternative IP notations (decimal `2130706433`, hexadecimal `0x7f000001`, octal, or IPv6 embedded).
- **Private & Cloud Metadata Range Blocking**: Blocks `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254` (AWS/GCP metadata), `0.0.0.0/8`, and DNS rebinding wildcard domains (`*.nip.io`, `*.sslip.io`).
- **Strict Redirect Denial**: Fetch operations explicitly set `redirect: 'error'` to prevent redirect-based SSRF bypasses.
- **Fast Failover**: Scraper operations abort after 2500ms to eliminate socket-hanging denial-of-service vectors.

### 4. Server-Side PII & Target Graph Isolation
- **Zero Client-Side Filtering for PII**: Sensitive exchange data—including Secret Santa target assignments, recipient physical shipping addresses, and exclusion graph matrices—is filtered and redacted at the database query and controller layer before payload serialization.
- **Organizer Target Protection**: Even the Head Elf / Organizer cannot view who is assigned to whom prior to event execution, preserving complete mission secrecy.

### 5. Cryptographically Secure Pseudo-Random Number Generation (CSPRNG)
- **Rejection-Sampled CSPRNG**: Target derangement (Sattolo matching algorithm in `src/lib/draw.ts`) and security tokens utilize Web Crypto / Node CSPRNG (`crypto.getRandomValues` / `crypto.randomBytes`).
- **Zero Modulo Bias**: Integer mapping applies rejection sampling to guarantee uniform distribution across all participants. `Math.random()` is banned across the entire codebase.

---

## 🧪 Security Regression Testing

The security invariants are continuously validated by our automated test suite:
```bash
npx tsx src/lib/security.test.ts
npx tsx src/worker.test.ts
```
All automated tests must pass with 0 errors before any pull request or deployment is approved.
