# KovertKlaus 🕵️‍♂️🎄

**Stealth Intelligence Gift Exchange Network for Families, Friends & Communities**

KovertKlaus turns standard Secret Santa exchanges into engaging, covert stealth operations. Featuring account reliability tracking (Demerits), reusable OpKit wishlists, automated product metadata scraping, in-person White Elephant support, and cyclic linked-list target assignments.

---

## 🤖 AI Agent Guidelines & Architecture Rules

Working on this repository as an AI assistant, subagent, or pair programmer? Please read **[`AGENTS.md`](./AGENTS.md)** before writing code! All AI agents MUST adhere to:
* **Nomenclature:** `OpsLeader`, `Agent`, `Agent-` codename prefixes, `OpKit`, `OpTool`, and `Active Operations (Exchanges)`.
* **Dual OpKits:** `WISHLIST` (unlimited requested items) vs `WHITE_ELEPHANT` (strictly 1 brought gift item).
* **Security:** OWASP password complexity, `bcryptjs` hashing (12 rounds), and 24h HTTP-only sessions.

---

## 🚀 Quick Start (Self-Hosting for Personal / Family Use)

KovertKlaus is container-native and ready to run on Docker out of the box.

```bash
# 1. Clone repository
git clone https://github.com/MrJSimpson/KovertKlaus.git
cd KovertKlaus

# 2. Launch PostgreSQL database and App container
docker compose up -d

# 3. Open browser
http://localhost:3000
```

---

## 📜 Licensing & Commercial Rights

- **Free Non-Commercial Self-Hosting**: Anyone can download, run, modify, and self-host KovertKlaus for personal, family, non-profit, or home-lab use for free.
- **Commercial Reservation**: Exclusive rights to operate and monetize KovertKlaus as a paid commercial SaaS service are reserved exclusively by **Joshua Simpson** (and designated successors/acquiring entities). Third parties may not host or re-sell KovertKlaus as a commercial paid service.

---

## 🌅 Long-Term Open Source Sunset Plan

Upon the eventual retirement of the original author (Joshua Simpson), unless KovertKlaus is acquired by a third-party purchaser:
- The commercial SaaS service will transition into a 100% free community project.
- The official domain will display a gratitude message to all participants and link directly to this open-source GitHub repository ([MrJSimpson/KovertKlaus](https://github.com/MrJSimpson/KovertKlaus)) so anyone can self-host KovertKlaus for free forever.
