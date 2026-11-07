# 🏷️ Versioning & Release Protocol

This protocol says **when** the version changes, **what** each release must include, and **where** its history is recorded. It applies to both editions: the self-hosted repository and the SaaS production mirror share one version number.

---

## 1. Version format

KovertKlaus uses [Semantic Versioning 2.0](https://semver.org/spec/v2.0.0.html) in the form **`MAJOR.MINOR.PATCH-stage`** (owner decision 2026-10-31):

| Part | Meaning |
| :--- | :--- |
| `MAJOR` | A change to the whole app, or a new feature area (§2) |
| `MINOR` | Changes inside an existing feature area |
| `PATCH` | The hotfix number: fixes to what is already released |
| `-stage` | `-alpha` or `-beta` while the product is in that stage. Dropped at general release, when one version covers SaaS and self-hosted. |

Examples: `1.1.0-beta`, `1.1.1-beta`, `2.0.0-beta`, and later `3.0.0`.

**History:** alpha releases used `0.MINOR.PATCH-alpha` (`0.2.0-alpha` to `0.8.0-alpha`). The first beta was published as `1.0.0-beta.1`, the only release in the old `1.0.0-beta.N` form; it keeps that number because its tag is public.

The single source of truth is `version` in `package.json`. `src/lib/version.ts` (`APP_VERSION`), the newest `CHANGELOG.md` section and the newest entry in `src/lib/announcements.ts` must match it. A unit test (`src/lib/version.test.ts`) fails the build when they drift.

---

## 2. When to bump

Versions follow **feature areas**, not files. The areas are:

**Missions** · **Wishlists** · **Accounts** · **Notifications & Email** · **North Pole** · **Shipping**

| Bump | Trigger (any one is enough) | Examples |
| :--- | :--- | :--- |
| **MAJOR** (`x.0.0`) | • A change that affects the whole app<br>• A new feature area | Installable mobile app (PWA), full visual refresh |
| **MINOR** (`x.y.0`) | • New or changed behaviour inside an existing area, even when it adds files<br>• A database schema change inside an area (operators must run `prisma db push`)<br>• A change operators must act on (new required env var, changed deploy step) | Head Elf approval for code joins (Missions), email verification (Accounts) |
| **PATCH** (`x.y.z`) | • Bug or security fix to released behaviour<br>• Small copy or UX correction | Worker email config fix, dead link removal |
| **No release** | Docs-only, tests-only or CI-only changes | Runner pin, README typo |

A release takes the **largest** bump among its changes: one MAJOR item makes the whole release MAJOR. Bumping a part resets the parts to its right (`1.1.2-beta` → `1.2.0-beta`). The changelog still labels each change as added, changed, fixed, security or removed.

---

## 3. Release cadence

There is **no scheduled release cycle** (owner decision 2026-10-31): a release ships when its scope is done and verified, not on a date.

- **Every pull request** with a user-visible or operator-visible change adds a line under `## [Unreleased]` in `CHANGELOG.md` (`Added`, `Changed`, `Fixed`, `Security`, `Removed`).
- **Cut a release** when the release branch's planned scope is merged and the branch is verified as a whole (§4). Urgent fixes ship as a hotfix PATCH (§4.6) as soon as they are verified.
- One release = **one release pull request** named `release: vX.Y.Z-stage`.

---

## 4. Release branches

Every release is built on its own branch, so all of its changes reach `main` (and production) at once, and conflicts are settled before the release, not during it (owner decision 2026-10-31).

```text
main ──────────────●─────────────────────────●  (one merge per release → one sync, one deploy, one tag)
                   │                         │
release/vX.Y.Z ────●──●──────●──────●────────●  (open while the release is in progress)
                      │      │      │
feat/… fix/… docs/… ──●      ●      ●           (work branches: cut from the release branch, PR back into it)
```

1. **Open the release branch** when the next release is known: `git checkout main && git pull && git checkout -b release/vX.Y.Z-stage && git push -u origin release/vX.Y.Z-stage`. Only one release branch is open at a time, apart from a hotfix patch release (step 6).
2. **Work branches** (`feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `sec/`) are cut **from the release branch**, and their pull requests **target the release branch** (`gh pr create --base release/vX.Y.Z-stage`), never `main`. Git cannot nest a branch under another branch's name (`release/v1.1.0-beta/fix-x` is not possible while `release/v1.1.0-beta` exists), so the base branch, not the name, makes a work branch part of a release.
3. **No conflicts at release time:** before a work branch's pull request is merged, merge the current release branch into it and resolve any conflicts there. The release branch itself is never edited directly; it only receives merged pull requests.
4. **Verify the release branch as a whole** on the test server before releasing: `npm test`, `npm run build`, and the checks listed in each merged pull request.
5. **Release:** the release checklist (§5) is the last pull request into the release branch (`release: vX.Y.Z-stage`). Then one pull request merges the release branch into `main`. That merge starts the SaaS sync and the production deploy once, and its merge commit is tagged.
6. **Hotfixes** for production problems that cannot wait go through a release branch too (owner decision 2026-11-07):
   - **One fix:** open `release/vX.Y.(Z+1)-stage` from `main`, cut `hotfix/<name>` from it and open the pull request against it, then release it as a PATCH with the checklist (§5). A patch release branch may be open alongside a release already in progress.
   - **Several fixes at once:** ship them together as the next MINOR release instead of a string of patches.
   - After the hotfix release reaches `main`, merge `main` into any other open release branch so it stays current and its later release merge stays conflict-free.
7. **Close:** after the release is deployed and tagged, delete the release branch and its merged work branches (§6).

---

## 5. Release checklist (the release pull request)

1. Bump `package.json` (+ `package-lock.json`) and `src/lib/version.ts`.
2. Move `[Unreleased]` into `## [X.Y.Z-stage] - YYYY-MM-DD` in `CHANGELOG.md`.
3. Add a **user-friendly** entry at the top of `src/lib/announcements.ts`: plain language, what changed for agents and Head Elves, no internal jargon. It appears in the What's New pop-up.
4. `npm test` and `npm run build` pass.
5. After merge: confirm the production deploy, then tag the dev repository's merge commit: `git tag -a vX.Y.Z-stage -m "KovertKlaus vX.Y.Z-stage"` and push the tag.
6. Prune branches (§6).

---

## 6. Branch pruning

After **every** release is merged and deployed, delete the release branch and its merged work branches. After a **MAJOR or MINOR** release, also delete every other **merged** branch except `main`, local and remote, in **both** repositories (`kovertklaus` and `kovertklaus-saas`). Branches that are not fully merged are listed for the owner to decide; they are never deleted automatically. Release history lives in the changelog, announcements and tags, so nothing is lost when branches go.

---

## 7. Where history is recorded

Release history is kept **outside the git log**, in three places with different audiences:

| Record | Audience | Content |
| :--- | :--- | :--- |
| `CHANGELOG.md` | Developers and self-hosters | Every notable change per version (Keep a Changelog format) |
| What's New pop-up (`src/lib/announcements.ts`) | Elf Agents and Head Elves | Friendly "what's new" notes per release |
| Owner's internal release log | Maintainers | Deploy notes, schema pushes, decisions (kept outside this repository) |

---

## 8. Credentials

Release notes, changelog entries, announcements, tags, commit messages and pull requests never contain credentials of any kind (passwords, including retired defaults, keys, tokens or connection strings with secrets). Refer to a secret by its variable name only.
