# KovertKlaus — Self-Hosted Technical Architecture Specification 🕵️‍♂️🎄

**Document Version:** 1.0.0 (Self-Hosted Edition)  
**Target Release:** `v0.1.0-prealpha` ➔ `v1.0.0-beta`  
**Classification:** Open-Core Self-Hosted Architecture  

---

## 1. Executive Summary & System Overview

**KovertKlaus** is a self-hosted covert intelligence gift exchange network and reliability management platform designed for families, friends, communities, and home-lab enthusiasts. The system transforms standard Secret Santa and White Elephant gift exchanges into interactive holiday missions governed by automated reliability tracking (Coal Citations), reusable Wishlist Manifests, 100% bidirectional match exclusion matrices, cryptographic session integrity, and an isolated containerized Docker stack.

```mermaid
flowchart TD
    subgraph Client Layer
        Browser[Modern Web Browser / Mobile PWA]
    end

    subgraph Self-Hosted Container Stack [Docker Compose]
        App_Container[KovertKlaus Next.js App Container<br/>Node.js 24 Standalone Server :3000]
        DB_Container[(Local PostgreSQL 17 Container<br/>Persistent Volume :5432)]
        Prisma_ORM[Prisma Client v7<br/><code>@prisma/client</code> via Prisma Driver]
    end

    subgraph Outbound Dispatch & Intelligence
        Email_Gateway[Universal Email Gateway<br/>Local SMTP / Brevo / Resend]
        Scraper_Engine[OpenGraph Product Metadata Scraper<br/>Anti-SSRF Protected]
    end

    Browser -->|HTTP / HTTPS Traffic :3000| App_Container
    App_Container --> Prisma_ORM
    Prisma_ORM -->|TCP Connection :5432| DB_Container
    App_Container --> Email_Gateway
    App_Container --> Scraper_Engine
```

---

## 2. Canonical Domain Nomenclature

To preserve the tactical covert holiday aesthetic, KovertKlaus establishes standard domain mappings across code, schemas, and user interfaces:

| Domain Concept | Canonical Term | Code Symbol | Database Entity | Scope & Semantics |
| :--- | :--- | :--- | :--- | :--- |
| **Event Organizer** | **`Head Elf`** | `organizer` / `OpsLeader` | `User` / `Exchange.organizerId` | Creator and administrative leader of a holiday mission. |
| **Participant** | **`Elf Agent`** | `member` / `Agent` | `ExchangeMember` / `User` | Operative enrolled in the mission roster. |
| **Gift Exchange** | **`Holiday Mission`** | `exchange` / `Operation` | `Exchange` | The overarching gift exchange event (Secret Santa or White Elephant). |
| **Wishlist Container** | **`Wishlist Manifest`** | `manifest` / `OpKit` | `Wishlist` | Curated collection of desired gift items. |
| **Individual Gift Item** | **`Manifest Item`** | `item` / `OpTool` | `Item` / `WishlistItem` | Product listing containing title, URL, price, and thumbnail. |
| **Reliability Penalty** | **`Coal Citation`** | `demerit` / `penalty` | `User.penaltyPoints` | Reliability penalty point issued for unexcused deadline default. |

---

## 3. Containerized Next.js App Router Architecture

KovertKlaus is packaged as a high-performance, single-command Docker deployment:

```mermaid
sequenceDiagram
    autonumber
    actor Operative as Browser Client
    participant App as Next.js Node.js Server (:3000)
    participant Auth as HMAC Session Gate
    participant DB as PostgreSQL Database (:5432)
    participant Email as Email Gateway (SMTP / Brevo)

    Operative->>App: POST /api/operations (action: 'draw')
    App->>Auth: verifyToken(sessionCookie)
    Auth-->>App: Validated userId (Constant-Time HMAC)
    App->>DB: Fetch members & exclusion rules
    DB-->>App: Roster dataset
    Note over App: Execute Sattolo derangement algorithm
    App->>DB: db.$transaction([Update Member Targets, Exchange Status])
    DB-->>App: Transaction Committed
    App->>Email: sendAssignmentEmail() with exponential backoff
    Email-->>App: Delivery receipt (messageId)
    App-->>Operative: HTTP 200 { success: true, missionStatus: 'ASSIGNED' }
```

### Self-Hosted Run-time Components
1. **Next.js Standalone Server (`kovertklaus-app`)**: Multi-stage Alpine Linux container compiling Next.js with Turbopack and serving both React Server Components and dynamic API endpoints.
2. **PostgreSQL Database (`kovertklaus-db`)**: Official PostgreSQL image with healthcheck triggers, automated schema synchronization via `prisma db push`, and persistent named volume storage (`postgres_data`).
3. **Local & Cloud Email Flexibility**: Native support for standard self-hosted SMTP relays (Postfix, Mailcow, SendGrid, Gmail SMTP) or Brevo/Resend REST APIs.

---

## 4. Cryptographic State & Defensive Security Pipeline

```mermaid
flowchart LR
    subgraph Ingestion Gate
        Cookie[Cookie: kovertklaus_session] --> Split[Split: userId + '.' + signature]
        Secret[(SESSION_SECRET)] --> Calc[HMAC-SHA256 Calc]
        Split --> Calc
        Calc --> Comp{crypto.timingSafeEqual}
    end

    subgraph Authorization Pipeline
        Comp -->|Valid Signature| Hydrate[Hydrate Session Context]
        Comp -->|Tampered / Invalid| Reject[Clear Cookie & 401 Unauthorized]
    end
```

### Security Invariants:
1. **Timing-Safe Session Verification**: Constant-time `crypto.timingSafeEqual` prevents timing attacks on cookie validation.
2. **OWASP A01 SSRF Defensive Scraper**: The metadata scraper validates IP addresses before making HTTP requests, blocking internal subnet attacks (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, AWS metadata `169.254.169.254`, integer IPs, and DNS rebinding).
3. **Anti-Overwishing Budget Limits (+20%)**: Live validation blocks single items that exceed the event's configured hard cap, protecting group fairness.

---

## 5. Storage & Volume Management

```
/var/lib/docker/volumes/
└── kovertklaus_postgres_data/     <-- Persistent database files (PostgreSQL 17)
```

For complete deployment, backup, and environment configuration instructions, see [`docs/SELF_HOSTED_DEPLOYMENT.md`](SELF_HOSTED_DEPLOYMENT.md).
