# 📋 KovertKlaus — Priority Reminders & Production Engineering Roadmap

- **Repository**: `KovertKlaus` (`~/projects/kovertklaus`)
- **Public Domain**: `kovertklaus.com` (Officially Purchased)
- **Production Strategy**: Functionality First ➔ Test Suite Verification ➔ Public CI/CD Deployment Repo
- **Last Updated**: August 11, 2026

---

## 🔥 TOP PRIORITIES (User-Defined Pre-Deployment Roadmap)

The following priorities take precedence over infrastructure optimizations. All core functionality and test verification MUST be complete before launching the public deployment pipeline.

---

### 🧪 P0-A: Internal Test Pages Suite (`/test` Verification Harness)
- [ ] **Objective**: Build a dedicated set of internal test pages under `/test` to isolate and empirically verify all critical UI components, state machine transitions, and algorithms before public launch.
- [ ] **Test Pages Breakdown**:
  1. **`/test/draw`**: Interactive visual test harness for the Sattolo derangement algorithm and mobile 2-way target cascade swap modal.
  2. **`/test/lifecycle`**: 5-Phase Operation Lifecycle test harness to cycle operations through `RECRUITING`, `SETUP`, `ASSIGNED`, `EXECUTED`, and `COMPLETED` with date overrides.
  3. **`/test/scraper`**: OpenGraph URL metadata web scraper test page with live fast-failover modal verification (2.5s AbortController).
  4. **`/test/theme`**: Dual-theme UI token catalog inspecting *Christmas Tree Light* (🎄) vs. *Winter Nights Dark* (❄️) container frames, buttons, and badges.
  5. **`/test/opkits`**: Dual OpKit validator verifying unlimited `WISHLIST` items vs. strict 1-item `WHITE_ELEPHANT` limit.
- [ ] **Verification Criteria**: All `/test` pages function cleanly without console errors or TypeScript build warnings.

---

### 🎨 P0-B: Feature Completeness & Pre-Deployment Polish Roadmap
- [ ] **Objective**: Finalize all core application workflows and user functionality before code freeze.
- [ ] **Feature Scope**:
  - **OpsLeader Console Polish**: Finalize phase-scoped action controls and manual date override inputs.
  - **Agent Onboarding Flow**: Streamline profile creation, Base32 invite code entry (`XXXX-YYYY`), and OpKit auto-initialization.
  - **Wishlist & OpTool Management**: Ensure seamless manual entry fallback, product link previews, and deletion controls.
  - **AAR & Demerit Immunity Interface**: Verify photo upload debriefs and automatic demerit waivers upon gift verification.
- [ ] **Verification Criteria**: Complete manual walkthrough of Simpson Family test operation (`SIMPSON-2026`) from recruitment through completion without blocking bugs.

---

### 🚀 P0-C: Public SaaS Pipeline & `kovertklaus.com` Deployment Roadmap
- [ ] **Objective**: Establish the official deployment architecture and set up a dedicated public CI/CD repository for `kovertklaus.com`.
- [ ] **Repository Architecture Strategy**:
  - **Development Base (`~/projects/kovertklaus`)**: Primary private development workspace, experimental features, internal test harness, and local staging.
  - **Public Deployment Repo (`~/projects/kovertklaus-public` or `kovertklaus-saas`)**: Clean, public-facing production codebase tied to GitHub Actions CI/CD and production hosting targeting `kovertklaus.com`.
- [ ] **Deployment Milestones**:
  1. **Repo Initialization**: Create and link the dedicated public CI/CD deployment repository.
  2. **Hosting Infrastructure**: Configure production host (Cloudflare Pages / Vercel / Railway / Docker host) with custom domain `kovertklaus.com`.
  3. **Environment & Database Provisioning**: Set up production environment secrets (`DATABASE_URL`, `JWT_SECRET`, `NEXTAUTH_SECRET`) and managed PostgreSQL database instance.
  4. **CI/CD Pipeline Setup**: Configure GitHub Actions to automatically run `npm run build`, execute unit tests (`src/lib/draw.test.ts`), and deploy clean releases to `kovertklaus.com` upon pushing to `main`.
- [ ] **Verification Criteria**: Pushing to the deployment repository triggers automated CI/CD and updates `https://kovertklaus.com` live without manual SSH intervention.

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
