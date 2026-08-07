# 🤖 KovertKlaus — AI Agent Guidelines & Architecture Rules

Welcome AI Assistant / Subagent! This repository (`KovertKlaus`) adheres to strict architectural, cybersecurity, and domain nomenclature rules established by project owner **Joshua Simpson (`jsimpson`)**.

All AI agents reading or modifying this repository **MUST** adhere strictly to the guidelines detailed below.

---

## 🎯 1. Strict Domain Nomenclature (NON-NEGOTIABLE)

Always enforce the following terms across all UI text, code variables, API responses, comments, and documentation:

| Standard Term | Forbidden Terms (Do NOT Use) | Description & Context |
| :--- | :--- | :--- |
| **`OpsLeader`** | Host, Admin, Organizer, Owner | The creator/leader of a holiday operation. |
| **`Agent`** | User, Participant, Member, Player | Any enrolled operative participating in an operation. |
| **`Agent-` Codename** | Plain codenames without prefix | Every operative codename **MUST** be prefixed with `Agent-` (e.g. `Agent-Alex`, `Agent-KovertKlaus`). Use `formatCodename()` from `@/lib/security.ts`. |
| **`OpKit`** | Wishlist, Registry | A Secret Santa wishlist or White Elephant gift container attached to an agent. Subtitles must explain: `(OpKit = Wishlist \| OpTool = Gift Item)`. |
| **`OpTool`** | Gift, Item, Product | Individual wished-for or brought gift items contained inside an `OpKit`. |
| **`Operation`** | Party, Event | A Secret Santa or White Elephant gift exchange group. Displayed in UI as **`Active Operations (Exchanges)`**. |

---

## 🧰 2. Dual OpKit Architecture (`WISHLIST` vs `WHITE_ELEPHANT`)

There are two distinct types of `OpKit` in the system:

1. **`🎁 Secret Santa OpKit` (`WISHLIST`)**:
   * **Purpose:** Wishlist of requested gift items that an `Agent` hopes to receive from their assigned Secret Santa.
   * **OpTool Limit:** Unlimited / Multiple `OpTools` allowed.

2. **`🐘 White Elephant OpKit` (`WHITE_ELEPHANT`)**:
   * **Purpose:** The single physical or digital gift item an `Agent` is **bringing/contributing** to the live White Elephant stealing pool.
   * **OpTool Limit:** **STRICTLY LIMITED TO 1 OPTOOL** per operative! Adding a 2nd item must be blocked by validation.

---

## 🔒 3. Cybersecurity & Privacy Requirements (OWASP Aligned)

* **Password Security:** Minimum **10-character complex passwords** requiring at least one uppercase letter, lowercase letter, number, and special character.
* **Password Hashing:** Passwords MUST be hashed using `bcryptjs` with **12 salt rounds**. Never store or log plaintext passwords.
* **Session Management:** Single HTTP-Only, `SameSite=Strict`, `Secure` cookie (`kovertklaus_session`) with a **24-hour expiration time**.
* **Zero Telemetry:** No tracking, analytics, or external telemetry scripts allowed.

---

## 🏗️ 4. Technology Stack & Database Rules

* **Framework:** Next.js 16 (App Router + Turbopack + React 19).
* **Styling:** TailwindCSS with dual-theme mode (🎄 Light Theme & ❄️ Dark Icy Theme).
* **Database:** PostgreSQL 16 Alpine running in Docker container (`kovertklaus-db`) on port 5432 (mapped to 5433).
* **ORM:** Prisma ORM.
  * **Rule:** Whenever modifying `prisma/schema.prisma`, execute `npx prisma db push` and `npx prisma generate` to keep PostgreSQL synchronized.
  * **Database Backup Rule:** Run `.\export-db.bat` after updating schema or test datasets to refresh [`prisma/kovertklaus_test_db.sql`](./prisma/kovertklaus_test_db.sql).

---

## 🎲 5. Secret Target Assignment & Swap Algorithms

* **Secret Santa Operations:** Target assignment MUST use Sattolo's algorithm derangement (`src/lib/draw.ts`). No `Agent` can be assigned to themselves ($A[i] \neq i$).
* **100% Bidirectional Exclusion Rules ($A \iff B$)**: Prevented pairs apply equally in both directions. Never create single-direction exclusion toggles.
* **Mobile-First Tap-to-Swap**: Swapping target for Operative $A \to T_{\text{new}}$ automatically displaces Operative $B \to T_{\text{old}}$, preserving the 1-to-1 giving invariant.

---

## 🎖️ 6. Phase-Scoped OpsLeader Console Rules

OpsLeader console action buttons **MUST** strictly align with operation lifecycle phases:
* **Phase 1 (`RECRUITING`)**: `Invite Agent`, `Close Recruitment`. (Hide Matching Rules, Draw, Citations, and Demotions).
* **Phase 2 (`SETUP`)**: `Emergency Invite`, `Matching Rules`, `Initiate Assignments`.
* **Phase 3 (`ASSIGNED`/`SHIPPED`)**: `Send OpTeam Broadcast`, `Manage Assignments & Swaps`.
* **Phase 4 (`EXECUTED`)**: `Wishlist Verification`, `Send OpTeam Broadcast`, `End Operation`.
* **Post-Event (`COMPLETED`)**: `Wishlist Verification`, `Send OpTeam Broadcast`, `Issue Demerits`, and `After-Action Report (AAR)`.

---

## ✅ 7. AI Agent Code Quality & Verification Protocol

1. **Build Verification:** Before claiming completion, run `npm run build` to verify clean TypeScript compilation and static page generation.
2. **Unit Test Verification:** Run `npx tsx src/lib/draw.test.ts` to verify Sattolo derangements and target swap algorithms pass 100%.
3. **No Symptom Masking:** Never wrap failing code in silent `try/catch` blocks or comment out broken assertions. Resolve root causes empirically based on build/runtime logs.
4. **Documentation Integrity:** Preserve existing code comments, docstrings, and function signatures.
