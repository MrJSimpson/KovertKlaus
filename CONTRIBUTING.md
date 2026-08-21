# Contributing to KovertKlaus 🕵️‍♂️🎄

Thank you for your interest in contributing to **KovertKlaus**! Whether you are reporting a bug, proposing an architectural improvement, optimizing performance, or submitting a feature pull request, we welcome your collaboration.

To maintain the highest standards of software quality, security, and algorithmic integrity, all contributors must adhere to the engineering guidelines detailed below.

---

## 📜 Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md). Please treat fellow operatives with respect and professionalism.

---

## 🌲 Git Branching & Feature Workflow

We enforce a strict **pre-flight feature branching policy**:

> [!IMPORTANT]
> **ZERO Direct Commits to `main`**:
> Direct commits to the `main` branch are strictly prohibited across all repositories.

### Branch Naming Conventions
Always create an isolated, descriptive branch before making any code modifications:
- **Features**: `feat/<feature-name>` (e.g., `feat/white-elephant-steals`, `feat/export-csv`)
- **Bug Fixes**: `fix/<issue-name>` (e.g., `fix/email-timeout-retry`, `fix/ssrf-regex-parser`)
- **Documentation**: `docs/<topic>` (e.g., `docs/api-reference`, `docs/libreoffice-runbooks`)
- **Refactoring & Optimization**: `refactor/<subsystem>` (e.g., `refactor/lookup-query-io`)
- **Testing**: `test/<suite-name>` (e.g., `test/demerit-state-machine`)

### Standard Contribution Lifecycle
1. **Fork or Clone**:
   ```bash
   git clone https://github.com/MrJSimpson/KovertKlaus.git
   cd KovertKlaus
   ```
2. **Create Feature Branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Develop & Verify**:
   Implement changes with zero placeholders or ellipses (`// ...`).
5. **Execute Empirical Test Suite**:
   ```bash
   npx tsx src/worker.test.ts
   npx tsx src/lib/draw.test.ts
   npx tsx src/lib/db.test.ts
   npx tsx src/lib/security.test.ts
   npx tsx src/lib/demerits.test.ts
   npx tsx src/lib/email/email.test.ts
   npx tsc --noEmit
   npm run build
   ```
6. **Commit with Conventional Commits**:
   ```bash
   git commit -m "feat(matching): add 3-way cycle swap validation"
   ```
7. **Push to Remote & Open PR**:
   ```bash
   git push origin feat/your-feature-name
   ```

---

## 🏛️ Core Engineering & Architectural Invariants

All submitted code must strictly adhere to the project's architectural invariants:

### 1. Security & Defensive Ingestion
- **Cryptographic State & Sessions**: Never issue raw, unsigned identifiers (e.g., plain UUIDs) in cookies, tokens, or query strings. Always sign and verify session tokens using HMAC-SHA256 with constant-time equality checks (`crypto.timingSafeEqual`).
- **Parameter Tampering Defense**: Never fall back to untrusted request bodies or query parameters for identity (e.g., reject `body.userId` or `?userId=...` on authenticated endpoints). Identity must derive solely from verified session contexts.
- **Strict Trust Boundaries & SSRF Guarding**: Block non-standard IP formats (decimal, hex, octal), DNS rebinding wildcard domains, loopback, and private CIDR ranges on any external fetching logic. Always enforce `redirect: 'error'` on SSRF-sensitive fetch calls.
- **Server-Side PII Isolation**: Never rely on client-side filtering for sensitive data. Redact target graphs, addresses, and private records at the query/controller layer before serialization.

### 2. Concurrency, Database & Resource Lifecycle
- **Explicit Pool Teardown**: Always explicitly await connection closure and pool teardown (e.g., `client.$disconnect()`, `pool.end()`) inside `try...catch` blocks during cache invalidation or reconnection loops. Never leave unreferenced sockets dangling.
- **Atomic Mutation Boundaries**: Wrap multi-entity updates and cascaded operations inside atomic transactions (`db.$transaction([...])`). Eliminate sequential $O(N)$ database round-trips within loops.
- **Relational Indexing**: Ensure every foreign key filter, status lookup, and compound filter query is backed by explicit schema index directives.
- **Cryptographic Entropy**: Use Web Crypto / CSPRNG (`crypto.getRandomValues`) with rejection sampling to eliminate modulo bias for shuffles, tokens, and random indexing. Never use `Math.random()`.

### 3. Runtime Parity & Framework Contracts
- **Edge & Node Parity**: Maintain exact functional and behavioral parity between serverless/edge runtimes (e.g., Cloudflare Workers) and core framework controllers (e.g., Next.js App Router).
- **Directive Accuracy**: Explicitly specify runtime rendering directives (use `force-dynamic` where cookies, headers, or mutations occur; do not mix `force-static` with dynamic dependencies).
- **Strict Type Safety**: Zero tolerance for `any` escapes, implicit types, or unhandled null/undefined states. Ensure complete TypeScript coverage (`tsc --noEmit` clean).

### 4. Documentation, Diagrams & File Format Standards
- **Human-Readable Documents**: Ensure all text-based documents intended for human consumption (runbooks, manuals, formal specifications, operational overviews) are authored and maintained in open-source LibreOffice formats (`.odt` for documents, `.ods` for spreadsheets, `.odp` for presentations) alongside standard repository Markdown.
- **Visual Architecture & Diagrams**: All system architectures, data flows, entity relationships, and sequence diagrams must be authored and stored as native draw.io files (`.drawio` or `.drawio.svg`) to guarantee open-source maintainability and version control compatibility.
- **Technical Contract Accuracy**: Maintain accurate docstrings and TSDoc annotations that accurately reflect runtime algorithmic constraints and data complexity.

---

## 🧪 Testing Guidelines

PRs that introduce new features or bug fixes MUST include corresponding unit or integration tests:
- Algorithmic matching tests belong in [`src/lib/draw.test.ts`](file:///C:/Users/Joshua/projects/kovertklaus/src/lib/draw.test.ts).
- Security, SSRF, and hashing tests belong in [`src/lib/security.test.ts`](file:///C:/Users/Joshua/projects/kovertklaus/src/lib/security.test.ts).
- Demerit and penalty tests belong in [`src/lib/demerits.test.ts`](file:///C:/Users/Joshua/projects/kovertklaus/src/lib/demerits.test.ts).
- Email dispatcher tests belong in [`src/lib/email/email.test.ts`](file:///C:/Users/Joshua/projects/kovertklaus/src/lib/email/email.test.ts).
- Edge worker parity tests belong in [`src/worker.test.ts`](file:///C:/Users/Joshua/projects/kovertklaus/src/worker.test.ts).

---

## 💬 Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
- `feat(...)`: New feature or user-facing functionality
- `fix(...)`: Bug fix or edge-case remediation
- `docs(...)`: Documentation or diagram updates
- `refactor(...)`: Code structure improvements without behavioral changes
- `perf(...)`: Performance and database I/O optimizations
- `test(...)`: Adding or updating test suites
- `chore(...)`: Tooling, dependencies, or repository housekeeping

Thank you for contributing to secure, reliable, and delightful covert holiday missions! 🎄
