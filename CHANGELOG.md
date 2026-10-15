# Changelog

All notable changes to the **KovertKlaus** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Demo database** (self-hosted only): `npm run demo:load` fills a local database with six demo Elf Agents and three missions at different stages; `npm run demo:remove` deletes them. Accounts use the reserved `@demo.invalid` domain, the password is generated per load (never stored), and the script refuses SaaS mode and non-local hosts. See `docs/DEMO_DATABASE.md`.

### Changed
- `export-db` / `restore-db` back up to the gitignored `backups/` folder instead of a tracked file.

### Removed
- The stale schema-only dump `prisma/kovertklaus_test_db.sql` and `scripts/generate-modern-sql-dump.ts`.

---

## [0.3.0-alpha] - 2026-10-15

The first release under the versioning protocol (`docs/VERSIONING.md`). It collects everything merged since 0.2.0-alpha (pull requests #1 to #18).

### Added
- **Mission Comms** (`/api/messages`, `src/lib/intel-messages.ts`): three channels per mission. **Command** (Head Elf and one agent; send until completion, read forever), **Intel** (Secret Santa and target, Santa anonymous; from the draw until completion), **Debrief** (everyone, after completion; readable for 14 days). 500-character limit, 20 messages per hour. Schema: `MessageChannel`, `ExchangeMessage.channel`, nullable `recipientId`, `Exchange.completedAt`.
- **Email invitations** (`src/lib/invitations.ts`, `MissionInvitation`): Head Elf only. New users get a Join Exchange link to registration (registering with a mission code is their alpha clearance and enrolls them); existing users accept or decline on the mission page or dashboard. Pending invites expire after the cutoff day; Late Pass for registered users after the cutoff. Sharing the mission code still works.
- **Elf Agents roster:** the mission page lists enrolled agents and, for the Head Elf, invited agents with **Resend** (10-minute cooldown) and **Revoke**. The Invite Agent modal only sends.
- **Timeline edits:** Head Elves can change cutoff, draw, ship-by and exchange dates. A changed date must be after today; the timeline must stay strictly increasing; completed missions are frozen (`src/lib/validations/timeline.ts`).
- **Announcements page** (`/announcements`) with a What's New link and an unseen-update dot.
- **Versioning protocol** (`docs/VERSIONING.md`) and a version-consistency test.
- `/register` route so Alpha Clearance approval links work.
- **Pre-Launch Alpha Clearance** (ported from the SaaS edition, now available in both editions): admins approve waitlist leads in `/northpole/leads`, which issues a single-use `ALPHA-` activation code bound to the lead's email and emails a pre-filled registration link. During `RELEASE_STAGE=ALPHA`, registration accepts either a mission invite code or an approved activation code, and the code is deleted on use.

### Security
- **No default administrator password.** First-run setup replaces the published initial password: with no `AdminUser` and no `INITIAL_ADMIN_PASSWORD`, the server prints a one-time setup token to its console, and `/northpole/setup` creates the first administrator with a passphrase the operator chooses. The token is 256-bit, compared in constant time, held only as a digest in memory, revoked after use, and reissued on restart.
- **Retired defaults are permanently banned** by the NIST passphrase validator, so an upgraded or restored install cannot be left on a previously published credential.
- **`db:seed` no longer touches an existing administrator.** Previously it reset the existing admin's password to the default on every run.
- **Database schema separation (`app` / `admin`).** Admin tables (`AdminUser`, `SystemConfig`, `SystemLog`) move to an `admin` schema the application role cannot enter. App tables move to `app`, where new tables are granted to the application role automatically. Includes forward/rollback SQL and a read-only audit (`scripts/check-db-schema-separation.ts`).
- **Expiring, typed sessions** (`src/lib/session-token.ts`): user sessions last 24 hours, renewed while active; admin sessions are fixed at 8 hours. The kind and expiry are signed into the token. Older tokens are rejected (one forced re-login).
- **Edge worker hardening:** admin endpoints check the admin account in the database (`requireAdmin`); members are scoped to their own mission; ownership checks on manifests and items; validated forms; `405` for a wrong method instead of `404`.
- `/api/config` no longer exposes `SystemConfig` internals; North Pole reads live settings.

### Fixed
- **User-facing email was not being sent** from the SaaS edge worker (invitations, welcome, assignment, nudge and broadcast). Email settings are now read through the admin client, and a fallback is logged.
- **Mission links** (`/exchange/<code>`) returned 404 on the SaaS edition for every real mission code; they now open the right mission.
- Edge worker API parity: every self-hosted API route has a worker handler (guarded by a test), fixing "route does not exist" errors.
- Worker uses per-request database clients (stopped error 1101 under concurrent load).
- `/api/users/profile` accepts `PUT` and saves the Operative Dossier.
- Operative sign-in works while the pre-launch landing page is live.
- White Elephant manifests are limited to one item on the edge worker as well.
- Removed dead `/tests` links from the landing page.

### Changed
- Alpha activation codes now carry 64 random bits (`ALPHA-` + 16 hex), up from 32. Codes issued earlier remain valid.
- Workshop UI (links, dashboard card, roster filter) is shown only when the server reports the self-hosted edition (`edition` field on `/api/config`). The SaaS edition does not ship `/workshop`.
- `INITIAL_ADMIN_PASSWORD` is now optional and empty by default. Set it only for unattended deployments; it forces a reset on first login.
- The SQL dump no longer contains an `AdminUser` row.
- `AGENTS.md` is now contributor guidance; `CONTRIBUTING.md` documents that issues and pull requests from people and AI agents are welcome and reviewed by the owner and team.

### Removed
- Internal sprint and planning documents (`docs/CURRENT_SPRINT.md`, `docs/PRIORITY_REMINDERS.md`, `docs/sprints/`).

---

## [0.2.0-alpha] - 2026-10-06

### Added
- **PreLaunchApproval Schema Alignment**:
  - Added `PreLaunchApproval` table to Prisma schema for bidirectional parity with SaaS edition.
- **First-Class Text-Only Personalized Gifts**:
  - Support for custom, handmade, experiential, or local gift requests with empty product URLs (`src/lib/validations/manifest.ts`).
  - OWASP XSS sanitization and strict string bounds ($\le 100$ char title, $\le 500$ char description, $\le 4$ custom key-value details).
- **PostgreSQL Connection Pool Stress Test Suite & Resilient Proxies**:
  - 19-test concurrency and latency benchmarking suite (`src/lib/db-pool-stress.test.ts`).
  - 50 concurrent query burst handling without starvation (mean latency 51.34ms, P95 94.43ms, 0 connection leaks).
  - Transparent self-healing proxy failover with exponential backoff (`[500, 1200, 2500]`) mitigating Neon serverless cold starts.
- **Mobile Responsive Viewport & Bottom-Sheet Architecture**:
  - Mobile-first responsive bottom-sheet dialogs on `< 640px` viewports (`WishlistItemModal`, `CreateOperationModal`, `AccountPreferencesModal`, `PreventativeMatchModal`, `JoinOperationModal`).
  - 16px mobile input font-size remediation eliminating iOS Safari focus auto-zoom.
  - Modern `100dvh` viewport units and `.pb-safe-sheet` safe-area inset clearance for home indicators and notches.
  - Accessible $\ge 44\times 44$px touch targets across navigation headers, tabs, buttons, and exclusion triggers.

### Changed
- **Pristine Production Database Sanitization**:
  - Purged all example/test accounts, dummy users (`@example.com`), mock exchanges (`SIMPSON-2026`, `TEST-2026`), and sample wishlists from seed data.
  - Initial Super Admin password replaced with a new installation default, with `requiresPasswordReset: true` enforcing a NIST SP 800-63B first-login reset for self-hosters. (Retired in 0.3.0-alpha: no default password ships; first-run setup creates the administrator.)
  - Regenerated clean PostgreSQL DDL and seed in `prisma/kovertklaus_test_db.sql`.
- **Developer Workshop Preservation**:
  - Confirmed and verified all `/workshop/*` internal test benches remain fully operational for self-hosted community instances.
- Promoted application milestone to `v0.2.0-alpha`.
- Enhanced `getSessionSecret()` to cleanly allow development fallback during build-time static HTML page prerendering (`STATIC_EXPORT=true`).

---

## [0.1.0-prealpha] - 2026-08-20

### Added
- **Core Gift Exchange Engine**:
  - Sattolo Linked-List cyclic derangement algorithm with bidirectional pairing exclusions.
  - Interactive Target Swap Engine with two-way cascading handoffs.
  - White Elephant party lobby support with physical draw mode and digital draw lockout.
- **Santa's Whimsical Secret Service Division**:
  - Canonical domain nomenclature: `Head Elf`, `Elf Agent`, `Holiday Mission`, `Wishlist Manifest`, `Manifest Item`, `Coal Citations`.
  - Dual visual aesthetics: **Klaus Mode 🎄** (Evergreen/Holly Berry) and **Kovert Mode ❄️** (Midnight Slate/Icy Glassmorphism).
- **Universal Multi-Provider Email Dispatcher**:
  - Environment-based auto-detection supporting Brevo, SMTP, Resend, and Console Mock.
  - Responsive HTML + plaintext transactional templates for invites, matches, nudges, and early clearance confirmations.
- **Demerit Governance & Auto-Rehabilitation Engine**:
  - Non-Intermediary Principle: KovertKlaus admins never adjudicate personal participant disputes.
  - Automated `-1` coal citation decrement upon successful mission fulfillment.
  - Carrier Protection Waiver: Automated demerit immunity for valid multi-carrier tracking numbers.
- **North Pole SysAdmin Workshop**:
  - Dedicated admin clearance portal (`/northpole`) for real-time user management, exchange inspection, and database-driven theme/token live configuration.
  - Interactive Lifecycle Simulator (`/workshop/lifecycle`) and Email Dispatch Testing Sandbox (`/workshop/email`).
- **Comprehensive Documentation**:
  - Automated binary LibreOffice Writer ODF Knowledge Base generator (`scripts/generate-odt-kb.js`).
  - Self-describing TSDoc codebase annotations and architecture reference (`docs/ARCHITECTURE.md`).

### Changed
- Refactored `ThemeContext` to strictly manage visual tokens and seasonal lights, removing dynamic terminology lookup indirection.
- Standardized weekly 6-action-item sprint cadence with Monday retrospectives.

---

## Roadmap Milestones
- **`v0.2.0-alpha` (2026-10-01)**: Closed family dogfooding, multi-carrier webhook ingestion, and mobile UI hardening.
- **`v1.0.0-beta` (2026-11-01)**: Public Season 1 Winter Launch (Nov 1 - Jan 31), Cloudflare SaaS multi-tenant gateway.
- **`v1.0.0` (2027-01-31)**: General Availability & Q2 Spring Egg Hunt Rotation.
