# KovertKlaus 🕵️‍♂️🎄

**Stealth Intelligence Gift Exchange Network for Families, Friends & Communities**

KovertKlaus turns standard Secret Santa and White Elephant gift exchanges into engaging, covert stealth operations. Featuring account reliability tracking (Demerits), reusable OpKit wishlists, automated product metadata scraping, 100% bidirectional match exclusion rules, Sattolo target derangement algorithms, mobile-first 2-way target cascade swapping, phase-scoped OpsLeader command consoles, After-Action Reports (AAR), and containerized PostgreSQL database management.

---

## 🤖 AI Agent Guidelines & Architecture Rules

Working on this repository as an AI assistant, subagent, or pair programmer? Please read **[`AGENTS.md`](./AGENTS.md)** before modifying code! All AI agents MUST adhere to:
* **Nomenclature:** `OpsLeader`, `Agent`, `Agent-` codename prefixes, `OpKit`, `OpTool`, and `Active Operations (Exchanges)`.
* **Dual OpKits:** `WISHLIST` (unlimited requested items) vs `WHITE_ELEPHANT` (strictly 1 brought gift item).
* **Security:** OWASP password complexity (min 10 chars), `bcryptjs` hashing (12 salt rounds), and 24h HTTP-only sessions.

---

## 🌟 Key Product Features

- 🎲 **Sattolo Derangement Matching Engine**: Eliminates chain predictability. No operative can draw themselves, and cyclic chains are randomized (`src/lib/draw.ts`).
- 🚫 **100% Bidirectional Exclusion Rules ($A \iff B$)**: Prevents blocked pairs (spouses, household members) from being matched in either direction.
- 🎯 **Mobile-First Tap-to-Swap Modal**: Allows OpsLeaders to execute 2-way target cascade swaps ($A \to T_{\text{new}}$ and $B \to T_{\text{old}}$) without complex line-dragging UI.
- 🎖️ **Phase-Scoped OpsLeader Admin Console**: Action buttons dynamically align with operation stages (`RECRUITING` ➔ `SETUP` ➔ `SHIPPED` ➔ `EXECUTED` ➔ `COMPLETED`). Advancing a stage automatically updates the milestone date to today.
- 📸 **After-Action Report (AAR) Debriefing**: Post-event feed allowing operatives to post thank-you notes and gift photos (no rating system required).
- ⚠️ **Demerit Reliability & Immunity System**: 
  - `0-2 Demerits`: `ACTIVE`
  - `3 Demerits`: `REMOTE_RESTRICTED` (relegated to local/in-person events only)
  - `>3 Demerits`: `DISABLED`
  - **Carrier Protection Waiver**: Submitting tracking numbers waives penalties if packages are lost.
  - **Demerit Immunity Waiver**: Verified receipt of ANY gift completely waives demerit liability.
- 🔎 **URL Metadata Web Scraper**: OpenGraph scraper with 2.5s fast-failover timeout for adding items to OpKit wishlists.

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

- **Free Non-Commercial Self-Hosting**: Anyone can download, run, modify, and self-host KovertKlaus for personal, family, non-profit, or home-lab use for free.
- **Commercial Reservation**: Exclusive rights to operate and monetize KovertKlaus as a paid commercial SaaS service are reserved exclusively by **Joshua Simpson** (and designated successors/acquiring entities). Third parties may not host or re-sell KovertKlaus as a commercial paid service.

---

## 🌅 Sunset Clause (January 1, 2030)

On January 1, 2030 (or upon Joshua Simpson's retirement), the codebase automatically converts to **GNU General Public License v3.0 (GPLv3)**, becoming 100% open source forever.
