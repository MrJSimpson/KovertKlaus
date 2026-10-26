/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import {
  agentTodo,
  cancellationReasonText,
  drawReadinessIssues,
  failureReasonFor,
  isRosterLocked,
  MIN_REPAIR_WINDOW_MS,
  parseRepairIssues,
  repairDeadlineFor,
  REPAIR_REMINDER_MS,
  runRepairSweep,
  timelineRepairUpdate,
  visibleRepairIssues,
  type ReadinessMission,
} from './mission-repair';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-10T12:00:00Z');
const ADDRESS = { streetAddress: '1 Elf Way', city: 'North Pole', state: 'AK', zipCode: '99705' };

function member(userId: string, opts: { address?: boolean; items?: number } = {}) {
  return { userId, user: { name: userId.toUpperCase(), ...(opts.address === false ? {} : ADDRESS) }, wishlistItemCount: opts.items ?? 1 };
}

function mission(members: ReadinessMission['members'], extra: Partial<ReadinessMission> = {}): ReadinessMission {
  return { isWhiteElephant: false, isLocalOnly: false, members, exclusionRules: [], ...extra };
}

test('Readiness - a full, prepared Secret Santa mission has no issues', () => {
  assert.deepStrictEqual(drawReadinessIssues(mission(['a', 'b', 'c', 'd'].map((u) => member(u)))), []);
});

test('Readiness - minimums are 4 for Secret Santa and 3 for White Elephant', () => {
  const three = ['a', 'b', 'c'].map((u) => member(u));
  assert.deepStrictEqual(drawReadinessIssues(mission(three))[0], { type: 'NOT_ENOUGH_AGENTS', have: 3, need: 4 });
  assert.deepStrictEqual(drawReadinessIssues(mission(three, { isWhiteElephant: true })), []);
  assert.deepStrictEqual(drawReadinessIssues(mission(three.slice(0, 2), { isWhiteElephant: true }))[0], { type: 'NOT_ENOUGH_AGENTS', have: 2, need: 3 });
});

test('Readiness - addresses are needed only for remote Secret Santa; every agent needs a wishlist item', () => {
  const ms = [member('a', { address: false }), member('b', { items: 0 }), member('c'), member('d')];
  assert.deepStrictEqual(drawReadinessIssues(mission(ms)), [
    { type: 'MISSING_ADDRESS', userId: 'a' },
    { type: 'EMPTY_WISHLIST', userId: 'b' },
  ]);
  assert.deepStrictEqual(drawReadinessIssues(mission(ms, { isLocalOnly: true })), [{ type: 'EMPTY_WISHLIST', userId: 'b' }]);
  assert.deepStrictEqual(drawReadinessIssues(mission(ms, { isWhiteElephant: true })), [{ type: 'EMPTY_WISHLIST', userId: 'b' }]);
});

test('Readiness - match rules that make the draw impossible are an issue', () => {
  const ms = ['a', 'b', 'c', 'd'].map((u) => member(u));
  // a may give to nobody: blocked from b, c and d.
  const rules = ['b', 'c', 'd'].map((r) => ({ memberId: 'a', restrictedMemberId: r }));
  assert.deepStrictEqual(drawReadinessIssues(mission(ms, { exclusionRules: rules })), [{ type: 'DRAW_IMPOSSIBLE' }]);
});

test('Repair deadline - halfway to the ship deadline (else Exchange Day), never under two days away', () => {
  const assign = new Date('2026-11-10T00:00:00Z');
  assert.strictEqual(
    repairDeadlineFor({ assignmentDate: assign, shippingDate: new Date('2026-11-20T00:00:00Z'), executionDate: new Date('2026-12-20T00:00:00Z') }, Date.parse('2026-11-10T00:00:00Z')).toISOString(),
    '2026-11-15T00:00:00.000Z'
  );
  assert.strictEqual(
    repairDeadlineFor({ assignmentDate: assign, shippingDate: null, executionDate: new Date('2026-11-30T00:00:00Z') }, Date.parse('2026-11-10T00:00:00Z')).toISOString(),
    '2026-11-20T00:00:00.000Z'
  );
  const late = Date.parse('2026-11-14T00:00:00Z');
  assert.strictEqual(repairDeadlineFor({ assignmentDate: assign, shippingDate: new Date('2026-11-20T00:00:00Z'), executionDate: assign }, late).getTime(), late + MIN_REPAIR_WINDOW_MS);
});

test('Repair - failure reasons and agent to-dos', () => {
  assert.strictEqual(failureReasonFor([{ type: 'NOT_ENOUGH_AGENTS', have: 2, need: 4 }, { type: 'EMPTY_WISHLIST', userId: 'a' }]), 'NOT_ENOUGH_AGENTS');
  assert.strictEqual(failureReasonFor([{ type: 'DRAW_IMPOSSIBLE' }]), 'DRAW_FAILED');
  assert.strictEqual(failureReasonFor([{ type: 'MISSING_ADDRESS', userId: 'a' }]), 'REPAIR_DEADLINE_MISSED');
  const issues = [{ type: 'MISSING_ADDRESS' as const, userId: 'a' }, { type: 'EMPTY_WISHLIST' as const, userId: 'a' }];
  assert.match(agentTodo(issues, 'a')!, /shipping address.*and.*wishlist/);
  assert.strictEqual(agentTodo(issues, 'b'), null);
});

test('Repair - cancellation reason says what was left unfixed, without names', () => {
  assert.strictEqual(
    cancellationReasonText([{ type: 'NOT_ENOUGH_AGENTS', have: 2, need: 4 }, { type: 'EMPTY_WISHLIST', userId: 'a' }]),
    'There were not enough agents to start the mission: 2 of the 4 needed had joined by the deadline.'
  );
  assert.match(cancellationReasonText([{ type: 'DRAW_IMPOSSIBLE' }]), /match rules/);
  assert.strictEqual(
    cancellationReasonText([{ type: 'EMPTY_WISHLIST', userId: 'a' }]),
    'The draw could not run: at the deadline, 1 agent still had an empty wishlist.'
  );
  assert.strictEqual(
    cancellationReasonText([{ type: 'MISSING_ADDRESS', userId: 'a' }, { type: 'MISSING_ADDRESS', userId: 'b' }]),
    'The draw could not run: at the deadline, 2 agents still had no shipping address.'
  );
  const mixed = cancellationReasonText([
    { type: 'MISSING_ADDRESS', userId: 'a' },
    { type: 'EMPTY_WISHLIST', userId: 'a' },
    { type: 'EMPTY_WISHLIST', userId: 'b' },
  ]);
  assert.strictEqual(mixed, 'The draw could not run: at the deadline, 2 agents still had an empty wishlist and 1 agent still had no shipping address.');
  assert.doesNotMatch(mixed, /a|b/, 'no agent identifiers in a reason every agent sees');
  assert.match(cancellationReasonText([]), /Problems blocking the draw/);
});

test('Repair - agents see only their own issues; the Head Elf sees all', () => {
  const raw = JSON.stringify([{ type: 'NOT_ENOUGH_AGENTS', have: 3, need: 4 }, { type: 'MISSING_ADDRESS', userId: 'a' }, { type: 'EMPTY_WISHLIST', userId: 'b' }]);
  assert.strictEqual(visibleRepairIssues(raw, 'boss', true), raw);
  assert.deepStrictEqual(parseRepairIssues(visibleRepairIssues(raw, 'a', false)), [{ type: 'NOT_ENOUGH_AGENTS', have: 3, need: 4 }, { type: 'MISSING_ADDRESS', userId: 'a' }]);
  assert.strictEqual(visibleRepairIssues(null, 'a', false), null);
  assert.deepStrictEqual(parseRepairIssues('not json'), []);
});

test('Repair - moving Target Draw later lifts the pause; other edits move the deadline', () => {
  const paused = { repairDeadline: new Date(NOW + DAY), assignmentDate: new Date(NOW - DAY), shippingDate: new Date(NOW + 10 * DAY), executionDate: new Date(NOW + 20 * DAY) };
  assert.deepStrictEqual(timelineRepairUpdate(paused, { assignmentDate: new Date(NOW + 3 * DAY) }, NOW), { repairDeadline: null, repairIssues: null, repairNoticeAt: null });
  const moved = timelineRepairUpdate(paused, { shippingDate: new Date(NOW + 30 * DAY) }, NOW);
  assert.ok((moved.repairDeadline as Date).getTime() > paused.repairDeadline.getTime());
  assert.deepStrictEqual(timelineRepairUpdate({ ...paused, repairDeadline: null }, { assignmentDate: new Date(NOW + DAY) }, NOW), {});
});

test('Repair - the roster locks once the draw has happened', () => {
  assert.strictEqual(isRosterLocked('RECRUITING'), false);
  assert.strictEqual(isRosterLocked('SETUP'), false);
  assert.strictEqual(isRosterLocked('MATCHED'), true);
  assert.strictEqual(isRosterLocked('SHIPPED'), true);
});

/** Fake Prisma client for `runRepairSweep`, with the one mission it touches. */
function fakeDb(overrides: Record<string, unknown> = {}) {
  const ex: any = {
    id: 'ex1', title: 'Family Swap', code: 'ABCD-1234', organizerId: 'boss', status: 'SETUP',
    isWhiteElephant: false, isLocalOnly: false,
    assignmentDate: new Date(NOW - DAY), shippingDate: new Date(NOW + 9 * DAY), executionDate: new Date(NOW + 20 * DAY),
    repairDeadline: null, repairNoticeAt: null, repairIssues: null,
    members: [
      { userId: 'boss', user: { name: 'Holly', email: 'boss@x.com', ...ADDRESS }, wishlist: { _count: { wishlistItems: 1 } } },
      { userId: 'u2', user: { name: 'Ivy', email: 'ivy@x.com' }, wishlist: { _count: { wishlistItems: 1 } } },
      { userId: 'u3', user: { name: 'Noel', email: 'noel@x.com', ...ADDRESS }, wishlist: { _count: { wishlistItems: 0 } } },
      { userId: 'u4', user: { name: 'Jo', email: 'jo@x.com', ...ADDRESS }, wishlist: { _count: { wishlistItems: 1 } } },
    ],
    exclusionRules: [],
    ...overrides,
  };
  const notices: any[] = [];
  const updates: any[] = [];
  const deleted: any[] = [];
  const db = {
    exchange: {
      update: async ({ data }: any) => (updates.push(data), Object.assign(ex, data)),
      findUnique: async () => ex,
      updateMany: async ({ data }: any) => (Object.assign(ex, data), { count: 1 }),
    },
    notification: {
      upsert: async ({ where, create, update }: any) => {
        const found = notices.find((n) => n.userId === where.userId_dedupeKey.userId && n.dedupeKey === where.userId_dedupeKey.dedupeKey);
        if (found) return Object.assign(found, update);
        notices.push({ ...create });
        return create;
      },
      deleteMany: async ({ where }: any) => {
        deleted.push(where);
        return { count: 0 };
      },
    },
  };
  return { db: db as any, ex, notices, updates, deleted };
}

function fakeDeps() {
  const repairEmails: any[] = [];
  const cancelEmails: any[] = [];
  return {
    repairEmails,
    cancelEmails,
    deps: {
      baseUrl: 'https://kk.test',
      sendEmail: async (e: any) => (cancelEmails.push(e), { success: true }),
      sendRepairEmail: async (e: any) => (repairEmails.push(e), { success: true }),
    },
  };
}

test('Repair sweep - issues pause the mission, reopen recruiting and tell the Head Elf and the agents at fault', async () => {
  const f = fakeDb();
  const d = fakeDeps();
  assert.strictEqual(await runRepairSweep(f.db, d.deps, f.ex, NOW), 'paused');
  assert.strictEqual(f.ex.status, 'RECRUITING');
  assert.strictEqual(new Date(f.ex.repairDeadline).toISOString(), '2026-11-14T12:00:00.000Z');
  assert.deepStrictEqual(parseRepairIssues(f.ex.repairIssues).map((i) => i.type), ['MISSING_ADDRESS', 'EMPTY_WISHLIST']);
  assert.deepStrictEqual(f.notices.map((n) => [n.userId, n.dedupeKey]).sort(), [['boss', 'repair:ex1'], ['u2', 'repair-agent:ex1'], ['u3', 'repair-agent:ex1']]);
  assert.match(f.notices.find((n) => n.userId === 'boss').message, /Agent|Ivy/);
  assert.deepStrictEqual(d.repairEmails.map((e) => [e.recipientEmail, e.isHeadElf]), [['boss@x.com', true], ['ivy@x.com', false], ['noel@x.com', false]]);
});

test('Repair sweep - reminds at most once a day, and only the Head Elf is emailed again', async () => {
  const f = fakeDb({ status: 'RECRUITING', repairDeadline: new Date(NOW + 2 * DAY), repairNoticeAt: new Date(NOW - 2 * 60 * 60 * 1000) });
  const d = fakeDeps();
  assert.strictEqual(await runRepairSweep(f.db, d.deps, f.ex, NOW), 'waiting');
  assert.strictEqual(d.repairEmails.length, 0);
  assert.strictEqual(await runRepairSweep(f.db, d.deps, f.ex, NOW + REPAIR_REMINDER_MS), 'reminded');
  assert.deepStrictEqual(d.repairEmails.map((e) => e.recipientEmail), ['boss@x.com']);
});

test('Repair sweep - fixed issues resume the mission and clear the notices', async () => {
  const ready = fakeDb({ status: 'RECRUITING', repairDeadline: new Date(NOW + DAY), repairNoticeAt: new Date(NOW) });
  ready.ex.members.forEach((m: any) => { Object.assign(m.user, ADDRESS); m.wishlist._count.wishlistItems = 1; });
  assert.strictEqual(await runRepairSweep(ready.db, fakeDeps().deps, ready.ex, NOW), 'ready');
  assert.strictEqual(ready.ex.status, 'SETUP');
  assert.strictEqual(ready.ex.repairDeadline, null);
  assert.ok(ready.deleted.some((w) => w.dedupeKey?.in?.includes('repair:ex1')));
});

test('Repair sweep - still blocked at the deadline: cancelled by the system with the reason', async () => {
  const f = fakeDb({ status: 'RECRUITING', repairDeadline: new Date(NOW - 1000), repairNoticeAt: new Date(NOW - DAY) });
  f.ex.members = f.ex.members.slice(0, 2).map((m: any) => ({ ...m, user: { ...m.user, ...ADDRESS }, wishlist: { _count: { wishlistItems: 1 } } }));
  const d = fakeDeps();
  assert.strictEqual(await runRepairSweep(f.db, d.deps, f.ex, NOW), 'cancelled');
  assert.strictEqual(f.ex.status, 'CANCELLED');
  assert.strictEqual(f.ex.cancelledBy, 'SYSTEM');
  assert.strictEqual(f.ex.cancelCode, 'NOT_ENOUGH_AGENTS');
  assert.match(f.ex.cancelReason, /not enough agents to start the mission: 2 of the 4 needed/);
  assert.ok(f.notices.some((n) => n.dedupeKey === 'mission-cancelled:ex1' && n.message.startsWith('KovertKlaus cancelled')));
});
