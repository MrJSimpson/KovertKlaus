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

* **`Agent-` Codename Prefix**: Every operative codename **MUST** use the `Agent-` prefix (e.g. `Agent-Viper`, `Agent-KovertKlaus`). Use `formatCodename()` from `@/lib/security.ts`.
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

## 🗺️ 4. Master Release Roadmap & Semantic Versioning

* **`v0.1.0-prealpha` (Active / Now – Sep 30, 2026)**: Core engine refactoring, algorithmic derangements, email dispatch test harness, and TSDoc codebase annotations.
* **`v0.2.0-alpha` (Target: Oct 1, 2026)**: Closed family dogfooding (Shannon, Cheryl, Terry, Zach), multi-carrier webhooks, and mobile polish.
* **`v1.0.0-beta` (Target: Nov 1, 2026)**: Season 1 Public Winter Launch (Nov 1 – Jan 31), live public exchanges, and Cloudflare SaaS multi-tenant gateway.
* **`v1.0.0-ga` (Target: Jan 31, 2027)**: General Availability & Q2 Spring Egg Hunt Rotation.

---

## 📋 5. Weekly 6 Sprint Framework & Monday Cadence

* Every week has exactly **6 High-Priority Action Items** tracked in `docs/sprints/YYYY-Wxx.md` and `docs/CURRENT_SPRINT.md`.
* **Monday Retrospective & Planning Ceremony**:
  1. Review empirical test proofs from previous week.
  2. Identify areas for improvement and blockers.
  3. Lock the upcoming week's 6 actionable deliverable cards.
* **Definition of Done (DoD)**:
  - 100% typed TypeScript with 3-tier TSDoc annotations.
  - Automated test suite passes 100% (`draw.test.ts`, `email.test.ts`).
  - Next.js Turbopack build succeeds with 0 errors (`npm run build`).
  - Multi-repo synchronization (`kovertklaus` $\leftrightarrow$ `kovertklaus-saas`).

---

## 🔒 6. Cybersecurity & Privacy Requirements (OWASP Aligned)

* **Password Security:** Minimum **10-character complex passwords** requiring at least one uppercase letter, lowercase letter, number, and special character.
* **Password Hashing:** Passwords MUST be hashed using `bcryptjs` with **12 salt rounds**. Never store or log plaintext passwords.
* **Session Management:** Single HTTP-Only, `SameSite=Lax`, `Secure` cookie (`kovertklaus_session`) with a **24-hour expiration time**.
* **Zero Telemetry:** No tracking, analytics, or external telemetry scripts allowed.

---

## 🏗️ 7. Technology Stack & Database Rules

* **Framework:** Next.js 16 (App Router + Turbopack + React 19).
* **Styling:** TailwindCSS with dual-theme mode (🎄 Light Theme & ❄️ Dark Icy Theme).
* **Database:** PostgreSQL 16 Alpine running in Docker container (`kovertklaus-db`) or Neon Serverless PostgreSQL with dual pooling (`DATABASE_URL` pooler + `DIRECT_URL` direct).
* **ORM:** Prisma ORM. Whenever modifying `prisma/schema.prisma`, execute `npx prisma db push` and `npx prisma generate`.

---

## 🎲 8. Secret Target Assignment & Swap Algorithms

* **Secret Santa Operations:** Target assignment MUST use Sattolo's algorithm derangement (`src/lib/draw.ts`). No `Elf Agent` can be assigned to themselves ($A[i] \neq i$).
* **100% Bidirectional Exclusion Rules ($A \iff B$)**: Prevented pairs apply equally in both directions. Never create single-direction exclusion toggles.
* **Mobile-First Tap-to-Swap**: Swapping target for Operative $A \to T_{\text{new}}$ automatically displaces Operative $B \to T_{\text{old}}$, preserving the 1-to-1 giving invariant.

---

## 🌿 9. Mandatory Git Feature Branching Protocol (NON-NEGOTIABLE)

1. **Zero Direct-to-Main Changes**: NEVER make edits or commit directly to `main` in any repository, ESPECIALLY `kovertklaus-saas`.
2. **Branch Creation**: Always create a descriptive feature/fix branch before modifying code:
   `git checkout -b <type>/<short-description>` (e.g., `feat/sprint-w34-demerits`, `sec/rbac-guards`).
3. **Verification**: Complete and test all changes on the branch (`npm run build`, unit tests).
4. **Merge & Sync**: Once the feature is 100% verified, merge the branch into `main`, push to remote, and clean up the local branch.
