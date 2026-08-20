# KovertKlaus — Architecture & API Reference 🕵️‍♂️🎄

This document provides a comprehensive technical overview of the **KovertKlaus** application structure, database schemas, API routes, and design conventions.

---

## 🎯 1. Canonical Domain Nomenclature (Santa's Whimsical Secret Service)

| Domain Concept | Canonical Term | Prisma DB Entity | Description & Scope |
| :--- | :--- | :--- | :--- |
| **Event Organizer** | **`Head Elf`** (`OpsLeader`) | `User` / `Exchange.organizer` | Creator & administrator of a Holiday Mission. |
| **Participant** | **`Elf Agent`** (`Agent`) | `User` / `ExchangeMember` | Operative enrolled in the mission. |
| **Gift Exchange Event** | **`Holiday Mission`** | `Exchange` (`Mission`) | Gift exchange operation (Secret Santa / White Elephant). |
| **Wishlist Container** | **`Wishlist Manifest`** | `Wishlist` (`OpKit`) | Curated collection of wished-for gift items. |
| **Individual Gift Item** | **`Manifest Item`** | `Item` (`OpTool`) | Individual product item inside a Wishlist Manifest. |
| **Penalty / Demerit** | **`Coal Citation`** | `User.penaltyPoints` | Reliability penalty point for deadline non-compliance. |

---

## 🗄️ 2. Database Models (Prisma)

- **`User`**: Account details, codename, address, coal citation count (`penaltyPoints: 0-3`), `accountStatus`.
- **`Exchange` (`Mission`)**: Mission details, timeline dates (`inviteCutoffDate`, `assignmentDate`, `shippingDate`, `executionDate`), budget range, `opsLeaderAssistedDraw`, `drawVerifiedAt`.
- **`ExchangeMember` (`MissionAgent`)**: Join link between `User` and `Exchange` (`role`, `targetUserId`, `shippingStatus`, `trackingNumber`, `deliveredConfirmed`).
- **`ExclusionRule`**: 100% Bidirectional match exclusion rules ($A \iff B$) between operatives.
- **`Wishlist`**: Wishlist Manifest record (`name`, `type`, `userId`, `isMaster`).
- **`Item`**: Product catalog record (`name`, `url`, `price`, `description`, `thumbnailUrl`).
- **`WishlistItem`**: Join table connecting `Wishlist` to `Item`.
- **`IntelMessage`**: Anonymous chat message stream.
- **`Notification`**: In-app alert broadcasts and system notifications.
- **`AfterActionReport`**: Post-event gift thank-you messages and photo uploads.
- **`ClearanceLead`**: Early-access waitlist staging table.
- **`AdminUser`**: Separate administrative credentials for North Pole Command (`/northpole`).
- **`SystemConfig`**: Database-persisted live runtime configuration (tokens, themes, allowances, email keys).

---

## 🌐 3. API Route Reference

- **`POST /api/users/login`**: Authenticates user via bcrypt, sets HTTP-only session cookie.
- **`GET / POST / PATCH / DELETE /api/users/me`**: Session profile retrieval (auto-creates default Master Wishlist Manifest if missing), address/password updates, and logout.
- **`POST /api/users`**: Email existence check (`action: 'check'`) & account registration (`action: 'register'`).
- **`GET / POST / PATCH /api/operations`**: Mission retrieval by code/user, mission creation, target drawing (`action: 'draw'`), 2-way target swaps (`action: 'swap'`), exclusion rules (`action: 'addExclusion'`, `'removeExclusion'`), recruitment closing (`action: 'closeRecruitment'`), ending mission (`action: 'endOperation'`), team broadcasts (`action: 'sendOpTeamBroadcast'`), and After-Action Reports (`action: 'createReport'`).
- **`GET / POST / PATCH / DELETE /api/opkits`**: Persistent CRUD operations for Wishlist Manifests and Manifest Items.
- **`POST /api/scraper`**: OpenGraph metadata scraper with 2.5s fast-failover timeout.
- **`POST /api/invitations/accept`**: Enrolls an operative into a mission via invite code.
- **`GET / POST /api/shipping`**: Shipping status and carrier tracking waiver submission.
- **`GET / POST /api/demerits/audit`**: Demerit audit engine, automated `-1` redemption, and citation issuance.
- **`POST /api/northpole/login` & `/api/northpole/me`**: Isolated SysAdmin authentication portal.

---

## 🎨 4. Theme System & Design Tokens (`src/lib/theme.ts`)

Theme utilities are located in `src/lib/theme.ts`. Call `getThemeClasses(isDarkMode, presetTokens)` to obtain color tokens for:
* **Klaus Mode 🎄 (Light Theme)**: Evergreen pine headers, holly berry buttons, warm gold accents, and clean white frames.
* **Kovert Mode ❄️ (Dark Theme)**: Midnight slate, icy sky blue accents, translucent glassmorphism panels, and frost borders.

---

## ⚡ 5. Open-Core Architecture & Mode Vector (`src/lib/config/mode.ts`)

KovertKlaus uses an **Environment Mode Flag Vector** (`APP_MODE`) to separate open-source self-hosted capabilities from commercial SaaS extensions:

* **`APP_MODE=selfhosted` (Default)**: Full-featured, unlimited local operation capacity for personal, family, and home-lab deployments under BSL 1.1. Zero external billing credentials required.
* **`APP_MODE=saas`**: Activates multi-tenant account resource quota checking (`src/lib/saas/stub.ts`) and Stripe commercial billing integration hooks for `kovertklaus.com`.

---

## ⚖️ 6. Demerit Governance, Non-Intermediary Principle & Redemption Engine

* **Platform Non-Intermediary Principle**:
  * KovertKlaus admins and customer service do **NOT** arbitrate or handle demerits.
  * Acquiring demerits requires intentional neglect or abuse (e.g., failure to ship without tracking proof, ghosting).
  * If a demerit citation is issued, it is strictly an administrative matter between the Event Organizer (`Head Elf`) and the participant. KovertKlaus is **NOT an intermediary**.
* **Account Tiers**:
  * `0-2` Coal Citations: **`ACTIVE`** (Full access across all remote and local missions).
  * `3` Coal Citations: **`REMOTE_RESTRICTED`** (Restricted strictly to local in-person exchanges).
  * `>3` Coal Citations: **`DISABLED`** (Suspended from creating or joining missions).
* **Automatic Rehabilitation / Redemption Engine**:
  * Successfully completing any subsequent mission automatically clears **1 Coal Citation** (`Math.max(0, penaltyPoints - 1)`).
  * Once penalty points drop below 3 (e.g., from 3 to 2), account standing is automatically restored from `REMOTE_RESTRICTED` back to `ACTIVE`.
* **Anti-Abuse Safeguards**:
  * **Carrier Protection Waiver**: Submitting a valid carrier tracking number automatically waives demerit penalties if a parcel is lost by the carrier.
  * **Demerit Immunity Waiver**: Verified receipt of any gift in a mission waives demerit liability.
  * **Execution Day Gate**: Demerit audits can only be executed on or after the scheduled Execution Day.

---

## 🗺️ 7. Master Release Roadmap & Engineering Lifecycle

* **`v0.1.0-prealpha` (Active / Now – Sep 30, 2026)**: Core engine refactoring, algorithmic derangements, email dispatch test harness, and TSDoc codebase annotations.
* **`v0.2.0-alpha` (Target: Oct 1, 2026)**: Closed family dogfooding (Shannon, Cheryl, Terry, Zach), multi-carrier webhooks, and mobile UI polish.
* **`v1.0.0-beta` (Target: Nov 1, 2026)**: Season 1 Public Winter Launch (Nov 1 – Jan 31), live public exchanges, and Cloudflare SaaS multi-tenant gateway.
* **`v1.0.0-ga` (Target: Jan 31, 2027)**: General Availability & Q2 Spring Egg Hunt Rotation.

---

## 📋 8. Weekly 6 Sprint Framework & Monday Cadence

* All feature development is organized into **Weekly 6 Action Item** sprints tracked in `docs/sprints/YYYY-Wxx.md` and `docs/CURRENT_SPRINT.md`.
* **Monday Retrospective & Planning Ceremony**:
  1. Review empirical test proofs from previous week.
  2. Identify areas for improvement and blockers.
  3. Lock the upcoming week's 6 actionable deliverable cards.
* **Definition of Done (DoD)**:
  - 100% typed TypeScript with 3-tier TSDoc annotations.
  - Automated test suite passes 100% (`draw.test.ts`, `email.test.ts`).
  - Next.js Turbopack build succeeds with 0 errors (`npm run build`).
  - Multi-repo synchronization (`kovertklaus` $\leftrightarrow$ `kovertklaus-saas`).
