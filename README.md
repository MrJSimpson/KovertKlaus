# KovertKlaus 🕵️‍♂️🎄

**Stealth Intelligence Gift Exchange Network for Families, Friends & Communities**

> [!IMPORTANT]
> **ACTIVE RELEASE: `v0.1.0-prealpha` (Pre-Alpha Foundations)**  
> Target Alpha: October 1, 2026 (`v0.2.0-alpha`) | Target Beta: November 1, 2026 (`v1.0.0-beta` Season 1 Launch)  
> Tracked via Weekly 6 Sprints ([`docs/CURRENT_SPRINT.md`](./docs/CURRENT_SPRINT.md)).

KovertKlaus turns standard Secret Santa and White Elephant gift exchanges into engaging, covert holiday missions. Featuring automated reliability tracking (Coal Citations), reusable Wishlist Manifests, automated product metadata scraping, 100% bidirectional match exclusion rules, Sattolo target derangement algorithms, mobile-first 2-way target cascade swapping, phase-scoped Head Elf command consoles, After-Action Reports (AAR), and containerized PostgreSQL database management.

---

## 🤖 AI Agent Guidelines & Architecture Rules

Working on this repository as an AI assistant, subagent, or pair programmer? Please read **[`AGENTS.md`](./AGENTS.md)** and **[`docs/CURRENT_SPRINT.md`](./docs/CURRENT_SPRINT.md)** before modifying code! All AI agents MUST adhere to:
* **Canonical Nomenclature:** `Head Elf` (Organizer), `Elf Agent` (Member), `Holiday Mission` (Exchange), `Wishlist Manifest` (OpKit), `Manifest Item` (OpTool), and `Coal Citations` (Demerits).
* **Demerit Governance:** Platform Non-Intermediary Principle, `-1` auto-rehabilitation upon mission fulfillment, and Carrier Protection Waiver.
* **Release Roadmap & Sprints:** `v0.1.0-prealpha` (now) ➔ `v0.2.0-alpha` (Oct 1) ➔ `v1.0.0-beta` (Nov 1). Sprints follow the **Weekly 6 Action Items** framework with Monday retrospectives.
* **Dual Manifests:** `WISHLIST` (multiple requested items) vs `WHITE_ELEPHANT` (strictly 1 brought gift item).
* **Security & Mode Control:** `APP_MODE=selfhosted` (default) vs `APP_MODE=saas` configured in `src/lib/config/mode.ts`. OWASP password complexity (min 10 chars), `bcryptjs` hashing (12 salt rounds), and 24h HTTP-only sessions.

---

## 🌟 Key Product Features

- 🎲 **Sattolo Derangement Matching Engine**: Eliminates chain predictability. No operative can draw themselves, and cyclic chains are randomized (`src/lib/draw.ts`).
- 🚫 **100% Bidirectional Exclusion Rules ($A \iff B$)**: Prevents blocked pairs (spouses, household members) from being matched in either direction.
- 🎯 **Mobile-First Tap-to-Swap Modal**: Allows Head Elves to execute 2-way target cascade swaps ($A \to T_{\text{new}}$ and $B \to T_{\text{old}}$) without complex line-dragging UI.
- 🎖️ **Phase-Scoped Head Elf Admin Console**: Action buttons dynamically align with mission stages (`RECRUITING` ➔ `SETUP` ➔ `SHIPPED` ➔ `EXECUTED` ➔ `COMPLETED`). Advancing a stage automatically updates the milestone date to today.
- 📸 **After-Action Report (AAR) Debriefing**: Post-event feed allowing operatives to post thank-you notes and gift photos.
- ⚠️ **Demerit Reliability & Auto-Rehabilitation**: 
  - `0-2 Coal Citations`: `ACTIVE`
  - `3 Coal Citations`: `REMOTE_RESTRICTED` (relegated to local/in-person events only)
  - `>3 Coal Citations`: `DISABLED`
  - **Carrier Protection Waiver**: Submitting tracking numbers waives penalties if packages are lost.
  - **Automatic Rehabilitation**: Successful mission completion automatically removes `-1` coal citation.
- 🔎 **URL Metadata Web Scraper**: OpenGraph scraper with 2.5s fast-failover timeout for adding items to Wishlist Manifests.
- 📧 **Universal Transactional Email Dispatcher**: Pluggable adapter engine supporting **Brevo REST API** (300 free emails/day, 100% edge-safe), **Direct SMTP** (`nodemailer` for self-hosted home users), **Resend API**, and an automatic **Console Mock** fallback for local dev.

---

## 📧 Email Configuration (Brevo & Direct SMTP)

KovertKlaus automatically routes encrypted transactional dispatches (invitations, target draws, nudges, clearance ciphers) based on your environment variables:

| Mode | Provider Setting | Key Requirements | Best For |
| :--- | :--- | :--- | :--- |
| **Brevo REST API** | `EMAIL_PROVIDER="brevo"` (or auto-detected via `BREVO_API_KEY`) | `BREVO_API_KEY="xkeysib-..."`<br>`BREVO_SENDER_EMAIL="admin@kovertklaus.com"` | Cloudflare Workers, Edge runtimes, Production SaaS (300 emails/day free tier) |
| **Direct SMTP** | `EMAIL_PROVIDER="smtp"` (or auto-detected via `SMTP_HOST`) | `SMTP_HOST="mail.domain.com"`<br>`SMTP_PORT=587`<br>`SMTP_USER="..."`<br>`SMTP_PASS="..."` | Self-hosted home users, Docker, VPS, Postfix, Mailgun/SendGrid SMTP |
| **Resend API** | `EMAIL_PROVIDER="resend"` | `RESEND_API_KEY="re_..."` | Developers using Resend REST API |
| **Console Mock** | `EMAIL_PROVIDER="console"` (or default fallback) | *None* | Local development & offline testing (prints formatted emails to stdout) |

---

## 🛠️ One-Click DevOps Suite

KovertKlaus includes Windows PowerShell and Batch scripts to manage the application lifecycle:

| Action | Command / Double-Click Script | Description |
| :--- | :--- | :--- |
| **Launch Server** | [`run-kovertklaus.bat`](./run-kovertklaus.bat) | Checks port 3000 and starts `npm run dev` in a dedicated background window. |
| **Stop Server** | [`stop-kovertklaus.bat`](./stop-kovertklaus.bat) | Gracefully terminates any process listening on port 3000. |
| **Export Test DB** | [`export-db.bat`](./export-db.bat) | Dumps PostgreSQL container database to [`prisma/kovertklaus_test_db.sql`](./prisma/kovertklaus_test_db.sql). |
| **Restore Test DB** | [`restore-db.bat`](./restore-db.bat) | Restores PostgreSQL container database from [`prisma/kovertklaus_test_db.sql`](./prisma/kovertklaus_test_db.sql). |

---

## 🚀 Quick Start (Self-Hosting for Personal / Family Use)

KovertKlaus is container-native and ready to run on Linux, Windows, or Docker out of the box.

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

# 3. Restore test data (Optional)
.\restore-db.bat

# 4. Open browser
http://localhost:3000
```

---

## 📜 Licensing & Commercial Rights

- **Free Non-Commercial Self-Hosting**: Anyone can download, run, modify, and self-host KovertKlaus for personal, family, non-profit, or home-lab use for free under BSL 1.1.
- **Commercial Reservation**: Exclusive rights to operate and monetize KovertKlaus as a paid commercial SaaS service are reserved exclusively by **Joshua Simpson** (and designated successors/acquiring entities).
- **Sunset Clause**: Converts unconditionally to **GNU General Public License v3.0 (GPLv3)** on January 1, 2030 or upon business closure.
