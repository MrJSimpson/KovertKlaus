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
      "codename": "Frosty-Nine",
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
    "action": "register",
    "email": "operative@example.com",
    "password": "SecurePassword10+",
    "name": "James Bond",
    "codename": "Agent-007",
    "address": "10 Downing Street, London"
  }
  ```
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
      "codename": "Agent-007",
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
Executes the Sattolo derangement algorithm, commits target assignments atomically, and dispatches target notification emails.
```json
{
  "action": "draw",
  "exchangeId": "op_98765"
}
```

#### Action 3: 2-Way Cascade Target Swap (`action: 'swap'`)
Swaps an operative's assigned target while atomically updating the displaced giver.
```json
{
  "action": "swap",
  "exchangeId": "op_98765",
  "originatorId": "usr_agent_1",
  "newTargetId": "usr_agent_4"
}
```

#### Action 4: Add / Remove Exclusion Rule (`action: 'addExclusion' | 'removeExclusion'`)
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

---

## 3. Wishlist Manifests & Metadata Scraper

### `GET /api/opkits`
Lists all Wishlist Manifests owned by the authenticated operative.

- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "manifests": [
      {
        "id": "kit_123",
        "name": "Primary Holiday Manifest",
        "type": "WISHLIST",
        "isMaster": true,
        "items": [
          {
            "id": "item_456",
            "name": "Tactical Coffee Mug",
            "url": "https://amazon.com/dp/B08...",
            "price": 24.99,
            "thumbnailUrl": "https://m.media-amazon.com/..."
          }
        ]
      }
    ]
  }
  ```

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
        "source": "coming-soon",
        "status": "APPROVED",
        "createdAt": "2026-08-21T12:00:00.000Z"
      }
    ],
    "totalCount": 42
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

- **Query Parameters**: `id=usr_123`, `q=claus`, `workshop=true`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "users": [
      {
        "id": "usr_123",
        "email": "operative@example.com",
        "name": "James Bond",
        "codename": "Agent-007",
        "demerits": 0,
        "accountStatus": "ACTIVE",
        "isWorkshop": true
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
