# 🚀 KovertKlaus — Self-Hosted Docker Deployment Guide

This guide provides instructions for deploying KovertKlaus in a self-hosted environment using Docker and Docker Compose.

---

## 📋 Prerequisites
- **Docker Engine** (v24.0+)
- **Docker Compose** (v2.20+)
- 1 GB RAM & 5 GB available disk space

---

## ⚡ Quickstart (1-Command Launch)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/kovertklaus/kovertklaus.git
   cd kovertklaus
   ```

2. **Configure Environment Variables** (optional: only for settings such as email; see `.env.example`):
   ```bash
   cp .env.example .env
   ```

3. **Start the Stack**. The first command writes this install's own secrets to `.env`: a random
   `SESSION_SECRET` (replacing the `.env.example` placeholder) and a random database password. Upgrading
   from an install made before 1.1.0, it reuses the password in your `.env` `DATABASE_URL` or tells you
   to add it. `docker compose` refuses to start without both values, and the app refuses to start in
   production with a missing or placeholder `SESSION_SECRET`:
   ```bash
   npm run db:password
   docker compose up -d
   ```

4. **Access the Application**. On every start the app container brings the database schema up to date
   (`prisma db push`), and on the first start it seeds default themes and settings with no users; watch
   it with `docker logs kovertklaus-app` (`[db-bootstrap]` lines). An upgrade that would drop data stops
   the container with instructions instead (back up first). Set `KOVERTKLAUS_DB_BOOTSTRAP=off` to opt out.
   - **Main Web Application**: [http://localhost:2425](http://localhost:2425)
   - **North Pole Super Admin Console**: [http://localhost:2425/northpole](http://localhost:2425/northpole)
     - *First-Run Setup*: no default password ships. Read the one-time setup token from the server console (`docker logs kovertklaus-app`) and open `/northpole/setup` to create your administrator.

---

## 🐳 Docker Compose Architecture

[`docker-compose.yml`](../docker-compose.yml) is the source of truth. It runs two containers:

| Service | Image | Notes |
| :--- | :--- | :--- |
| `kovertklaus-db` | `postgres:16-alpine` | User `kovert`, database `kovertklaus`, password `POSTGRES_PASSWORD` from `.env`. Published on `127.0.0.1:5433` only (local tools); the app uses the internal network. Data in the `postgres_data` volume. |
| `kovertklaus-app` | built from `Dockerfile` | Port `2425`. Gets `DATABASE_URL` (built from `POSTGRES_PASSWORD`) and **`SESSION_SECRET`** from `.env`; both are required. Starts after the database is healthy. Account-deletion exports in the `kovertklaus_exports` volume. |

Only variables listed under `environment:` in `docker-compose.yml` reach the app container; `.env` alone only fills in the `${...}` placeholders. To pass another setting (for example SMTP), add it there or in a local `docker-compose.override.yml`.

---

## 📧 Transactional Email Setup (Optional)

Configure your preferred email method in the **North Pole Admin Console (`/northpole/config`)** without editing `.env` files:
1. **Local SMTP**: Enter your SMTP host, port, username, password, and SSL/TLS toggle.
2. **Brevo REST API**: Enter your Brevo API key for 300 free emails/day.
3. **Console Mock**: For offline local networks with no outbound internet access.

---

## 💾 Backups and Database Maintenance

To backup your PostgreSQL database:
```bash
docker exec -t kovertklaus-db pg_dump -U kovertklaus kovertklaus > backup_$(date +%Y%m%d).sql
```

To restore from a backup:
```bash
cat backup_20260824.sql | docker exec -i kovertklaus-db psql -U kovertklaus -d kovertklaus
```
