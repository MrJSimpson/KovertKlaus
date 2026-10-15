# 🤖 KovertKlaus — AI Agent Guidelines & Architecture Rules

Welcome AI Assistant / Subagent! This repository (`KovertKlaus`) adheres to strict architectural, cybersecurity, and domain nomenclature rules established by project owner **Joshua Simpson (`jsimpson`)**.

All AI agents reading or modifying this repository **MUST** adhere strictly to the guidelines detailed below.

---

## 🎯 1. Canonical Domain Nomenclature (Santa's Whimsical Secret Service)

Always enforce the canonical domain vocabulary across all UI text, code variables, API responses, comments, and documentation:

| Domain Concept | Canonical Term | Prisma Entity | Scope & Meaning |
| :--- | :--- | :--- | :--- |
| **Event Organizer** | **`Head Elf`** (`OpsLeader`) | `User` / `Exchange.organizer` | Creator & administrator of a Holiday Mission. |
| **Participant** | **`Elf Agent`** (`Agent`) | `User` / `ExchangeMember` | Enrolled operative participant in a mission. |
| **Gift Exchange Event** | **`Holiday Mission`** | `Exchange` (`Mission`) | Secret Santa or White Elephant gift exchange operation. |
| **Wishlist Container** | **`Wishlist Manifest`** | `Wishlist` (`OpKit`) | Curated dossier of wished-for gifts or brought item. |
| **Individual Gift Item** | **`Manifest Item`** | `Item` (`OpTool`) | Individual product item inside a Wishlist Manifest. |
| **Penalties / Citations** | **`Coal Citations`** | `User.penaltyPoints` | Reliability demerits for deadline non-compliance. |

* **`Agent: ` Codename Prefix**: Every operative codename **MUST** use the `Agent: ` prefix (e.g. `Agent: Viper`, `Agent: KovertKlaus`). Use `formatCodename()` from `@/lib/security.ts`.
* **Direct Canonical Presentation**: Do NOT introduce dynamic runtime terminology translation layers. Use canonical terms directly in JSX copy.

---

## 🧰 2. Dual Wishlist Manifest Architecture (`WISHLIST` vs `WHITE_ELEPHANT`)

There are two distinct types of `Wishlist Manifest` in the system:

1. **`🎁 Secret Santa Manifest` (`WISHLIST`)**:
   * **Purpose:** Wishlist of requested gift items an `Elf Agent` hopes to receive from their assigned Secret Santa.
   * **Manifest Item Limit:** Multiple items allowed (up to system limit).

2. **`🐘 White Elephant Manifest` (`WHITE_ELEPHANT`)**:
   * **Purpose:** The single physical or digital gift item an `Elf Agent` brings to the live White Elephant stealing pool.
   * **Manifest Item Limit:** **STRICTLY LIMITED TO 1 MANIFEST ITEM** per operative! Adding a 2nd item must be blocked by validation.

---

## ⚠️ 3. Demerit Governance, Non-Intermediary Principle & Auto-Redemption

1. **Platform Non-Intermediary Principle**:
   * KovertKlaus admins and support **NEVER** adjudicate, modify, or manually intervene in personal demerit disputes.
   * Citations and redemptions are governed 100% deterministically by automated system rules and the Head Elf.
2. **Intentional Neglect Standard**:
   * Coal Citations require intentional neglect or abandonment (unfulfilled delivery with zero carrier tracking proof by Execution Day).
3. **Carrier Protection Waiver**:
   * Operatives who enter a valid tracking number (USPS, FedEx, UPS, DHL) receive automated penalty immunity.
4. **Automated Rehabilitation & Redemption Engine**:
   * When an operative with penalty points (`penaltyPoints > 0`) successfully fulfills their gift in a subsequent exchange (or participates in White Elephant), the system automatically decrements their penalty points by 1 (`-1`), restoring `accountStatus: 'ACTIVE'` when penalty points drop below 3.

---

## ✅ 4. Definition of Done

Every change (from maintainers, contributors, or AI agents) must meet:
  - 100% typed TypeScript with 3-tier TSDoc annotations.
  - Automated test suite passes 100% (`npm test`).
  - Next.js Turbopack build succeeds with 0 errors (`npm run build`).
  - Contributions follow [`CONTRIBUTING.md`](CONTRIBUTING.md). All issues and pull requests are reviewed by the owner and team before merge.
  - User- or operator-visible changes add a line under `## [Unreleased]` in `CHANGELOG.md`. Versions, releases and branch pruning follow [`docs/VERSIONING.md`](docs/VERSIONING.md); each release adds a plain-language entry to `src/lib/announcements.ts`.
  - **Zero credentials** in code, docs, tests, commit messages and pull requests: no passwords (including retired or example ones), keys, tokens or connection strings with secrets. Reference secrets by variable name; ban lists store digests.

---

## 🔒 5. Cybersecurity & Privacy Requirements (OWASP Aligned)

* **Password Security:** Minimum **10-character complex passwords** for users; administrative passphrases require **12+ characters** conforming to NIST SP 800-63B.
* **Password Hashing:** Passwords MUST be hashed using modern **scrypt** modular crypt format (`$scrypt$N$r$p$salt$hash`), with automatic backward-compatible legacy bcrypt upgrade upon login. Never store or log plaintext passwords.
* **First-Run Admin Setup:** No default administrator password ships. With no `AdminUser` and no `INITIAL_ADMIN_PASSWORD`, the server prints a one-time setup token to its console and `/northpole/setup` creates the first administrator (`src/lib/adminSetup.ts`). Never add a default password to code, seeds, dumps, or docs.
* **Session Management:** Single HTTP-Only, `SameSite=Lax`, `Secure` cookie (`kovertklaus_session`) with a **24-hour expiration time**, renewed while the agent stays active. Admin sessions expire after **8 hours** and are never renewed. The expiry and session kind are signed into the token (`src/lib/session-token.ts`), so an expired or wrong-kind token is rejected even if a client keeps it.
* **Zero Telemetry:** No tracking, analytics, or external telemetry scripts allowed.

---

## 🏗️ 6. Technology Stack & Database Rules

* **Framework:** Next.js 16 (App Router + Turbopack + React 19).
* **Styling:** TailwindCSS with dual-theme mode (🎄 Light Theme & ❄️ Dark Icy Theme).
* **Database:** PostgreSQL 16/17 Alpine running in Docker container (`kovertklaus-db`) or external PostgreSQL.
* **ORM:** Prisma ORM. Whenever modifying `prisma/schema.prisma`, execute `npx prisma db push` and `npx prisma generate`.
* **Schema Separation (`app` / `admin`):** Every model and enum **MUST** declare `@@schema("app")` (reachable by the application role through `db`) or `@@schema("admin")` (owner-only, through `adminDb`). Never put tables in `public`. After any schema change, run `npx tsx scripts/check-db-schema-separation.ts`. See `docs/DEPLOYMENT_GUIDE.md` → Database Schema Separation.
* **Clean Database Rule:** Seeds contain zero dummy users, zero mock exchanges, and zero sample wishlists. No `AdminUser` is seeded unless `INITIAL_ADMIN_PASSWORD` is configured. The only sample data is the opt-in, self-hosted demo (`npm run demo:load`, `scripts/demo-db.ts`): `@demo.invalid` accounts, a password generated at load time (never committed), local databases only. See `docs/DEMO_DATABASE.md`.

---

## 🎲 7. Secret Target Assignment & Swap Algorithms

* **Secret Santa Operations:** Target assignment MUST use Sattolo's algorithm derangement (`src/lib/draw.ts`). No `Elf Agent` can be assigned to themselves ($A[i] \neq i$).
* **100% Bidirectional Exclusion Rules ($A \iff B$)**: Prevented pairs apply equally in both directions. Never create single-direction exclusion toggles.
* **Mobile-First Tap-to-Swap**: Swapping target for Operative $A \to T_{\text{new}}$ automatically displaces Operative $B \to T_{\text{old}}$, preserving the 1-to-1 giving invariant.

---

## 🌿 8. Mandatory Git Feature Branching Protocol (NON-NEGOTIABLE)

1. **Zero Direct-to-Main Changes**: NEVER make edits or commit directly to `main` in this repository. Contributors work on a fork or feature branch and open a pull request.
2. **Branch Creation**: Always create a descriptive feature/fix branch before modifying code:
   `git checkout -b <type>/<short-description>` (e.g., `feat/wishlist-sharing`, `sec/rbac-guards`).
3. **Verification**: Complete and test all changes on the branch (`npm run build`, unit tests).
4. **Review & Merge**: Open a pull request. The owner and team review it; only maintainers merge to `main`.

---

## 🛠️ 9. Developer Workshop & Self-Hosted Preservation

1. **Retain `/workshop` in Self-Hosted**: All internal QA test benches (`/workshop/draw`, `/workshop/lifecycle`, `/workshop/scraper`, `/workshop/theme`, `/workshop/manifest`, `/workshop/party`, `/workshop/aar`) are preserved in this repository for local developers and home-lab instances.
