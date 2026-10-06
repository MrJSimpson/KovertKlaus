# Changelog

All notable changes to the **KovertKlaus** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - Initial Super Admin password updated to `G!v!nGSp1r1t` (`requiresPasswordReset: true` enforcing NIST SP 800-63B first-login reset for self-hosters).
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
