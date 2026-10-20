/**
 * @file assign-mission-codenames.ts
 * @description Gives pool codenames to members who have none, or an old one in a recruiting mission.
 *
 * Tier 1 (what): Reassigns, unaccepted, every `ExchangeMember` that (a) has no codename, or (b) is
 * in a RECRUITING mission, has not accepted, and holds a codename that is not in `CODENAME_POOL`
 * (an old personal name such as "PapaBear" or "Frost-Viper"). Each new name is free in its mission.
 * Tier 2 (why): Before mission-assigned codenames, Head Elves and Covert Delivery joins had no
 * codename, and everyone else carried their personal one. Missions past recruiting keep their
 * names (the forward SQL marks them accepted); recruiting missions move to the pool now, while
 * agents can still reroll (Joshua, 2026-10-20). Checking pool membership needs the word lists,
 * so this step lives here rather than in SQL.
 * Tier 3 (how): Run after `prisma/sql/2026-10-20_mission-codenames.forward.sql`:
 * `npx tsx --env-file=.env scripts/assign-mission-codenames.ts`. Idempotent: a second run finds
 * nothing to do. Prints how many members it updated.
 */
import { db } from '../src/lib/db';
import { CODENAME_POOL, enrollWithCodename } from '../src/lib/codename';

const POOL = new Set(CODENAME_POOL.map((name) => name.toLowerCase()));

async function main(): Promise<void> {
  const candidates = await db.exchangeMember.findMany({
    where: {
      OR: [
        { codename: null },
        { codenameAcceptedAt: null, exchange: { status: 'RECRUITING' } },
      ],
    },
    select: { id: true, exchangeId: true, codename: true },
    orderBy: { joinedAt: 'asc' },
  });
  const targets = candidates.filter((m) => !m.codename || !POOL.has(m.codename.toLowerCase()));

  for (const member of targets) {
    // enrollWithCodename reads the current roster, so earlier assignments in this loop count as taken.
    await enrollWithCodename(db, member.exchangeId, (codename) =>
      db.exchangeMember.update({ where: { id: member.id }, data: { codename, codenameAcceptedAt: null } })
    );
  }
  console.log(`Assigned pool codenames to ${targets.length} mission member(s).`);
}

main()
  .catch((err) => {
    console.error('[assign-mission-codenames] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
