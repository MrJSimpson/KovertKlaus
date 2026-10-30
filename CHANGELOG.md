# Changelog

All notable changes to the **KovertKlaus** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed
- **A KDM invitation key no longer lets an agent join a mission that has stopped recruiting.** Joining with a key checked that the mission had room but not that it was still recruiting, so an agent could join after the draw (with no target) or a finished or cancelled mission. Every way of joining (invite code at sign-up, emailed invitation, KDM key) now checks both: the mission must be recruiting and have room.
- **Self-hosted: a Head Elf's settings edit gets the same checks as on kovertklaus.com.** The Node.js route checked only some settings, so on a self-hosted server a Head Elf could save an empty title, a capacity below the agents already enrolled, or a White Elephant mission that is not local. Both servers now merge and validate a settings edit with one shared function, and text fields are sanitized on both. An error now names the rule that failed on both servers (the edge worker used to answer "Validation failed").

---

## [0.7.0-alpha] - 2026-10-29

Dev #51–#75. Readies beta: open sign-ups are switched on from the North Pole (Release Stage → BETA), with no redeploy. The What's New pop-up holds a beta announcement that appears only once the stage is BETA.

### Security
- **New accounts are rate limited.** One network can create 3 accounts an hour and 10 a day, and KovertKlaus as a whole accepts 200 new accounts a day, so a script cannot fill the database or use up the day's email quota with welcome emails. Someone joining a mission with its invite link is never stopped by the daily site limit or the hourly limit, so a family can sign up together on one home network (the 10 a day still applies). A blocked sign-up is told to try again later, and each limit reached writes one warning to the North Pole system log. The counts use the existing `admin."LoginThrottle"` table; no database change.
- **Sign-in is rate limited.** Repeated wrong passwords now make the agent sign-in and the North Pole sign-in wait instead of letting anyone guess without limit. An agent sign-in waits after 5 failures for one account from one address in 15 minutes, 20 failures from one address across accounts in 15 minutes, or 50 failures on one account from anywhere in an hour (the North Pole allows 3, 10 and 20). The wait is never a hard lockout: someone guessing from elsewhere cannot keep an agent out of their own account. Accounts and addresses are stored only as keyed hashes, failures older than a day are deleted hourly, and each limit reached writes one warning to the North Pole system log. **Operators:** run `prisma/sql/2026-10-27_login-throttle.forward.sql` as the database owner before deploying (new table `admin."LoginThrottle"`).

### Added
- **Admins switch the release stage and set platform limits in the North Pole.** North Pole → Config has a new Release Stage & Platform Limits section. **Release stage** ALPHA keeps registration invite-only; BETA opens it to everyone, takes effect within a minute, and needs no redeploy. **Limits**, each with a safe range the server enforces (an admin cannot save a value that would break the app):
  - **Missions a Head Elf can run at once:** 5 (1–20). Completed and cancelled missions do not count. Creating one more is refused with a message saying why.
  - **Agents per mission:** 50 (4–100). A Head Elf can set a lower cap for a mission, never a higher one; a mission with no cap of its own fills at this limit. Every way of joining checks it.
  - **Items per Secret Santa wishlist:** 20 (1–50), down from 50. **Quantity per item:** 25 (1–99).
  The annual free allowances and the paid-event price are not enforced during beta. **Operators:** run `prisma/sql/2026-10-29_platform-limits.forward.sql` as the database owner before deploying (four new `admin."SystemConfig"` columns; `maxWishlistItems` 50 → 20).
- **Send feedback from any page.** Signed-in agents have a Feedback button in the bottom-right corner. Pick Bug, Idea or Other, write up to 2,000 characters, and it reaches the KovertKlaus team along with the page you were on, the app version and your browser. Up to 10 reports a day per agent. Admins read and triage reports (New, Reviewed, Done) under **North Pole → Feedback**. **Operators:** run `prisma/sql/2026-10-27_feedback.forward.sql` as the database owner before deploying (new table `app."Feedback"`).
- **Emails over Brevo's daily limit wait instead of being lost.** Brevo's free tier sends 300 emails a day and rejects the rest. KovertKlaus now counts each day's emails (the day starts at midnight Pacific), writes a warning to the North Pole system log at 240, and from 290 holds new emails and sends them, oldest first, after midnight. An email Brevo rejects for quota is held too. **Operators:** run `prisma/sql/2026-10-26_email-outbox.forward.sql` as the database owner before deploying (new table `admin."EmailOutbox"`). `EMAIL_DAILY_QUOTA` sets a different quota.
- **The Head Elf learns who blocked a mission cancelled at its repair deadline.** The Head Elf's cancel notice and email list each blocking agent with their codename and what they had not fixed, e.g. "Ivy (Quiet Fox): no shipping address, empty wishlist". Each blocking agent is told privately what was left on them. Everyone else still sees counts only, with no names. Cancellations for too few agents or impossible match rules name nobody.
- **A beta announcement waits for the switch.** What's New entries can be tied to a release stage. The Season 1 beta announcement is shipped now and appears, with the What's New dot, only once an admin sets the release stage to BETA.
- **Hide finished missions.** The dashboard has Hide Completed and Hide Cancelled toggles. Your browser remembers them, and when they hide everything the page says how many missions are hidden.

### Changed
- **Wishlists hold up to 20 items, and each item has a quantity.** A Secret Santa wishlist holds up to 20 different items, and an agent can ask for 1 to 25 of each (both are platform limits an admin can tune in the North Pole). The mission's price limit applies to one unit; when the Head Elf limits the whole list, every unit counts toward the total, so 25 boxes of $2 pencils count as $50. White Elephant is unchanged: one gift, quantity 1.
- **Missions hold up to 50 agents.** A Head Elf's capacity can now be set from 4 to the platform limit (50 by default), up from 4 to 25. A mission left without a cap now fills at the platform limit instead of having no limit.
- **Cancelling or deleting a mission takes a deliberate confirmation.** The dialog opens with a large warning, and its button stays disabled until you type the mission's name. The Head Elf must now give a reason for cancelling, which every agent sees; North Pole admins may still cancel without one. Deleting a mission now asks for its name instead of its invite code.
- **The dashboard is now the one place for your missions.** It lists every mission you run or have joined (it showed only the three most recent), with the search, role and status filters from the Operations Center. The Operations Center and its "Manage All Operations" button are gone; old `/operations` links open the dashboard, and the mission page's back link returns there.

### Fixed
- **Signing up with the invite code of a closed or full mission is refused in every release stage.** Outside alpha, registering with the code of a mission that had already drawn or was full created the account and added the new agent to that mission anyway. Registration now checks that the mission is recruiting and has room in every stage, and an invite code that matches nothing is refused instead of ignored.
- **Malformed requests to the Cloudflare worker get a clear error instead of a server error.** Sign-in, registration, profile, mission, shipping, scraper and North Pole requests with a field of the wrong type (for example a number where an email belongs) now get a 400 like a missing field does. They used to fail with a 500 and write an "Unhandled Worker Exception" to the North Pole system log. Creating a mission checks each setting's type before its values, and the North Pole user editor only accepts a real account status. Registration on the Node.js server (`/api/users`) follows the same rules, including a body that is not JSON at all.
- **Mission pages wait for a waking database instead of showing "Operation Access Denied".** On the first visit after the database had gone idle, the mission page showed an access error to agents who had access. The API now answers a database that is still waking with a retryable 503. The mission page and the dashboard keep their loading screen and retry for about half a minute, with a "waking up" note. A real failure now reads "Operation Not Found" or "Command Center Unreachable" with a Try Again button, and internal database errors are no longer shown to agents. A slow session check while the database wakes no longer signs agents out of the mission page.
- **Agent cards in a mission's roster no longer all say "Pending".** The card showed shipping status at every stage, and before the draw every agent's shipping is still pending, so agents who had accepted looked like they had not. Before the draw (and in White Elephant missions) the card now says "Joined"; after a Secret Santa draw it shows Not Shipped Yet, Shipped or Hand Delivery.
- **Clearer reason when a paused mission is cancelled at its repair deadline.** Instead of "Problems blocking the draw were not fixed before the deadline", agents are told what was left: how many agents still had an empty wishlist or no shipping address, or how many of the agents needed had joined. No agent is named.

---

## [0.6.3-alpha] - 2026-10-24

Dev #50.

### Fixed
- **Assignment Day emails are no longer at risk of being dropped.** The automatic draw started each agent's assignment email without waiting for it, so on the SaaS edition the hourly sweep could finish (and Cloudflare could end it) before the emails were sent. The automatic and manual draws now share one sender that waits for every email, logs any that fail without stopping the others, and uses the edge worker's email settings. No automatic draw had run in production yet. Email dates in the automatic draw now read like the manual draw's ("Dec 20, 2026").

---

## [0.6.2-alpha] - 2026-10-24

Dev #44–#46.

### Security
- **Next.js 16.4.3** fixes two critical remote code execution advisories (image optimizer with SVG files, `use cache` returning typed arrays) and a Server Actions denial of service (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r). The SaaS edition is a static export and was not exposed; **self-hosted instances run a Next.js server and should update.**
- **Nodemailer 10.2.1** fixes address-parsing flaws that could turn display text into an extra recipient.
- **All dependencies updated** to their newest release that is at least 7 days old. `.npmrc` now sets `min-release-age=7`, so `npm install` skips versions published in the last week (most malicious package versions are caught within days). Urgent security fixes are installed explicitly after checking their registry signatures and provenance. Notable: React 19.3.1, Prisma 7.10.1, TypeScript 6.0, `@types/node` 24 (matches the Node 24 runtime).

### Fixed
- **`npm run lint` crashed** (`expand is not a function`): the `brace-expansion` override forced v5 under ESLint's `minimatch@3`. The override now applies to the 1.x line only.
- **Get Data no longer fills in a store's domain or its bot check as the item name.** When a store refused the lookup, the title box was filled with the domain (for example `www.etsy.com`), and a store that answered with its "Robot or human?" page had that title saved as the item name and cached for 24 hours for everyone. Pages without a product title, domain-only titles and bot-check pages are now treated as failed lookups: nothing is cached, the title is left empty, and the form asks the agent to fill in the details. Catalog entries saved from such pages earlier are ignored and replaced on the next successful lookup.
- **Scraper failures now reach North Pole → Logs on the SaaS edition.** The log write was not awaited, so the Worker could finish the request before it was saved. Failed lookups (including the new `BOT_CHALLENGE` and `NO_METADATA` reasons) are now logged reliably.

---

## [0.6.1-alpha] - 2026-10-24

Dev #42.

### Fixed
- **Get Data never filled anything in on kovertklaus.com (SaaS).** The scraper asked for `redirect: 'error'`, which Cloudflare Workers rejects before sending the request, so every live lookup fell back to the bare domain name (only links already in the catalog from the last 24 hours worked). Both runtimes now share `src/lib/product-fetch.ts`: it follows up to 3 redirects by hand and re-checks each target with the SSRF filter, so a store link still can never redirect to an internal address. Self-hosted also gains redirects (for example `http://` → `https://www.`), which the old code refused.
- **Scraper failures are logged.** A failed lookup now writes a `SCRAPER` log entry with the reason (HTTP status, timeout, blocked redirect, network or processing error) instead of failing silently. Watch North Pole → Logs for stores that block lookups from Cloudflare.

---

## [0.6.0-alpha] - 2026-10-23

Dev #32–#40.

### Added
- **Notification bell in the dashboard header.** Notifications no longer stack under the welcome card. The bell shows a count and opens a panel listing them ten at a time (‹ › to page), newest first. Each one has a ✕ to remove it, **Remove these** clears the page shown, and a notification about a mission links to that mission. An invitation notification has **Accept** and **Decline** while the invitation is open. The missing shipping address warning moved into the panel and opens Account Preferences on the Shipping tab; it stays until the address is filled in.
- **API:** `/api/notifications` (GET lists the caller's open notifications with a link each; PATCH `{ ids }` or `{ all: true }` removes them), served by both the edge worker and the Next.js route.
- **Cancel a mission.** The Head Elf (🛑 Cancel Mission in the Head Elf console) or a North Pole admin (Operations) can cancel any mission that is not completed, with an optional reason. Every agent is notified in the app and by email, told who cancelled it, and asked to save anything they need. The mission becomes read-only: wishlist changes, messages, shipping updates, invitations and Head Elf actions are refused. Nobody receives a Coal Citation. Completed missions can never be cancelled or deleted.
- **Delete a cancelled mission.** A mission cancelled before the draw can be deleted permanently 48 hours later by its Head Elf or an admin, after typing the mission code. Every cancelled mission is deleted automatically 90 days after cancellation (the hourly lifecycle sweep). Deletion erases all of the mission's data and leaves one anonymous `MissionHistory` row (outcome and reason, no title or people); only the Head Elf is told. New actions `cancelMission` / `deleteMission` on `POST /api/operations` and `POST /api/northpole/operations` (`cancel` | `delete`), in both runtimes.
- **Database:** `ExchangeStatus.CANCELLED`, enum `MissionActor`, Exchange cancellation columns, `Notification.dedupeKey` (unique per user) and table `MissionHistory`. Operators: back up (`export-db`), run `prisma/sql/2026-10-21_mission-cancellation.forward.sql`, then deploy. Rollback: `2026-10-21_mission-cancellation.rollback.sql` (refuses while any mission is cancelled).
- **Draw readiness check and repair window.** On Assignment Day (and for a manual draw) the mission is checked: enough agents (Secret Santa 4, White Elephant 3), a shipping address for every agent of a remote Secret Santa mission, at least one item on every wishlist, and match rules that allow a draw. If something is missing the draw pauses: recruiting reopens, the Head Elf is notified and emailed once a day, and each agent at fault is told what to do. The Head Elf removes the agent or extends the timeline (moving Target Draw to a later day lifts the pause). The deadline is halfway between Assignment Day and the ship deadline (Exchange Day when there is none), at least two days away. Once everything is fixed the next hourly sweep draws; if it is still blocked at the deadline the mission is cancelled, agents are told why, and nobody receives a Coal Citation. The mission page shows the Head Elf the issues with a Remove button per agent; agents see only their own.
- **Database:** Exchange columns `repairDeadline`, `repairIssues` (JSON text) and `repairNoticeAt`. Operators: run `prisma/sql/2026-10-21_draw-repair.forward.sql`, then deploy. Rollback: `2026-10-21_draw-repair.rollback.sql`.
- **Preventative match rules are checked when they are made.** In a Secret Santa mission of 4 or more agents, a new rule is refused if it would leave any agent with fewer than 2 possible partners (blocks work both ways, so each agent needs one to give to and one to receive from) or make one gift circle through everyone impossible. The error names the agent affected. Removing an agent now also deletes every rule naming them, and the Head Elf is warned if the remaining rules no longer allow a circle (the draw-time check pauses the mission until it is fixed).

### Changed
- **What's New opens as a pop-up** over the current page (close with ✕, Escape or a click outside) instead of a separate page. The `/announcements` page is gone.
- **Agents are locked in after the draw.** The Head Elf can no longer remove an agent once targets are drawn (it used to leave their Secret Santa pointing at nobody).
- **The hourly "Insufficient Operatives" notice is replaced** by the repair window above.
- **Target swaps keep one gift circle.** Choosing a new target T for agent A now moves T into place after A: A gives to T, T gives to A's old target, and T's old giver takes T's old target (three assignments change). The old swap exchanged two agents' targets, which always split the circle into two loops. The swap list only offers targets that keep all three new pairs within the rules.
- **Worker requests use about a third to two thirds less CPU (SaaS).** A finished request now parks its Prisma client with its connections closed, and the next request reuses it (reconnecting on its own first query), instead of building a new client and recompiling every query each time. Concurrent requests still never share a client or a socket. Local measurement per request: `/api/users/me` 18.5 → 6.8 ms, `/api/notifications` 15.3 → 9.7 ms, `/api/invitations` 17.0 → 12.8 ms.
- **User pages stay on the app database connection (SaaS).** `/api/config` (loaded by every page) and the email settings behind invites, nudges and assignment mail read admin-schema settings through a one-minute per-isolate copy, cleared when North Pole saves, so they no longer open an admin connection on almost every request. North Pole endpoints keep using the admin connection.

### Fixed
- **Mission countdowns read one day too many across the autumn clock change.** In time zones with daylight saving time, a countdown spanning the change showed "In 11 days" for 10. The countdown now counts calendar days.
- **A second manual draw silently replaced every target (SaaS).** The worker had no re-draw lock, and a draw that the rules made impossible returned a 500. Both runtimes now share one manual draw (`src/lib/manual-draw.ts`): a drawn mission needs explicit confirmation to re-draw, the draw is refused once gifts ship, and agents get the 🎯 notice the automatic draw sends.
- **A paused draw showed as Recruiting.** While the Head Elf repairs a mission, its badge on the dashboard, Mission Center, mission page and North Pole now reads Draw Paused and counts down to the repair deadline.
- **Cancelled missions still showed agent controls.** Wishlist editing, shipping, invites, nudges and disenroll buttons are hidden on a cancelled mission (the server already refused them), and its message channels report closed instead of failing on send.
- **The draw could split agents into smaller loops,** including two agents drawing each other, which tells both who their Secret Santa is. Every Secret Santa draw (automatic and manual) is now one circle through every agent. Tightly constrained rule sets fall back to an exact search, which also replaces the random trial in the feasibility check, so a rule set that allows no circle is reported as such.
- **Dashboard and Account Preferences failed with "Worker exceeded resource limits".** Each Worker request builds its own Prisma client and recompiles its queries, which put the heaviest routes over the Workers Free 10 ms CPU limit; production now runs on Workers Paid. `/api/users/me` also no longer loads notifications (the bell uses `/api/notifications`), and `/api/notifications` returns the newest 100 plus a `total`; the bell shows the full count and fetches more as notifications are removed.
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
