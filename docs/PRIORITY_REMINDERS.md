# 📋 KovertKlaus — Priority Reminders & Production Engineering Roadmap

- **Repository**: `KovertKlaus` (`~/projects/kovertklaus`)
- **Domain Focus**: Stealth Ops gift exchange application (`kovertklaus.com`)
- **Status**: Active Pre-Production Hardening & Scaling Roadmap
- **Last Updated**: August 11, 2026

---

## 🎯 Production Engineering Priorities

This document serves as the authoritative priority tracker for scaling, hardening, and launching KovertKlaus for production commercial deployment.

---

### 🚨 P1: Production Database Connection Pooling & Scaling
- [ ] **Objective**: Prevent connection exhaustion during November/December peak holiday usage bursts.
- [ ] **Technical Strategy**:
  - Integrate connection pooling middleware (**PgBouncer**, **Prisma Accelerate**, or serverless PostgreSQL pooling via Neon/Supabase).
  - Configure pool sizing and connection limits for production environment variables (`DATABASE_URL` with pooled connection strings).
  - Verify migration safety scripts (`export-db.ps1` and `restore-db.ps1`) under pooled connections.
- [ ] **Verification Criteria**: Run load test simulating 50 concurrent active operation draws without DB connection timeout errors.

---

### ⏰ P2: Automated Background Cron & Event Transition Engine
- [ ] **Objective**: Replace lazy request-driven phase transitions with deterministic, scheduled background execution.
- [ ] **Technical Strategy**:
  - Implement a background cron worker engine (e.g., **Vercel Cron**, **QStash**, or **BullMQ**).
  - Automatically evaluate `inviteCutoffDate`, `assignmentDate`, `shippingDate`, and `executionDate` every hour.
  - Trigger automated email broadcast reminders (`🔔 Nudge` alerts) to operatives with pending actions on milestone days.
- [ ] **Verification Criteria**: Automated test verifying operation transitions from `RECRUITING` ➔ `ASSIGNED` at midnight on `inviteCutoffDate` without manual web request triggers.

---

### 🧪 P3: End-to-End (E2E) Test Hardening (Playwright Suite)
- [ ] **Objective**: Prevent silent UI/API regressions during framework upgrades or feature refactors.
- [ ] **Technical Strategy**:
  - Set up a Playwright E2E testing framework (`e2e/` directory).
  - Build automated test flows for:
    1. Agent Registration ➔ Login ➔ Profile Setup.
    2. Operation Creation (`OpsLeader`) ➔ Base32 Invite Code Join (`Agent`).
    3. Sattolo Derangement Draw Execution ➔ Target-Swap Modal Invariant Verification.
    4. Wishlist Scraper Fast-Failover Modal (`2.5s AbortController` verification).
- [ ] **Verification Criteria**: `npm run test:e2e` passes 100% in CI/CD pipeline.

---

### 📧 P4: Production Email Egress & DNS Reputation (`kovertklaus.com`)
- [ ] **Objective**: Ensure 100% deliverability for operation invitations, nudge alerts, and assignment notifications.
- [ ] **Technical Strategy**:
  - Configure dedicated DNS records for `kovertklaus.com` on Cloudflare Registrar:
    - **SPF Record**: `v=spf1 include:... ~all`
    - **DKIM Record**: DomainKeys Identified Mail key signing.
    - **DMARC Policy**: `v=DMARC1; p=quarantine;`
  - Design transactional email HTML templates supporting both *Christmas Tree Light* and *Winter Nights Dark* branding.
- [ ] **Verification Criteria**: Test emails achieve 100/100 deliverability score on Mail-Tester without landing in spam folders.

---

### 🔒 P5: Distributed Session Store & Edge Auth Safety
- [ ] **Objective**: Ensure session persistence across multi-region edge deployments and serverless container restarts.
- [ ] **Technical Strategy**:
  - Evaluate stateless session verification or a distributed Redis session cache (e.g. **Upstash Redis**).
  - Verify HTTP-Only `SameSite=Strict` cookie persistence (`kovertklaus_session`) across serverless function restarts.
- [ ] **Verification Criteria**: User session remains valid across simulated instance cold starts and redeployments.

---

## 📌 Architectural Notes & Guidelines
- All work on priority items MUST adhere strictly to the domain nomenclature guidelines in [AGENTS.md](../AGENTS.md).
- Whenever modifying the database schema or algorithms, update [ARCHITECTURE.md](./ARCHITECTURE.md) and run existing unit tests (`npx tsx src/lib/draw.test.ts`).
