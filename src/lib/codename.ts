/**
 * @file codename.ts
 * @description Mission-assigned codenames: one pre-generated pool, drawn per mission.
 *
 * Tier 1 (what): `CODENAME_POOL` (adjective + noun from `codename-words.ts`) is the only source of codenames. `drawCodename` picks one that is
 * free in a mission roster; `enrollWithCodename` creates a member with a drawn codename;
 * `rerollCodename` and `acceptCodename` implement `/api/codename` for both the edge worker (SaaS)
 * and the Next.js route (self-hosted).
 * Tier 2 (why): Personal, account-wide codenames are no longer supported (alpha feedback,
 * 2026-10-20). A codename belongs to one `ExchangeMember`: assigned at random on join, rerolled
 * as often as the agent likes, and fixed once they accept it. Rerolls also stop when recruiting
 * closes, so every codename is fixed by the time of the draw.
 * Tier 3 (how): Draws use the CSPRNG in `getSecureRandomInt`. The database enforces uniqueness
 * with `@@unique([exchangeId, codename])`; two agents joining at the same moment can still draw
 * the same name, so `enrollWithCodename` retries on that unique violation.
 */

import type { PrismaClient } from '@prisma/client';
import { getSecureRandomInt } from '@/lib/security';
import { CODENAME_ADJECTIVES, CODENAME_NOUNS } from '@/lib/codename-words';

/**
 * Every assignable codename: one adjective and one noun with a space, e.g. `Snowy Spider`.
 * About 29,000 names, so a mission never runs out in practice. Words live in `codename-words.ts`.
 */
export const CODENAME_POOL: readonly string[] = CODENAME_ADJECTIVES.flatMap((adjective) =>
  CODENAME_NOUNS.map((noun) => `${adjective} ${noun}`)
);

/** Random picks `drawCodename` tries before scanning the whole pool for a free name. */
const RANDOM_TRIES = 20;

/** Attempts `enrollWithCodename` makes before giving up on concurrent collisions. */
const ENROLL_ATTEMPTS = 5;

/** Picks a random index below `maxExclusive`. Injectable for tests. */
export type RandomInt = (maxExclusive: number) => number;

/**
 * Draws a codename that is not in `taken` (compared case-insensitively).
 * Tries random pool names first (a mission uses a tiny fraction of the pool), then scans for a
 * free one. When the whole pool is taken, appends the lowest free number (`Snowy Spider 2`),
 * so a draw always succeeds.
 */
export function drawCodename(taken: Iterable<string | null | undefined>, randomInt: RandomInt = getSecureRandomInt): string {
  const used = new Set<string>();
  for (const name of taken) if (name) used.add(name.trim().toLowerCase());

  for (let i = 0; i < RANDOM_TRIES; i++) {
    const name = CODENAME_POOL[randomInt(CODENAME_POOL.length)];
    if (!used.has(name.toLowerCase())) return name;
  }

  const free = CODENAME_POOL.filter((name) => !used.has(name.toLowerCase()));
  if (free.length > 0) return free[randomInt(free.length)];

  const base = CODENAME_POOL[randomInt(CODENAME_POOL.length)];
  let n = 2;
  while (used.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}

/** Codenames already used in one mission. */
async function rosterCodenames(db: PrismaClient, exchangeId: string): Promise<string[]> {
  const members = await db.exchangeMember.findMany({ where: { exchangeId }, select: { codename: true } });
  return members.map((m) => m.codename).filter((c): c is string => Boolean(c));
}

/** True when `err` is a unique violation on the mission codename constraint. */
function isCodenameCollision(err: unknown): boolean {
  const e = err as { code?: string; meta?: { target?: unknown } } | null;
  if (e?.code !== 'P2002') return false;
  const target = e.meta?.target;
  return Array.isArray(target) ? target.includes('codename') : String(target ?? '').includes('codename');
}

/**
 * Draws a free codename for `exchangeId` and passes it to `create`, which inserts the member
 * (alone or inside a transaction). Draws again if another agent claimed the same name first.
 */
export async function enrollWithCodename<T>(
  db: PrismaClient,
  exchangeId: string,
  create: (codename: string) => Promise<T>
): Promise<T> {
  const tried: string[] = [];
  for (let attempt = 1; ; attempt++) {
    const codename = drawCodename([...(await rosterCodenames(db, exchangeId)), ...tried]);
    try {
      return await create(codename);
    } catch (err) {
      if (!isCodenameCollision(err) || attempt >= ENROLL_ATTEMPTS) throw err;
      tried.push(codename);
    }
  }
}

/** HTTP-shaped result shared by the worker and the Next route. */
export interface CodenameResult {
  status: number;
  body: { codename?: string; accepted?: boolean; error?: string };
}

/** Loads the caller's membership with the fields the codename rules need. */
async function findMember(db: PrismaClient, exchangeId: string, userId: string) {
  return db.exchangeMember.findUnique({
    where: { exchangeId_userId: { exchangeId, userId } },
    select: { id: true, codename: true, codenameAcceptedAt: true, exchange: { select: { status: true } } },
  });
}

/**
 * Gives the caller a new random codename in one mission.
 * Allowed only while the mission is recruiting and the codename is not yet accepted.
 */
export async function rerollCodename(db: PrismaClient, exchangeId: string, userId: string): Promise<CodenameResult> {
  const member = await findMember(db, exchangeId, userId);
  if (!member) return { status: 404, body: { error: 'You are not enrolled in this mission.' } };
  if (member.codenameAcceptedAt) return { status: 409, body: { error: 'Your codename is already accepted and cannot change.' } };
  if (member.exchange.status !== 'RECRUITING') {
    return { status: 409, body: { error: 'Codenames are fixed once recruiting closes.' } };
  }

  // The roster includes the caller's current codename, so a reroll always returns a different one.
  const updated = await enrollWithCodename(db, exchangeId, (codename) =>
    db.exchangeMember.update({ where: { id: member.id }, data: { codename }, select: { codename: true } })
  );
  return { status: 200, body: { codename: updated.codename ?? undefined, accepted: false } };
}

/** Fixes the caller's current codename for the rest of the mission. Idempotent. */
export async function acceptCodename(db: PrismaClient, exchangeId: string, userId: string): Promise<CodenameResult> {
  const member = await findMember(db, exchangeId, userId);
  if (!member) return { status: 404, body: { error: 'You are not enrolled in this mission.' } };
  if (!member.codename) return { status: 409, body: { error: 'No codename is assigned yet.' } };
  if (!member.codenameAcceptedAt) {
    await db.exchangeMember.update({ where: { id: member.id }, data: { codenameAcceptedAt: new Date() } });
  }
  return { status: 200, body: { codename: member.codename, accepted: true } };
}
