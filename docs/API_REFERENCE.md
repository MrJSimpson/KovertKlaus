# KovertKlaus — REST API Reference 📡

This document provides a comprehensive specification of all REST API endpoints available in KovertKlaus.

All API routes are served uniformly across both the **Cloudflare Edge Worker Gateway** (`src/worker.ts`) and **Next.js App Router** (`src/app/api/**`).

---

## 🔐 Authentication & Session Headers

KovertKlaus uses cryptographic HMAC-SHA256 signed tokens for authentication:

| Auth Mechanism | Header / Cookie Name | Format & Description |
| :--- | :--- | :--- |
| **Operative Session Cookie** | `Cookie: kovertklaus_session=<token>` | Standard browser session cookie (`userId.signature`). |
| **Operative Auth Header** | `x-user-token: <token>` | Alternative header for API clients and mobile PWAs. |
| **Admin Auth Cookie** | `Cookie: kovertklaus_admin_session=<token>` | Administrative session cookie for North Pole Command (`adminId.signature`). |
| **Admin Auth Header** | `x-admin-token: <token>` | Alternative header for administrative API clients. |

---

## 1. Operative Authentication & Profile

### `POST /api/users/login`
Authenticates an operative using email and password, establishing an encrypted session.

- **Request Body**:
  ```json
  {
    "email": "agent.claus@kovertklaus.com",
    "password": "CorrectHorseBatteryStaple2026!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "user": {
      "id": "usr_99a8b7c6d5",
      "email": "agent.claus@kovertklaus.com",
      "name": "Agent Claus",
      "accountStatus": "ACTIVE",
      "demerits": 0
    },
    "token": "usr_99a8b7c6d5.8f9e...<hmac>"
  }
  ```

---

### `POST /api/users`
Performs pre-flight email availability checks or registers a new operative account.

- **Check Email Existence**:
  ```json
  {
    "action": "check",
    "email": "operative@example.com"
  }
  ```
  **Response**: `{"exists": false}`
- **Register New Operative**:
  ```json
  {
    "name": "James Bond",
    "email": "operative@example.com",
    "password": "SecurePassword10+",
    "inviteCode": "ALPHA-XXXXXXXXXXXXXXXX"
  }
  ```
  > [!NOTE]
  > While the release stage is `ALPHA` (North Pole → Config → Release Stage, stored in `SystemConfig.releaseStage`), an `inviteCode` is mandatory; at `BETA` anyone can register. It must either be a single-use pre-launch approval cipher (`ALPHA-XXXXXXXXXXXXXXXX`) granted by the North Pole, or an active exchange invitation code.
  > In every stage, a code that is sent must match: an unknown code is `404`, and a mission that is no longer recruiting or is full (its own cap, or the platform's agents-per-mission limit) is `400`.
  > Sign-ups are rate limited: 3 per IP per hour, 10 per IP per day, and 200 a day site-wide (a sign-up with a valid mission code skips the site-wide and hourly limits). A limited sign-up gets `429` with a `Retry-After` header.

  **Response `201 Created`**: Returns user profile and signed session token.

---

### `GET /api/users/me`
Retrieves the authenticated operative's profile, active mission memberships, and default Master Wishlist Manifest.

- **Headers**: Session cookie or `x-user-token`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "user": {
      "id": "usr_12345",
      "email": "operative@example.com",
      "name": "James Bond",
      "accountStatus": "ACTIVE",
      "demerits": 0,
      "address": "10 Downing Street",
      "organizedCount": 2,
      "joinedCount": 5
    }
  }
  ```

---

### `DELETE /api/users/me`
Terminates the active session by clearing authentication cookies.

- **Response `200 OK`**: `{"success": true, "message": "Logged out successfully"}`

---

## 2. Holiday Missions & Target Assignment (`/api/operations`)

### `GET /api/operations`
Fetches holiday mission details by mission code or lists operations for the authenticated user.

- **Query Parameters**:
  - `code=KOVERT-87WZ`: Fetches mission metadata, participant roster, rules, and user's target (if drawn).
  - `user=true`: Lists all missions organized or joined by the authenticated operative.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "operation": {
      "id": "op_98765",
      "title": "Operation Secret Klaus",
      "code": "KOVERT-87WZ",
      "status": "RECRUITING",
      "giftingType": "SECRET_SANTA",
      "isWhiteElephant": false,
      "budgetMin": 25,
      "budgetMax": 50,
      "currency": "USD",
      "inviteCutoffDate": "2026-12-01T00:00:00.000Z",
      "shippingDate": "2026-12-15T00:00:00.000Z",
      "executionDate": "2026-12-25T00:00:00.000Z",
      "members": [...],
      "exclusionRules": [...]
    }
  }
  ```

---

### `POST /api/operations` (Action Router)
Handles all mission lifecycle state transitions, matching derangements, and team broadcasts.

#### Action 1: Create Mission (`action: 'create'`)
```json
{
  "action": "create",
  "title": "Operation Winter Snow",
  "giftingType": "SECRET_SANTA",
  "isWhiteElephant": false,
  "isLocalOnly": false,
  "budgetMin": 20,
  "budgetMax": 40,
  "currency": "USD",
  "inviteCutoffDate": "2026-12-01",
  "assignmentDate": "2026-12-02",
  "shippingDate": "2026-12-15",
  "executionDate": "2026-12-25"
}
```

#### Action 2: Execute Target Draw (`action: 'draw'`)
Head Elf only. Runs the same readiness checks as the automatic draw (409 with `issues` when blocked), draws one gift circle through every agent, saves it in one transaction (status `MATCHED`), and sends each agent a 🎯 notification and an assignment email. If targets are already drawn it returns 409 with `requiresConfirmation: true` unless `forceUnlock: true` is sent; once the mission is `SHIPPED` or later the draw is refused. Rules that allow no circle return 400. Both runtimes share `src/lib/manual-draw.ts`.
```json
{
  "action": "draw",
  "exchangeId": "op_98765",
  "forceUnlock": false
}
```

#### Action 3: Circle-Preserving Target Swap (`action: 'swap'`)
Moves `newTargetId` into the gift circle right after `originatorId`: the originator gives to the new target, the new target gives to the originator's old target, and the new target's old giver takes the new target's old target. Three assignments change in one transaction, and the circle stays whole. Refused (400) if any new pair is blocked.
```json
{
  "action": "swap",
  "exchangeId": "op_98765",
  "originatorId": "usr_agent_1",
  "newTargetId": "usr_agent_4"
}
```

#### Action 4: Add / Remove Exclusion Rule (`action: 'addExclusion' | 'removeExclusion'`)
Rules are two-way. For a Secret Santa mission with at least 4 agents, `addExclusion` is refused (409) when the rule would leave any agent with fewer than 2 allowed partners or make one gift circle through every agent impossible.
```json
{
  "action": "addExclusion",
  "exchangeId": "op_98765",
  "agentId": "usr_husband",
  "restrictedAgentId": "usr_wife"
}
```

---

### `POST /api/invitations/accept`
Enrolls an operative into a holiday mission via invite code.

- **Request Body**:
  ```json
  {
    "inviteCode": "KOVERT-87WZ"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Enrolled into Operation Secret Klaus successfully",
    "exchangeCode": "KOVERT-87WZ"
  }
  ```
- **Codename**: the new member gets a random codename from the mission pool, unique within the mission (`data.assignedCodename`). Codenames belong to one mission; accounts have none.

### `POST /api/codename`
Rerolls or accepts the caller's codename in one mission.

- **Request Body**:
  ```json
  {
    "exchangeId": "uuid",
    "action": "reroll"
  }
  ```
  `action` is `reroll` or `accept`.
- **Response `200 OK`**:
  ```json
  {
    "codename": "Snowy Spider",
    "accepted": false
  }
  ```
- **Rules**: rerolls are unlimited until the agent accepts. `409` once the codename is accepted or the mission has left `RECRUITING`. `accept` is idempotent. `404` when the caller is not enrolled.

---

## 3. Mission Wishlists & Metadata Scraper

### `/api/wishlist`
The caller's Wishlist Manifest for one Holiday Mission. Each mission membership has its own list, created when the agent joins and deleted with the membership. All methods need a session (`401` without one) and return `404` when the caller is not in the mission or the item is not on their list for it.

- **`GET /api/wishlist?exchangeId=uuid`** returns the list and the mission's price rules:
  ```json
  {
    "success": true,
    "wishlist": {
      "id": "uuid",
      "type": "STANDARD",
      "items": [
        { "id": "uuid", "title": "Tactical Coffee Mug", "price": 24.99, "url": "https://shop.example/mug", "thumbnail": "https://shop.example/mug.jpg" }
      ]
    },
    "rules": { "itemMax": 30, "totalMax": null, "isWhiteElephant": false, "currency": "USD" }
  }
  ```
  `totalMax` is `null` when the Head Elf lets lists total more than the limit (`Exchange.allowWishlistOverBudget`, on by default).
- **`POST /api/wishlist`** adds an item: `{ "exchangeId", "title", "price", "url"?, "description"?, "thumbnail"?, "properties"?: { "isPersonalized", "details" } }`. Returns `{ "success": true, "item": { … } }`.
- **`PATCH /api/wishlist`** edits one: `{ "exchangeId", "itemId", …fields to change }`. Fields left out are kept.
- **`DELETE /api/wishlist?exchangeId=uuid&itemId=uuid`** removes one.
- **Rules** (`400` with a message the agent can act on): every item needs a price above zero; no item may cost more than the mission's `budgetMax`; when `totalMax` is set, the list may not total more than it; a personalized gift (no store link) needs a description; a White Elephant list holds exactly one item. An edit is checked with the item's resulting price, so an item left over a lowered limit must be fixed or removed.

---

### `POST /api/scraper`
Scrapes OpenGraph product title, price, and thumbnail metadata from e-commerce URLs with anti-SSRF protection.

- **Request Body**:
  ```json
  {
    "url": "https://www.amazon.com/dp/B08N5WRWNW"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "title": "Tactical Winter Beanie with LED Light",
    "price": 19.99,
    "imageUrl": "https://m.media-amazon.com/images/I/71xyz.jpg",
    "domain": "amazon.com"
  }
  ```

---

## 4. Shipping & Demerit Engine

### `POST /api/shipping`
Submits carrier tracking information for automated Carrier Protection Waiver immunity.

- **Request Body**:
  ```json
  {
    "exchangeId": "op_98765",
    "trackingNumber": "9400111899562537624132",
    "shippingStatus": "SHIPPED"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Tracking recorded. Carrier Protection Waiver applied."
  }
  ```

---

### `POST /api/demerits/audit`
Executes an automated Execution Day audit across all operatives in a mission.

- **Request Body**:
  ```json
  {
    "exchangeId": "op_98765"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "summary": {
      "audited": 12,
      "penalized": 1,
      "rehabilitated": 11,
      "protectedByTracking": 8
    }
  }
  ```

---

## 5. North Pole Administrative Console (`/api/northpole/*`)

All `/api/northpole/*` routes require North Pole Admin authentication (`x-admin-token` or admin session cookie).

### `GET /api/northpole/leads`
Queries clearance waitlist reservations with on-demand search and status filtering.

- **Query Parameters**: `q=email@domain.com`, `status=PENDING|APPROVED|REJECTED`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "leads": [
      {
        "id": "lead_123",
        "email": "agent@example.com",
        "name": "Agent Smith",
        "source": "early-access",
        "status": "APPROVED",
        "cipher": "ALPHA-A1B2C3D4E5F60718",
        "createdAt": "2026-08-21T12:00:00.000Z"
      }
    ],
    "totalCount": 42
  }
  ```

---

### `POST /api/northpole/leads` (Alpha Clearance Approval)
Approves a waitlist reservation, generating a cryptographically secure single-use `ALPHA-XXXXXXXXXXXXXXXX` (64-bit) activation cipher, saving it to `PreLaunchApproval`, updating the lead status to `APPROVED`, and dispatching an activation email with registration link.

- **Request Body**:
  ```json
  {
    "action": "approve",
    "id": "lead_123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "cipher": "ALPHA-A1B2C3D4E5F60718",
    "message": "Alpha clearance approved and activation email dispatched."
  }
  ```

---

### `DELETE /api/northpole/leads`
Purges a waitlist reservation from the clearance queue.

- **Query Parameters**: `id=lead_123`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Reservation for agent@example.com successfully purged from clearance queue."
  }
  ```

---

### `GET /api/northpole/users` (Lookup-Only)
Inspects a single operative record by ID, or searches records on demand with zero initial DB table scans.

- **Query Parameters**: `id=usr_123`, `q=claus`, `workshop=true` (self-hosted edition only)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "users": [
      {
        "id": "usr_123",
        "email": "operative@example.com",
        "name": "James Bond",
        "demerits": 0,
        "accountStatus": "ACTIVE",
        "isWorkshop": false
      }
    ],
    "totalCount": 1500
  }
  ```

---

### `POST /api/northpole/email/test`
Triggers an immediate transactional email dispatch test with automatic 3-attempt exponential backoff retry logging.

- **Request Body**:
  ```json
  {
    "recipientEmail": "admin@kovertklaus.com"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "result": {
      "success": true,
      "provider": "brevo",
      "messageId": "brevo-1724283921",
      "attempts": 1
    },
    "message": "Test email dispatched via brevo"
  }
  ```
