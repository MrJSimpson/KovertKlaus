/**
 * @file assign-mission-codenames.ts
 * @description Gives every mission member without a codename one from the pool.
 *
 * Tier 1 (what): For each `ExchangeMember` whose `codename` is null, draws a codename that is free
 * in that mission and saves it unaccepted, so the agent can still reroll while recruiting.
 * Tier 2 (why): Before mission-assigned codenames, Head Elves and Covert Delivery joins were
 * enrolled without one. This is step 2 of the 2026-10-20 migration; it uses `CODENAME_POOL`
 * directly instead of copying the word lists into SQL.
 * Tier 3 (how): Run after `prisma/sql/2026-10-20_mission-codenames.forward.sql`:
 * `npx tsx --env-file=.env scripts/assign-mission-codenames.ts`. Idempotent: a second run finds
 * nothing to do. Prints how many members it updated.
 */
import { db } from '../src/lib/db';
import { enrollWithCodename } from '../src/lib/codename';

async function main(): Promise<void> {
  const blanks = await db.exchangeMember.findMany({
    where: { codename: null },
    select: { id: true, exchangeId: true },
    orderBy: { joinedAt: 'asc' },
  });

  for (const member of blanks) {
    // enrollWithCodename reads the current roster, so earlier assignments in this loop count as taken.
    await enrollWithCodename(db, member.exchangeId, (codename) =>
      db.exchangeMember.update({ where: { id: member.id }, data: { codename } })
    );
  }
  console.log(`Assigned codenames to ${blanks.length} mission member(s).`);
}

main()
  .catch((err) => {
    console.error('[assign-mission-codenames] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
