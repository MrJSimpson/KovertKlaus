# KovertKlaus — Architecture & API Reference 🕵️‍♂️🎄

This document provides a comprehensive technical overview of the **KovertKlaus** application structure, database schemas, API routes, and design conventions.

---

## 🎯 1. Domain Nomenclature

| Term | Scope & Rule |
| :--- | :--- |
| **`OpsLeader`** | Organizer/creator of an operation. |
| **`Agent`** | Operative participant (codenames must use `Agent-` prefix). |
| **`OpKit`** | Wishlist container (`WISHLIST` or `WHITE_ELEPHANT`). |
| **`OpTool`** | Individual gift item. |
| **`Operation`** | Gift exchange event (`Mission`). |

---

## 🗄️ 2. Database Models (Prisma)

- **`User`**: Account details, codename, address, demerit count (`0-3`), `accountStatus`.
- **`Mission`**: Operation details, timeline dates (`inviteCutoffDate`, `assignmentDate`, `shippingDate`, `executionDate`), budget range, `opsLeaderAssistedDraw`, `drawVerifiedAt`.
- **`MissionAgent`**: Link between `User` and `Mission` (`role`, `targetUserId`, `shippingStatus`, `trackingNumber`, `deliveredConfirmed`).
- **`ExclusionRule`**: 100% Bidirectional match exclusion rules ($A \iff B$) between operatives.
- **`Wishlist`**: OpKit record (`name`, `type`, `userId`, `isMaster`).
- **`Item`**: Product catalog record (`name`, `url`, `price`, `description`, `thumbnailUrl`).
- **`WishlistItem`**: Join table connecting `Wishlist` to `Item`.
- **`IntelMessage`**: Anonymous chat message stream.
- **`Notification`**: In-app alert broadcasts and system notifications.
- **`AfterActionReport`**: Post-event gift thank-you messages and photo uploads.

---

## 🌐 3. API Route Reference

- **`POST /api/users/login`**: Authenticates user via bcrypt, sets HTTP-only cookie.
- **`GET / POST / PATCH / DELETE /api/users/me`**: Session profile retrieval (auto-creates default Master OpKit if missing), address/password updates, and logout.
- **`POST /api/users`**: Email existence check (`action: 'check'`) & account registration (`action: 'register'`).
- **`GET / POST / PATCH /api/operations`**: Operation retrieval by code/user, operation creation, target drawing (`action: 'draw'`), 2-way target swaps (`action: 'swap'`), exclusion rules (`action: 'addExclusion'`, `'removeExclusion'`), recruitment closing (`action: 'closeRecruitment'`), ending operation (`action: 'endOperation'`), team broadcasts (`action: 'sendOpTeamBroadcast'`), and After-Action Reports (`action: 'createReport'`).
- **`GET / POST / PATCH / DELETE /api/opkits`**: Persistent CRUD operations for OpKits and OpTools.
- **`POST /api/scraper`**: OpenGraph metadata scraper with 2.5s fast-failover timeout.
- **`POST /api/invitations/accept`**: Enrolls an agent into an operation via code.
- **`GET / POST /api/shipping`**: Shipping status and tracking waiver submission.
- **`GET / POST /api/demerits/audit`**: Demerit audit logs and citation records.

---

## 🎨 4. Theme System

Theme utilities are located in `src/lib/theme.ts`. Call `getThemeClasses(isDarkMode)` to obtain color tokens for Light 🎄 and Dark ❄️ (Icy) modes.
