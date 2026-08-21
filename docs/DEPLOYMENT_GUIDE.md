# KovertKlaus — Production Deployment & Operations Guide 🚀

This guide provides step-by-step instructions for deploying KovertKlaus in **Production SaaS Mode (Cloudflare Workers + Neon PostgreSQL)** or **Self-Hosted Docker Mode (Personal / Home-Lab)**.

---

## 🌟 Architecture Modes Overview

KovertKlaus supports two primary deployment topologies:

```mermaid
graph TD
    subgraph Topology A: Cloudflare Edge + Serverless DB (Production SaaS)
        CF[Cloudflare Edge Network] -->|Static Assets| OutDir[/out Static Export]
        CF -->|Dynamic /api/*| Worker[src/worker.ts Edge Worker]
        Worker -->|WebSocket Pooling| Neon[(Neon Serverless PostgreSQL)]
        Worker -->|Transactional API| Brevo[Brevo Email REST API]
    end

    subgraph Topology B: Docker Compose Self-Hosted (Home / Family)
        DockerApp[Next.js Node.js Container :3000] -->|TCP Connection| PostgresContainer[(PostgreSQL 16 Container :5432)]
        DockerApp -->|Direct SMTP / Nodemailer| Postfix[Self-Hosted Mail / SMTP]
    end
```

---

## ☁️ Option 1: Cloudflare Workers + Neon PostgreSQL (Production SaaS)

This is the official production deployment configuration for `kovertklaus.com`.

### Prerequisites
1. **Cloudflare Account** with Wrangler CLI installed (`npm install -g wrangler`).
2. **Neon Serverless PostgreSQL** database instance.
3. **Brevo Account** for transactional email API key.

---

### Step 1: Database Provisioning on Neon
1. Create a Neon project with pooling enabled.
2. Retrieve the following three connection strings:
   - `DATABASE_URL`: Pooler connection string (`-pooler.c-2...neondb?sslmode=require&channel_binding=require`)
   - `DIRECT_URL`: Unpooled direct connection string (for migrations and schema pushes)
   - `DATABASE_ADMIN_URL`: Admin user connection string
3. Push schema and relational indexes to Neon:
   ```powershell
   $env:DIRECT_URL="postgresql://neondb_owner:password@ep-host.aws.neon.tech/neondb?sslmode=require"
   npx prisma db push
   ```

---

### Step 2: Cloudflare Environment Variables & Secrets
Configure the required runtime secrets in your Cloudflare dashboard or via Wrangler:

```bash
# 1. Cryptographic Session Secret (Min 32 characters)
npx wrangler secret put SESSION_SECRET

# 2. Database Connection Pooling Secrets
npx wrangler secret put DATABASE_URL
npx wrangler secret put DIRECT_URL
npx wrangler secret put DATABASE_ADMIN_URL

# 3. Transactional Email API Key
npx wrangler secret put BREVO_API_KEY
```

Verify your static configuration in `wrangler.json`:
```json
{
  "name": "kovertklaus",
  "main": "src/worker.ts",
  "compatibility_date": "2026-08-20",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "out",
    "binding": "ASSETS"
  }
}
```

---

### Step 3: Build & Static Asset Generation
Compile the Next.js static assets to `/out`:
```powershell
npm run build
```
Verify that `out/index.html`, `out/dashboard.html`, and `out/northpole/leads.html` are generated.

---

### Step 4: Deploy to Cloudflare Edge
```bash
npx wrangler deploy
```

---

## 🐳 Option 2: Self-Hosted Docker Compose (Personal / Home-Lab)

For families, clubs, and home-lab enthusiasts running KovertKlaus on a local server, Synology NAS, or private VPS.

### Quick Start (Linux / Windows)
```bash
# 1. Clone the repository
git clone https://github.com/MrJSimpson/KovertKlaus.git
cd KovertKlaus

# 2. Copy and configure environment variables
cp .env.example .env

# 3. Launch full stack via Docker Compose
docker compose up -d

# 4. Initialize database schema
docker compose exec app npx prisma db push
```

Access your instance at: `http://localhost:3000`

---

## 📊 Environment Variable Reference Matrix

| Variable Name | Required? | Default / Example | Purpose & Security Scope |
| :--- | :--- | :--- | :--- |
| `SESSION_SECRET` | **YES (Prod)** | `kovertklaus_dev_insecure_key...` | HMAC-SHA256 signing secret for session cookies. |
| `DATABASE_URL` | **YES** | `postgresql://user:pass@host:5432/neondb` | Primary pooled connection string. |
| `DIRECT_URL` | Optional | `postgresql://user:pass@host:5432/neondb` | Direct unpooled connection string for Prisma CLI. |
| `EMAIL_PROVIDER` | Optional | `auto` (`brevo`, `smtp`, `resend`, `console`) | Active transactional email provider. |
| `BREVO_API_KEY` | Optional | `xkeysib-...` | Brevo REST API key for zero-dependency edge dispatches. |
| `BREVO_SENDER_EMAIL` | Optional | `admin@kovertklaus.com` | Verified transactional sender email address. |
| `SMTP_HOST` | Optional | `mail.yourdomain.com` | SMTP host for self-hosted mail dispatch. |
| `SMTP_PORT` | Optional | `587` | SMTP port (587 for TLS, 465 for SSL). |
| `SMTP_USER` | Optional | `operative@yourdomain.com` | SMTP username. |
| `SMTP_PASS` | Optional | `********` | SMTP password. |
| `APP_MODE` | Optional | `selfhosted` (`saas`) | Open-core mode toggle vector. |

---

## 🩺 Health Checks & Verification

After deployment, verify the integrity of all subsystems:

1. **Edge Route Check**:
   ```bash
   curl -I https://kovertklaus.com
   # Expected: HTTP/2 200 (Served via Cloudflare Assets)
   ```
2. **API Auth & Session Verification**:
   ```bash
   curl -X POST https://kovertklaus.com/api/users \
     -H "Content-Type: application/json" \
     -d '{"action":"check","email":"test@example.com"}'
   # Expected: {"exists":false}
   ```
3. **Transactional Email Verification**:
   - Log into `/northpole` using your admin credentials.
   - Navigate to `/northpole/config`.
   - Trigger a Test Dispatch to verify provider receipts and retry backoff logs.
