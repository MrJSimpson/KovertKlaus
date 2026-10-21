# KovertKlaus 🕵️‍♂️🎄

**Stealth Intelligence Gift Exchange Network & Reliability Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](./LICENSE.md)
[![Target Release](https://img.shields.io/badge/Release-v0.2.0--alpha-emerald.svg)](./CHANGELOG.md)
[![Runtime](https://img.shields.io/badge/Runtime-Node.js%2024%20%2B%20Next.js%2016-blueviolet.svg)](./docs/ARCHITECTURE.md)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2017-green.svg)](./docs/DEPLOYMENT_GUIDE.md)
[![Security Policy](https://img.shields.io/badge/Security-HMAC--SHA256%20%2B%20Anti--SSRF-red.svg)](./SECURITY.md)

> [!IMPORTANT]
> **ACTIVE RELEASE: `v0.2.0-alpha` (Self-Hosted Community Edition)**  
> Clean Database Architecture | Internal Workshop Benches (`/workshop`) | NIST SP 800-63B Auth  
> Contributions welcome: see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

KovertKlaus turns standard Secret Santa and White Elephant gift exchanges into engaging, covert holiday missions. Featuring automated reliability tracking (Coal Citations), per-mission Wishlist Manifests, automated product metadata scraping, 100% bidirectional match exclusion rules, single-circle target draws, circle-preserving target swaps, phase-scoped Head Elf command consoles, After-Action Reports (AAR), and containerized PostgreSQL database management.

---

## 📚 Complete Documentation Suite

All system documentation is maintained in both standard repository Markdown and open-source **LibreOffice / Draw.io** formats:

| Document | Topic & Scope | Open Formats |
| :--- | :--- | :--- |
| 🏛️ **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** | Full System Topology, Edge Worker Gateway & Sattolo Matching | [Draw.io Diagram](./docs/kovertklaus_system_topology.drawio) |
| 📡 **[`docs/API_REFERENCE.md`](./docs/API_REFERENCE.md)** | Complete REST API Catalog (Auth, Missions, Manifests, Admin) | [ODT Runbook](./docs/KovertKlaus_Knowledge_Base.odt) |
| 🚀 **[`docs/DEPLOYMENT_GUIDE.md`](./docs/DEPLOYMENT_GUIDE.md)** | Cloudflare Workers + Neon PostgreSQL & Docker Setup | [ODS Env Matrix](./docs/KovertKlaus_Configuration_Matrix.ods) |
| 🔒 **[`docs/SECURITY_INVARIANTS.md`](./docs/SECURITY_INVARIANTS.md)** | HMAC-SHA256 Sessions, Parameter Tampering & SSRF Defense | [`SECURITY.md`](./SECURITY.md) |
| ⚖️ **[`docs/DEMERIT_SYSTEM.md`](./docs/DEMERIT_SYSTEM.md)** | Coal Citation State Machine, Waivers & Auto-Rehabilitation | [Draw.io State Machine](./docs/kovertklaus_demerit_state_machine.drawio) |
| ✉️ **[`docs/EMAIL_SYSTEM.md`](./docs/EMAIL_SYSTEM.md)** | Multi-Provider Engine with 3-Attempt Exponential Retries | [Draw.io Flow](./docs/kovertklaus_universal_email_architecture.drawio) |
| 🏷️ **[`docs/VERSIONING.md`](./docs/VERSIONING.md)** | When versions change, release checklist, branch pruning, where history is recorded | [`CHANGELOG.md`](./CHANGELOG.md) |
| 🧪 **[`docs/DEMO_DATABASE.md`](./docs/DEMO_DATABASE.md)** | Try it locally: demo agents and missions in one command (self-hosted only) | `npm run demo:load` |
| 🗄️ **Prisma Database Schema** | Relational Entities, Foreign Keys & Schema Indexes | [Draw.io ERD](./docs/kovertklaus_database_erd.drawio) |

---

## 🌟 Key Product Capabilities

- 🎲 **Sattolo Derangement Matching Engine**: Eliminates chain predictability. No operative can draw themselves ($A \neq B$), and cyclic chains are randomized using cryptographically secure random numbers (`src/lib/draw.ts`).
- 🚫 **100% Bidirectional Exclusion Rules ($A \iff B$)**: Prevents blocked pairs (spouses, household members) from being matched in either direction.
- 🎯 **Mobile-First Tap-to-Swap Modal**: Allows Head Elves to reassign a target ($A \to T$) without complex line-dragging UI; $T$ moves into place so the gift circle stays unbroken.
- 🎖️ **Phase-Scoped Head Elf Admin Console**: Action buttons dynamically align with mission stages (`RECRUITING` ➔ `SETUP` ➔ `SHIPPED` ➔ `EXECUTED` ➔ `COMPLETED`).
- ⚠️ **Demerit Reliability & Auto-Rehabilitation**: 
  - `0-2 Coal Citations`: `ACTIVE` (Full access across all remote and local missions).
  - `3 Coal Citations`: `REMOTE_RESTRICTED` (Relegated strictly to local/in-person events).
  - `>3 Coal Citations`: `DISABLED` (Suspended).
  - **Carrier Protection Waiver**: Submitting tracking numbers waives penalties if parcels are lost by carriers.
  - **Automatic Rehabilitation**: Successful mission completion automatically removes `-1` coal citation.
- 🔎 **Anti-SSRF Product Scraper**: OpenGraph scraper with strict loopback/private CIDR filtering and 2.5s fast-failover timeout for adding items to Wishlist Manifests.
- 📧 **Universal Transactional Email Dispatcher**: Pluggable adapter engine supporting **Brevo REST API** (300 free emails/day, 100% edge-safe), **Direct SMTP** (`nodemailer` for self-hosted home users), **Resend API**, and an automatic **Console Mock** fallback for local dev.

---

## 🚀 Quick Start (Self-Hosting for Personal / Family Use)

### 🐧 Linux Startup & Shutdown Scripts
```bash
# Start PostgreSQL database + Next.js dev server (Interactive)
./start.sh              # or ./start-kovertklaus.sh

# Options:
./start.sh --detach     # Run dev server in background (logs to kovertklaus.log)
./start.sh --open       # Automatically open http://localhost:3000 in browser
./start.sh --prod       # Run full stack in production Docker mode

# Stop all KovertKlaus services (Dev server + Docker containers)
./stop.sh               # or ./stop-kovertklaus.sh
```

### 🐳 Full Docker Compose Mode
```bash
# 1. Clone repository
git clone https://github.com/MrJSimpson/KovertKlaus.git
cd KovertKlaus

# 2. Launch PostgreSQL database and App container
docker compose up -d

# 3. Load demo agents and missions to try it out (optional; see docs/DEMO_DATABASE.md)
npm run demo:load

# 4. Open browser
http://localhost:3000
```

### 🎅 North Pole Command Center & Developer Workshop
- **Admin HUD**: Navigate to [`/northpole`](http://localhost:3000/northpole)
- **First-Run Setup**: No default password ships. On first launch the server prints a one-time setup token to its console (`docker logs kovertklaus-app`); open [`/northpole/setup`](http://localhost:3000/northpole/setup) to create your administrator.
- **NIST SP 800-63B Compliance**: Administrator passphrases require 12+ characters and can never be a known default.
- **Developer Workshop (`/workshop`)**: This self-hosted repository includes all internal QA test benches (`/workshop/draw`, `/workshop/lifecycle`, `/workshop/scraper`, `/workshop/theme`, `/workshop/manifest`, `/workshop/party`, `/workshop/aar`).
- **Clean Database**: Production seeds contain zero dummy users or mock exchanges. Demo data is strictly opt-in (`npm run demo:load`) and removable.

---

## 🛠️ One-Click DevOps Suite (Windows)

| Action | Command / Double-Click Script | Description |
| :--- | :--- | :--- |
| **Launch Server** | [`run-kovertklaus.bat`](./run-kovertklaus.bat) | Checks port 3000 and starts `npm run dev` in a dedicated background window. |
| **Stop Server** | [`stop-kovertklaus.bat`](./stop-kovertklaus.bat) | Gracefully terminates any process listening on port 3000. |
| **Back Up DB** | [`export-db.bat`](./export-db.bat) | Dumps the PostgreSQL container database to `backups/kovertklaus-backup.dump` (gitignored: real data) and keeps the previous backup as `kovertklaus-backup.prev.dump`. |
| **Restore DB** | [`restore-db.bat`](./restore-db.bat) | Replaces the container database with `backups/kovertklaus-backup.dump` (an older `kovertklaus-backup.sql` also works). |
| **Try the Demo** | `npm run demo:load` / `npm run demo:remove` | Loads or removes demo agents and missions ([`docs/DEMO_DATABASE.md`](./docs/DEMO_DATABASE.md)). |

---

## 🧪 Running Automated Test Suites

```bash
# Edge Worker & Next.js API Parity Test
npx tsx src/worker.test.ts

# Sattolo Target Matching & Exclusion Constraints
npx tsx src/lib/draw.test.ts

# Database Connection Pool Lifecycle & Transactions
npx tsx src/lib/db.test.ts

# Cryptographic Token Verification & Anti-SSRF Guardrails
npx tsx src/lib/security.test.ts

# Demerit State Machine & Carrier Protection Waivers
npx tsx src/lib/demerits.test.ts

# Universal Email Dispatcher & Exponential Backoff Retries
npx tsx src/lib/email/email.test.ts

# Full TypeScript Compilation & Static Export
npx tsc --noEmit
npm run build
```

---

## 🤝 Contributing & Code of Conduct

We welcome community contributions! Please review our guidelines before submitting pull requests:
- 📖 [Contributing Guidelines (`CONTRIBUTING.md`)](./CONTRIBUTING.md)
- 📜 [Code of Conduct (`CODE_OF_CONDUCT.md`)](./CODE_OF_CONDUCT.md)
- 🔒 [Security Policy (`SECURITY.md`)](./SECURITY.md)

---

## 📜 Licensing & Commercial Rights

- **Open-Core License**: Licensed under the [MIT License](./LICENSE.md).
- **Commercial SaaS Reservation**: Rights to operate and monetize KovertKlaus as a commercial SaaS service at `kovertklaus.com` are managed by **Joshua Simpson**.
