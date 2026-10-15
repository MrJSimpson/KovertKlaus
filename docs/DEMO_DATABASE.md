# 🧪 Demo Database (Self-Hosted Only)

The demo database lets you **try KovertKlaus on your own machine before you set up a real server**. One command fills a local database with six demo Elf Agents and three Holiday Missions at different stages. A second command removes all of it again.

> The demo is for the self-hosted edition only. The script refuses to run when `MODE=SAAS` or when `DATABASE_URL` points at anything other than a local or Docker Compose database.

---

## What you get

| Mission | Stage | What to try |
| :--- | :--- | :--- |
| **Demo: Family Secret Santa** | Recruiting (cutoff in 7 days) | Invite agents (one invitation is already pending), edit the timeline, nudge an agent, use the Command channel |
| **Demo: Office Secret Santa** | Targets drawn, shipping open | See your target's Wishlist Manifest, send anonymous Intel, add a tracking number, swap targets as Head Elf |
| **Demo: White Elephant Night** | Completed, in person | Read the Debrief, see the one-item White Elephant manifests |

Every demo agent has a Secret Santa Wishlist Manifest (including text-only gifts) and a one-item White Elephant manifest. Mission dates are set **relative to when you load the demo**, so the missions always look current.

| Account | Role |
| :--- | :--- |
| `holly@demo.invalid` | **Head Elf** of every demo mission. Start here. |
| `juniper@demo.invalid` | Elf Agent. Already shipped her gift in the Office mission. |
| `rudy@demo.invalid`, `ivy@demo.invalid`, `nick@demo.invalid`, `pepper@demo.invalid` | Elf Agents |

`.invalid` is a reserved domain that can never receive mail, so the demo never emails anyone. Demo agents also have email notifications turned off.

---

## Load it

You need the self-hosted stack running with an **empty or throwaway** database (see the [Quick Start](../README.md#-quick-start-self-hosting-for-personal--family-use)).

1. Make sure `.env` points `DATABASE_URL` at your local database. With the Docker Compose database, that is port **5433** on `localhost`.
2. Create the tables if you have not yet: `npm run db:push`
3. Load the demo:

   ```bash
   npm run demo:load
   ```

4. The script prints the demo accounts and a **password generated just for this load**. It is shown once and is not stored anywhere in the repository. To choose your own, set it for one run:

   ```bash
   DEMO_PASSWORD='<your password>' npm run demo:load          # Linux / macOS
   $env:DEMO_PASSWORD='<your password>'; npm run demo:load     # Windows PowerShell
   ```

   A chosen password must meet the normal rules: 10+ characters with upper and lower case, a number and a symbol.

5. Open `http://localhost:3000/signin` and sign in as `holly@demo.invalid`.

Running `npm run demo:load` again **replaces** the previous demo data with a fresh copy (and a new password).

---

## Remove it

```bash
npm run demo:remove
```

This deletes every `@demo.invalid` account and every mission they organize. Your own accounts and missions are not touched. Demo accounts are also flagged as test users (`isWorkshop`), so the North Pole user list can filter them.

---

## Safety rules built into the script

- **Self-hosted only:** exits if `MODE=SAAS`.
- **Local databases only:** accepts `localhost`, `127.0.0.1`, `::1` and the Docker Compose hosts (`kovertklaus-db`, `db`, `postgres`, `host.docker.internal`). Anything else needs `--allow-remote-host`, which you should pass only for a database you are willing to fill with demo data.
- **No stored credentials:** no password exists in the repository. Each load generates one, or uses `DEMO_PASSWORD`.
- **Exact cleanup:** removal matches only the reserved `@demo.invalid` domain.

---

## Backing up your real data

The demo is not a backup tool. To back up or restore your own container database, use `export-db.bat` / `restore-db.bat` (Windows). They write to `backups/kovertklaus-backup.sql`, which is gitignored because it contains your real data. Never commit it.
