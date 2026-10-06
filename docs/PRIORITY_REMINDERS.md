# 📋 KovertKlaus — Priority Reminders & Production Engineering Roadmap

- **Repository**: `kovertklaus` (`~/projects/kovertklaus`)
- **Active Release Stage**: **`v0.2.0-alpha` (Self-Hosted Community Alpha | October 2026)**
- **Target Beta**: November 1, 2026 (`v1.0.0-beta` Season 1 Launch)
- **Sprint Management**: [Active Weekly Sprint Tracker](CURRENT_SPRINT.md) (6-item sprints with Monday retrospectives)
- **Last Updated**: October 6, 2026

---

## 🔥 TOP PRIORITIES (Release Roadmap & Alpha Cadence)

All development follows our **Weekly 6 Action Items** sprint framework ([`docs/CURRENT_SPRINT.md`](CURRENT_SPRINT.md)). All core functionality and test verification MUST satisfy the **Definition of Done** before promoting through release stages.

---

### 🛡️ P0-A: Database Pristine State & Admin Security
- [x] **Pristine Database Cleanliness**: Zero dummy users, zero `@example.com` accounts, zero mock exchanges, and zero sample wishlists in seed data.
- [x] **North Pole Super Admin Provisioning**: Seed only `AdminUser` (`santa` / `admin@kovertklaus.com`) with NIST SP 800-63B compliant password `G!v!nGSp1r1t` (`requiresPasswordReset: true` for self-hosted).
- [x] **PreLaunchApproval Schema Parity**: Prisma model aligned with SaaS edition for uniform migrations.
- [x] **Developer Workshop Verification**: All 7 `/workshop/*` internal test benches preserved and functional for self-hosted developer use.

---

### 🎨 P0-B: Feature Completeness & Polish Roadmap
- [x] **First-Class Text-Only Personalized Gifts**: Sanitized support for custom/handmade gifts with empty URLs.
- [x] **Mobile Responsive Viewport & Bottom Sheets**: Bottom-sheet dialogs on `< 640px` viewports, 16px iOS font scaling, safe-area inset clearance.
- [x] **PostgreSQL Connection Pool Stress Test**: 19-test concurrency benchmarking suite with resilient proxy failover.
- [x] **Fair-Use Allowance & Resource Limits Engine**:
  - **1 Free Hosted Event/yr** ($0, includes hosting + free participation).
  - **3 Free Joined Entries/yr** ($0, accommodates split families & friends).
  - **Resource Caps**: Secret Santa wishlist max 50 items; White Elephant strictly 1 item; AAR photos WebP.

---

### 🚀 P0-C: Self-Hosted Docker Compose & Community Distribution
- [x] **Docker Compose Architecture**: Docker container and Postgres healthcheck stack verified.
- [x] **Local Start/Stop Scripts**: Linux shell scripts (`start.sh`, `stop.sh`) and Windows batch scripts validated.
- [x] **Universal Email Dispatcher**: Direct SMTP and Brevo fallbacks operational.

---

## 🛠️ SECONDARY PRIORITIES (Infrastructure & Performance Scaling)

Once P0 functionality, test pages, and deployment pipelines are established, execute infrastructure hardening:

### 🚨 P1: Production Database Connection Pooling
- [ ] **Objective**: Implement PgBouncer / Prisma Accelerate connection pooling for holiday traffic bursts.

### ⏰ P2: Automated Background Cron & Event Engine
- [ ] **Objective**: Scheduled cron workers (Vercel Cron / QStash) for automated date-based phase shifts and email broadcasts.

### 🧪 P3: Automated Playwright E2E Suite
- [ ] **Objective**: Automated integration testing for registration, draw, and target swap UI.

### 📧 P4: Production Email Egress & DNS Reputation (`kovertklaus.com`)
- [ ] **Objective**: Configure SPF, DKIM, and DMARC DNS records on Cloudflare Registrar for `kovertklaus.com`.

### 🔒 P5: Distributed Session Store & Edge Auth Safety
- [ ] **Objective**: Session persistence across multi-region edge deployments.
