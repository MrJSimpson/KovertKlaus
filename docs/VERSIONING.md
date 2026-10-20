# 🏷️ Versioning & Release Protocol

This protocol says **when** the version changes, **what** each release must include, and **where** its history is recorded. It applies to both editions: the self-hosted repository and the SaaS production mirror share one version number.

---

## 1. Version format

KovertKlaus uses [Semantic Versioning 2.0](https://semver.org/spec/v2.0.0.html) with a release-stage suffix:

| Stage | Format | Window | Example |
| :--- | :--- | :--- | :--- |
| Alpha | `0.MINOR.PATCH-alpha` | now → Oct 31, 2026 | `0.3.0-alpha`, `0.3.1-alpha` |
| Beta (Season 1) | `1.0.0-beta.N` | Nov 1, 2026 → GA | `1.0.0-beta.1`, `1.0.0-beta.2` |
| General Availability | `MAJOR.MINOR.PATCH` | from Jan 31, 2027 | `1.0.0`, `1.1.0`, `1.1.1` |

The single source of truth is `version` in `package.json`. `src/lib/version.ts` (`APP_VERSION`), the newest `CHANGELOG.md` section and the newest entry in `src/lib/announcements.ts` must match it. A unit test (`src/lib/version.test.ts`) fails the build when they drift.

---

## 2. When to bump

Decide by the **highest-impact change** going into the release.

| Bump | Trigger (any one is enough) | Examples |
| :--- | :--- | :--- |
| **MINOR** (alpha: `0.x.0`; GA: `x.y.0`) | • A new capability users can see or use<br>• Any database schema change (operators must run `prisma db push`)<br>• A change operators must act on (new required env var, changed deploy step)<br>• A breaking change to an API, URL or workflow | Mission Comms channels, email invitations, session revocation (new column) |
| **PATCH** (`x.y.z`) | • Bug or security fix<br>• Small UX or copy change to an existing feature<br>• Performance or reliability fix | Worker email config fix, dead link removal |
| **No release** | Docs-only, tests-only or CI-only changes | Runner pin, README typo |

During **beta**, every release increments `N` (`1.0.0-beta.N`); the changelog still labels each change as a feature or a fix.

**MAJOR** changes only at GA (`1.0.0`) and afterwards for breaking changes to self-hosted operators (removed env vars, incompatible schema, removed API).

---

## 3. Release cadence

- **Every pull request** with a user-visible or operator-visible change adds a line under `## [Unreleased]` in `CHANGELOG.md` (`Added`, `Changed`, `Fixed`, `Security`, `Removed`).
- **Cut a release**
  - **minor:** as soon as the minor-triggering work is merged **and verified in production**;
  - **patch:** the same day a fix reaches production, or at the latest at the Monday retrospective if `[Unreleased]` has patch-level items.
- One release = **one release pull request** named `release: vX.Y.Z-stage`.

---

## 4. Release checklist (the release pull request)

1. Bump `package.json` (+ `package-lock.json`) and `src/lib/version.ts`.
2. Move `[Unreleased]` into `## [X.Y.Z-stage] - YYYY-MM-DD` in `CHANGELOG.md`.
3. Add a **user-friendly** entry at the top of `src/lib/announcements.ts`: plain language, what changed for agents and Head Elves, no internal jargon. It appears in the What's New pop-up.
4. `npm test` and `npm run build` pass.
5. After merge: confirm the production deploy, then tag the dev repository's merge commit: `git tag -a vX.Y.Z-stage -m "KovertKlaus vX.Y.Z-stage"` and push the tag.
6. **Minor releases only:** prune branches in both repositories (§5).

---

## 5. Branch pruning (every minor release)

After a minor release is merged and deployed, delete every **merged** branch except `main`, local and remote, in **both** repositories (`kovertklaus` and `kovertklaus-saas`). Branches that are not fully merged are listed for the owner to decide; they are never deleted automatically. Release history lives in the changelog, announcements and tags, so nothing is lost when branches go.

---

## 6. Where history is recorded

Release history is kept **outside the git log**, in three places with different audiences:

| Record | Audience | Content |
| :--- | :--- | :--- |
| `CHANGELOG.md` | Developers and self-hosters | Every notable change per version (Keep a Changelog format) |
| What's New pop-up (`src/lib/announcements.ts`) | Elf Agents and Head Elves | Friendly "what's new" notes per release |
| Owner's internal release log | Maintainers | Deploy notes, schema pushes, decisions (kept outside this repository) |

---

## 7. Credentials

Release notes, changelog entries, announcements, tags, commit messages and pull requests never contain credentials of any kind (passwords, including retired defaults, keys, tokens or connection strings with secrets). Refer to a secret by its variable name only.
