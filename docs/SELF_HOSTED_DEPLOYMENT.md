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

2. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   *Generate secure secrets for your deployment*:
   ```bash
   # On Linux/macOS:
   openssl rand -hex 32
   ```

3. **Start the Stack**:
   ```bash
   docker compose up -d
   ```

4. **Access the Application**:
   - **Main Web Application**: [http://localhost:3000](http://localhost:3000)
   - **North Pole Super Admin Console**: [http://localhost:3000/northpole](http://localhost:3000/northpole)
     - *Default Username*: `santa`
     - *Default Password*: `1sEcReTdEl!vErY` *(Change immediately in `/northpole/config`)*

---

## 🐳 Docker Compose Architecture

```yaml
services:
  kovertklaus-db:
    image: postgres:17-alpine
    container_name: kovertklaus-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-kovertklaus}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-kovertsecret}
      POSTGRES_DB: ${POSTGRES_DB:-kovertklaus}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  kovertklaus-app:
    build: .
    container_name: kovertklaus-app
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-kovertklaus}:${POSTGRES_PASSWORD:-kovertsecret}@kovertklaus-db:5432/${POSTGRES_DB:-kovertklaus}?schema=public
      SESSION_SECRET: ${SESSION_SECRET}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-1sEcReTdEl!vErY}
    ports:
      - "3000:3000"
    depends_on:
      kovertklaus-db:
        condition: service_healthy

volumes:
  postgres_data:
```

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
