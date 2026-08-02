# 🚀 Cloudflare Pages Alpha Deployment Guide for KovertKlaus

This document provides a step-by-step walkthrough to deploy **KovertKlaus** to **Cloudflare Pages** for your Alpha release with your domain `kovertklaus.com`.

---

## 🛠️ Architecture Overview

- **Host Platform**: Cloudflare Pages (Free Tier: 100,000 requests/day, unlimited bandwidth)
- **Domain & DNS**: `kovertklaus.com` (Cloudflare Registrar & Native Cloudflare DNS)
- **Framework**: Next.js 16 (App Router)
- **Database**: Managed Serverless Postgres (Neon / Supabase / Cloudflare Hyperdrive)
- **Authentication**: `bcryptjs` + HTTP-Only Session Cookies

---

## 📋 Step 1: Provision Cloud Database (Neon / Supabase)

Cloudflare Workers operate in a serverless edge runtime, requiring a managed PostgreSQL database URL with SSL connection pooling.

1. Create a free PostgreSQL database at **[Neon.tech](https://neon.tech)** or **[Supabase.com](https://supabase.com)**.
2. Name the database `kovertklaus_alpha`.
3. Copy your database connection string:
   ```env
   DATABASE_URL="postgres://user:password@ep-kovert-db.neon.tech/kovertklaus_alpha?sslmode=require"
   ```
4. Push your Prisma database schema to the new remote database:
   ```bash
   DATABASE_URL="postgres://user:password@ep-kovert-db.neon.tech/kovertklaus_alpha?sslmode=require" npx prisma db push
   ```

---

## ☁️ Step 2: Deploy to Cloudflare Pages via Dashboard

1. Log into your **[Cloudflare Dashboard](https://dash.cloudflare.com/)**.
2. Navigate to **Workers & Pages ➔ Create Application ➔ Pages ➔ Connect to Git**.
3. Select your GitHub repository: `MrJSimpson/KovertKlaus`.
4. Configure Build Settings:
   - **Framework preset**: `Next.js`
   - **Build command**: `npx @cloudflare/next-on-pages@latest` or `npm run build`
   - **Build output directory**: `.vercel/output/static` or `.next`
5. Under **Environment Variables**, add:
   - Variable Name: `DATABASE_URL`
   - Value: `your-remote-postgres-url-with-sslmode=require`
   - Variable Name: `NODE_VERSION`
   - Value: `20`
6. Click **Save and Deploy**.

---

## 🌐 Step 3: Bind Custom Domain (`kovertklaus.com`)

1. In the Cloudflare Pages project settings, click **Custom Domains ➔ Set up a custom domain**.
2. Enter `kovertklaus.com` (and `www.kovertklaus.com`).
3. Click **Continue**. Since your domain is registered on Cloudflare Registrar, Cloudflare automatically configures the DNS CNAME records and issues your SSL/TLS certificates.

---

## 🔄 Step 4: Continuous Deployment

Every time you push commits to the `main` branch of `MrJSimpson/KovertKlaus`:
```bash
git add .
git commit -m "feat: new feature update"
git push origin main
```
Cloudflare Pages will automatically trigger a production build, run TypeScript checks, and update `kovertklaus.com` in seconds!
