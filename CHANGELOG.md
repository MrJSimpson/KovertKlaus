# Changelog

All notable changes to the **KovertKlaus** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Notification bell in the dashboard header.** Notifications no longer stack under the welcome card. The bell shows a count and opens a panel listing them ten at a time (‹ › to page), newest first. Each one has a ✕ to remove it, **Remove these** clears the page shown, and a notification about a mission links to that mission. An invitation notification has **Accept** and **Decline** while the invitation is open. The missing shipping address warning moved into the panel and opens Account Preferences on the Shipping tab; it stays until the address is filled in.
- **API:** `/api/notifications` (GET lists the caller's open notifications with a link each; PATCH `{ ids }` or `{ all: true }` removes them), served by both the edge worker and the Next.js route.
- **Cancel a mission.** The Head Elf (🛑 Cancel Mission in the Head Elf console) or a North Pole admin (Operations) can cancel any mission that is not completed, with an optional reason. Every agent is notified in the app and by email, told who cancelled it, and asked to save anything they need. The mission becomes read-only: wishlist changes, messages, shipping updates, invitations and Head Elf actions are refused. Nobody receives a Coal Citation. Completed missions can never be cancelled or deleted.
- **Delete a cancelled mission.** A mission cancelled before the draw can be deleted permanently 48 hours later by its Head Elf or an admin, after typing the mission code. Every cancelled mission is deleted automatically 90 days after cancellation (the hourly lifecycle sweep). Deletion erases all of the mission's data and leaves one anonymous `MissionHistory` row (outcome and reason, no title or people); only the Head Elf is told. New actions `cancelMission` / `deleteMission` on `POST /api/operations` and `POST /api/northpole/operations` (`cancel` | `delete`), in both runtimes.
- **Database:** `ExchangeStatus.CANCELLED`, enum `MissionActor`, Exchange cancellation columns, `Notification.dedupeKey` (unique per user) and table `MissionHistory`. Operators: back up (`export-db`), run `prisma/sql/2026-10-21_mission-cancellation.forward.sql`, then deploy. Rollback: `2026-10-21_mission-cancellation.rollback.sql` (refuses while any mission is cancelled).

### Changed
- **What's New opens as a pop-up** over the current page (close with ✕, Escape or a click outside) instead of a separate page. The `/announcements` page is gone.

### Fixed
- **Target draws, swaps, broadcasts and Kovert Delivery enrollment reported failure after saving.** The `db` proxy runs each model call immediately, so the array form of `$transaction` threw after its writes had already happened, one by one rather than all-or-nothing. The automatic draw on Assignment Day saved the targets and MATCHED, then told the Head Elf "Target Draw Pending", and agents never got their 🎯 assignment notice or email. The manual draw, target swap and OpTeam Broadcast returned errors after saving. All nine call sites (both runtimes) now use the callback form, and `src/lib/db-transactions.test.ts` rejects the array form.
- **Notification flood from stuck missions.** A mission past Assignment Day with too few agents (or a failed draw) created a new Head Elf notification every hourly sweep. It now keeps one notice that updates in place.

---

## [0.5.0-alpha] - 2026-10-20

Dev #23–#26 and #29.

### Added
- **Codename card on the mission page.** After joining, an Elf Agent sees their codename for the mission with **Draw another** and **Accept codename**. Rerolls are unlimited until they accept or recruiting closes; after that the codename is fixed. New endpoint `POST /api/codename` (`reroll` | `accept`).

### Changed
- **Each mission has its own wishlist.** An Elf Agent gets a fresh Wishlist Manifest when they join a mission and edits it on that mission's page; changing it never touches another mission. The dashboard's Wishlist Manifests section and the `/opkits` library are gone (`/opkits` forwards to the dashboard). A giver sees their target's list for that mission only (before, they saw the target's oldest list, whichever mission it was made for).
- **Wishlist price rules.** Every item needs a price (an estimate is fine for handmade gifts), and no item may cost more than the mission's spending limit. The Head Elf decides, when creating the mission or in its settings, whether a whole list may total more than the limit; it may by default. The mission page shows the rules, the list total, and flags items left over a limit the Head Elf lowered.
- **Adding a wishlist item starts with the gift type.** An **Add an item** drop-down offers **Store-bought gift** or **Personalized gift**. The store-bought form says "Paste a link and click Get Data to auto-fill the form. Update any missing details." and its **Get Data** button fills in the name, price, image and notes from the store page (this replaces "+ Scrape Link"). The personalized form (handmade or specially crafted) is filled in by hand, and its name, estimated price and description are required; the server also refuses a personalized gift without a description.
- **Mission Comms sits under Elf Agents** in the right-hand column.
- **After the draw, an agent's Elf Agents list shows only who they can message:** the Head Elf, their target (🎯) and an anonymous 🎅 Secret Santa row, each with a 💬 button that opens that conversation. The Santa's identity stays hidden. The Head Elf keeps the full roster, with their own target and Santa marked.
- **API:** `/api/wishlist` (GET, POST, PATCH, DELETE; mission-scoped, served by both the edge worker and the Next.js route) replaces `/api/opkits`. `/api/users/me` no longer returns `wishlists`, and `/api/invitations/accept` ignores `wishlistId`.
- **Database:** `Wishlist.memberId` (one list per `ExchangeMember`, deleted with it) replaces `ExchangeMember.wishlistId`, and `Exchange.allowWishlistOverBudget` is added. Operators, after the codename forward script and assign script: back up (`export-db`), run `prisma/sql/2026-10-20_mission-wishlists.forward.sql` (members sharing a list each get a copy; a member with no linked list gets a copy of their oldest account list of the mission's type, the list the old mission page showed and edited; anyone else gets an empty list), deploy, then run the codename cleanup and then `2026-10-20_mission-wishlists.cleanup.sql`, which **deletes lists not linked to any mission**. Rollback before cleanup: `2026-10-20_mission-wishlists.rollback.sql`.
- **After-Action Report form no longer asks for a fulfillment type.** The mission already defines how gifts are delivered, so the selector (and the `[label]` it prefixed to each note) is gone; notes post as written. Existing entries keep their text.
- **Codenames are assigned per mission.** Joining a mission (invitation, sign-up with an invite code, Covert Delivery key, or creating it as Head Elf) draws a random codename, unique within that mission: one adjective and one noun (about 29,000 combinations, e.g. "Snowy Spider"), shown as "Agent: Snowy Spider". The word lists in `src/lib/codename-words.ts` are grouped by category and a test blocks explicit words, relationship or status words, and hyphens. Accounts no longer have a codename: the codename fields are gone from sign-up, Account Preferences ("preferred codename", "always randomize") and the North Pole user editor. North Pole user search matches mission codenames. Assignment emails name the target by their mission codename; welcome and nudge emails use the agent's name.
- **Database:** `ExchangeMember.codenameAcceptedAt` added and `(exchangeId, codename)` is now unique; `User.codename`, `preferredCodename` and `autoRandomizeCodename` are removed. Operators: run `prisma/sql/2026-10-20_mission-codenames.forward.sql` before deploying (it locks existing codenames in missions past recruiting and renames duplicates inside a mission), then `npx tsx --env-file=.env scripts/assign-mission-codenames.ts` (gives a pool codename to members without one, and to members of still-recruiting missions whose old personal codename is not in the pool; they can reroll until recruiting closes), then `2026-10-20_mission-codenames.cleanup.sql` after the deploy. Rollback: `2026-10-20_mission-codenames.rollback.sql`.
- **New winter palette.** Light mode (Klaus) uses the classic Christmas colors and dark mode (Kovert) uses blue and gold (Indigo dye, Lion, Ecru, Wheat, Alice blue, French gray, Cambridge blue). Colors are semantic `kk-*` tokens in `src/app/globals.css`, so every page, modal, the North Pole and the Workshop follow the active theme, and every text color meets WCAG AA contrast. Spring, summer and autumn presets are unchanged. Existing databases keep the old winter button overrides until the `winter_holiday` preset's `lightTokens`/`darkTokens` are reduced to `accentColor` (on a fresh local database, `npm run db:seed` does it; on production, update that one row, because the seed also resets System Config and purges test accounts).
- **Emails are always light.** Every email uses the light Christmas palette and declares `color-scheme: light only`, whatever the reader's theme.
- **Light by default.** Pages start in light mode; a saved dark choice is applied before first paint. The Features page and the pre-launch page now follow the app theme.
- **Mobile.** On touch screens buttons and form controls are at least 44px tall; the landing, Features, pre-launch and Operations headers fit a 390px phone; Operations filters and section actions wrap instead of being cut off.
- **Mission stage colors.** Each timeline stage has its own hue, used by the timeline, mission status badges and countdown pills (light: gold, holly, evergreen, pine; dark: jewel tones on indigo, gold, rose cranberry, mint evergreen, ice blue). The current stage is solid; finished stages are tinted with ✓ in light mode and get a colored top stripe in dark mode; upcoming stages are dashed (`src/lib/stage-colors.ts`).
- **Mission page layout.** Section headers are colored bands matching the page header, the title card uses the header color, items inside panels sit on a contrasting surface, and Elf Agent and invitation rows separate info (tinted) from actions (plain). The console now says Head Elf.

### Fixed
- **After-Action Reports were squeezed into a narrow column** on wide screens. The section sat in the mission page's 12-column grid without a span, so it took one column and stretched down the page; it now spans the full width.
- **`export-db` / `restore-db` no longer corrupt text.** Both piped the dump through Windows PowerShell, which re-encoded it as ASCII and turned emoji and accented characters into `?`. Backups are now pg_dump archives (`backups/kovertklaus-backup.dump`) copied with `docker cp`; the previous backup is kept as `kovertklaus-backup.prev.dump`, and restore still accepts an older `kovertklaus-backup.sql`.
- Mission Center's Assigned filter and a drawn (`MATCHED`) mission's phase looked for a status that does not exist (`ASSIGNED`), so drawn missions were shown as recruiting.
- `dark:` styles followed the operating system's dark mode instead of the in-app toggle, which mixed palettes (for example the Head Elf's Invite button showed near-black text on a dark button).
- Header subtitles used pine text on the pine header.

---

## [0.4.0-alpha] - 2026-10-15

Dev #19 and #20.

### Added
- **Demo database** (self-hosted only): `npm run demo:load` fills a local database with six demo Elf Agents and three missions at different stages; `npm run demo:remove` deletes them. Accounts use the reserved `@demo.invalid` domain, the password is generated per load (never stored), and the script refuses SaaS mode and non-local hosts. See `docs/DEMO_DATABASE.md`.
- **Deadline nudges:** the Head Elf's Nudge reminds the agent of their next upcoming deadline (cutoff, draw, ship-by unless already shipped, exchange day), posted to the Command thread plus the in-app notification and email; one nudge per agent per 12 hours (`src/lib/nudge.ts`, shared by both runtimes).

### Security
- **Changing your password signs out your other devices.** New nullable `User.sessionsRevokedAt` (schema change: run `prisma db push`); user tokens issued before it are rejected, and the device that made the change gets a fresh session.

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
