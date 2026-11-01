/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import type { PrismaClient } from '@prisma/client';
import {
  decideJoinRequest,
  isRsvpClosed,
  issueInviteToken,
  joinMission,
  joinWithInviteAtSignup,
  myJoinRequests,
  pendingJoinRequests,
  readInviteToken,
  REQUEST_SENT_MESSAGE,
  requestToJoinAtSignup,
  viewerJoinRequest,
  type JoinMission,
} from './join-requests';
import { invitationLink } from './invitations';
import { issueVerifyToken } from './email-verification';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 2, 18);

function mission(over: Partial<JoinMission> = {}): JoinMission {
  return {
    id: 'm1', code: 'SNOW-1234', title: 'Snowfall', status: 'RECRUITING', organizerId: 'boss',
    isWhiteElephant: false, maxParticipants: null, inviteCutoffDate: new Date(NOW + 5 * DAY), ...over,
  };
}

/** In-memory world: members, requests, invitations, notifications. */
function world(opts: { members?: string[]; invitations?: any[]; maxAgents?: number } = {}) {
  const members: Array<{ id: string; exchangeId: string; userId: string; codename: string | null }> = (opts.members ?? ['boss']).map((u, i) => ({
    id: `mem${i}`, exchangeId: 'm1', userId: u, codename: null,
  }));
  const requests: any[] = [];
  const invitations: any[] = opts.invitations ?? [];
  const notes = new Map<string, any>();
  let seq = 0;
  const db: any = {
    exchangeMember: {
      findFirst: async ({ where }: any) => members.find((m) => m.exchangeId === where.exchangeId && m.userId === where.userId) ?? null,
      findMany: async ({ where }: any) => members.filter((m) => m.exchangeId === where.exchangeId),
      count: async ({ where }: any) => members.filter((m) => m.exchangeId === where.exchangeId).length,
      create: async ({ data }: any) => {
        const row = { id: `mem${members.length}`, exchangeId: data.exchangeId, userId: data.userId, codename: data.codename };
        members.push(row);
        return row;
      },
    },
    missionJoinRequest: {
      findUnique: async ({ where }: any) =>
        where.id
          ? requests.find((r) => r.id === where.id) ?? null
          : requests.find((r) => r.exchangeId === where.exchangeId_userId.exchangeId && r.userId === where.exchangeId_userId.userId) ?? null,
      findMany: async ({ where }: any) =>
        requests
          .filter((r) => (where.exchangeId ? r.exchangeId === where.exchangeId : r.userId === where.userId))
          .filter((r) => (where.status?.in ? where.status.in.includes(r.status) : !where.status || r.status === where.status))
          .map((r) => ({ ...r, user: { id: r.userId, name: r.userId.toUpperCase(), emailVerifiedAt: r.userId === 'unverified' ? null : new Date(0) }, exchange: { title: 'Snowfall', code: 'SNOW-1234', status: r._missionStatus ?? 'RECRUITING', inviteCutoffDate: r._cutoff ?? new Date(NOW + 5 * DAY) } })),
      count: async ({ where }: any) => requests.filter((r) => r.exchangeId === where.exchangeId && r.status === where.status).length,
      upsert: async ({ where, create, update }: any) => {
        const found = requests.find((r) => r.exchangeId === where.exchangeId_userId.exchangeId && r.userId === where.exchangeId_userId.userId);
        if (found) return Object.assign(found, update);
        const row = { id: `req${++seq}`, status: 'PENDING', createdAt: new Date(NOW), decidedAt: null, decidedById: null, ...create };
        requests.push(row);
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(requests.find((r) => r.id === where.id), data),
      updateMany: async ({ where, data }: any) => {
        for (const r of requests) if (r.exchangeId === where.exchangeId && r.userId === where.userId && r.status === where.status) Object.assign(r, data);
        return { count: 1 };
      },
    },
    missionInvitation: {
      findUnique: async ({ where }: any) => invitations.find((i) => i.id === where.id) ?? null,
      update: async ({ where, data }: any) => Object.assign(invitations.find((i) => i.id === where.id), data),
      updateMany: async () => ({ count: 0 }),
    },
    user: { findUnique: async ({ where }: any) => ({ email: `${where.id}@example.com` }) },
    notification: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.userId_dedupeKey.userId}|${where.userId_dedupeKey.dedupeKey}`;
        notes.set(key, { ...(notes.get(key) ?? create), ...update });
      },
      deleteMany: async ({ where }: any) => void notes.delete(`${where.userId}|${where.dedupeKey}`),
    },
  };
  const adminDb: any = { systemConfig: { findUnique: async () => (opts.maxAgents ? { maxMissionAgents: opts.maxAgents } : null) } };
  return { deps: { db: db as PrismaClient, adminDb: adminDb as PrismaClient }, db: db as PrismaClient, members, requests, invitations, notes };
}

test('Join - a bare mission code files a request, once, and tells the Head Elf', async () => {
  const w = world();
  const r = await joinMission(w.deps, mission(), { userId: 'ivy' }, NOW);
  assert.deepStrictEqual([r.status, r.body.pending, r.body.message], [200, true, REQUEST_SENT_MESSAGE]);
  assert.ok(!w.members.some((m) => m.userId === 'ivy'), 'not enrolled yet');
  assert.strictEqual(w.requests.length, 1);
  const again = await joinMission(w.deps, mission(), { userId: 'ivy' }, NOW);
  assert.strictEqual(again.body.pending, true);
  assert.strictEqual(w.requests.length, 1, 'idempotent');

  await joinMission(w.deps, mission(), { userId: 'noel' }, NOW);
  const alert = w.notes.get('boss|join-requests:m1');
  assert.match(alert.title, /Join requests: Snowfall/);
  assert.match(alert.message, /2 agents have asked/);
});

test('Join - refused for the Head Elf, members, closed RSVP, and after a decline', async () => {
  const w = world({ members: ['boss', 'ivy'] });
  assert.strictEqual((await joinMission(w.deps, mission(), { userId: 'boss' }, NOW)).status, 409);
  assert.strictEqual((await joinMission(w.deps, mission(), { userId: 'ivy' }, NOW)).status, 409);
  const late = mission({ inviteCutoffDate: new Date(NOW - 2 * DAY) });
  assert.strictEqual((await joinMission(w.deps, late, { userId: 'noel' }, NOW)).status, 400);
  assert.strictEqual((await joinMission(w.deps, mission({ status: 'MATCHED' }), { userId: 'noel' }, NOW)).status, 400);

  await joinMission(w.deps, mission(), { userId: 'jo' }, NOW);
  await decideJoinRequest(w.deps, mission(), { actorId: 'boss', requestId: w.requests[0].id, decision: 'decline' }, NOW);
  const back = await joinMission(w.deps, mission(), { userId: 'jo' }, NOW);
  assert.strictEqual(back.status, 403);
});

test('Join - RSVP closes the day after the cutoff date, or when recruiting ends', () => {
  const cutoff = new Date(NOW);
  assert.strictEqual(isRsvpClosed({ status: 'RECRUITING', inviteCutoffDate: cutoff }, NOW + DAY - 1), false);
  assert.strictEqual(isRsvpClosed({ status: 'RECRUITING', inviteCutoffDate: cutoff }, NOW + DAY), true);
  assert.strictEqual(isRsvpClosed({ status: 'SETUP', inviteCutoffDate: new Date(NOW + 9 * DAY) }, NOW), true);
});

test('Join - an emailed invitation link joins directly, once', async () => {
  const w = world({ invitations: [{ id: 'inv1', exchangeId: 'm1', status: 'PENDING', email: 'Ivy@Example.com' }] });
  const token = issueInviteToken('inv1');
  const r = await joinMission(w.deps, mission(), { userId: 'ivy', inviteToken: token }, NOW);
  assert.deepStrictEqual([r.status, r.body.joined], [200, true]);
  assert.ok(w.members.some((m) => m.userId === 'ivy'));
  assert.strictEqual(w.invitations[0].status, 'ACCEPTED');
  assert.strictEqual(w.invitations[0].userId, 'ivy');

  // The same link again only files a request.
  const reuse = await joinMission(w.deps, mission(), { userId: 'noel', inviteToken: token }, NOW);
  assert.strictEqual(reuse.body.pending, true);
});

test('Join - a forwarded invitation link (another email) files a request and leaves the invitation open', async () => {
  const w = world({ invitations: [{ id: 'inv1', exchangeId: 'm1', status: 'PENDING', email: 'ivy@example.com' }] });
  const r = await joinMission(w.deps, mission(), { userId: 'noel', inviteToken: issueInviteToken('inv1') }, NOW);
  assert.strictEqual(r.body.pending, true);
  assert.ok(!w.members.some((m) => m.userId === 'noel'));
  assert.strictEqual(w.invitations[0].status, 'PENDING', 'Ivy can still use it');
  assert.strictEqual((await joinMission(w.deps, mission(), { userId: 'ivy', inviteToken: issueInviteToken('inv1') }, NOW)).body.joined, true);
});

test('Join - forged, foreign and other-purpose tokens fall back to a request', async () => {
  const w = world({ invitations: [{ id: 'other', exchangeId: 'm2', status: 'PENDING', email: 'ivy@example.com' }] });
  for (const inviteToken of ['nope', issueInviteToken('other'), issueVerifyToken('ivy', 'ivy@example.com', NOW + DAY)]) {
    const r = await joinMission(w.deps, mission(), { userId: 'ivy', inviteToken }, NOW);
    assert.strictEqual(r.body.pending, true, inviteToken.slice(0, 12));
  }
  assert.strictEqual(readInviteToken(issueInviteToken('abc')), 'abc');
  assert.strictEqual(readInviteToken('abc.def'), null);
});

test('Join - an invitation link settles an earlier request for the same mission', async () => {
  const w = world({ invitations: [{ id: 'inv1', exchangeId: 'm1', status: 'PENDING', email: 'Ivy@Example.com' }] });
  await joinMission(w.deps, mission(), { userId: 'ivy' }, NOW);
  await joinMission(w.deps, mission(), { userId: 'ivy', inviteToken: issueInviteToken('inv1') }, NOW);
  assert.strictEqual(w.requests[0].status, 'APPROVED');
  assert.ok(!w.notes.has('boss|join-requests:m1'), 'Head Elf alert cleared: nothing pending');
});

test('Join - sign-up with a code: link joins, bare code requests', async () => {
  const w = world({ invitations: [{ id: 'inv1', exchangeId: 'm1', status: 'PENDING', email: 'Ivy@Example.com' }] });
  assert.strictEqual(await joinWithInviteAtSignup(w.deps, mission(), 'ivy', issueInviteToken('inv1'), NOW), true);
  assert.strictEqual(await joinWithInviteAtSignup(w.deps, mission(), 'noel', null, NOW), false);
  assert.strictEqual(await requestToJoinAtSignup(w.db, mission(), 'noel', NOW), true);
  assert.deepStrictEqual(w.requests.map((r) => r.userId), ['noel']);
});

test('Decide - only the Head Elf; approve enrolls and notifies; decline notifies', async () => {
  const w = world();
  await joinMission(w.deps, mission(), { userId: 'ivy' }, NOW);
  await joinMission(w.deps, mission(), { userId: 'noel' }, NOW);
  const [ivy, noel] = w.requests;

  assert.strictEqual((await decideJoinRequest(w.deps, mission(), { actorId: 'ivy', requestId: ivy.id, decision: 'approve' }, NOW)).status, 403);
  assert.strictEqual((await decideJoinRequest(w.deps, mission(), { actorId: 'boss', requestId: ivy.id, decision: 'maybe' }, NOW)).status, 400);
  assert.strictEqual((await decideJoinRequest(w.deps, mission(), { actorId: 'boss', requestId: 'nope', decision: 'approve' }, NOW)).status, 404);

  const ok = await decideJoinRequest(w.deps, mission(), { actorId: 'boss', requestId: ivy.id, decision: 'approve' }, NOW);
  assert.strictEqual(ok.status, 200);
  assert.ok(w.members.some((m) => m.userId === 'ivy' && m.codename));
  assert.deepStrictEqual([ivy.status, ivy.decidedById], ['APPROVED', 'boss']);
  assert.match(w.notes.get('ivy|join-request-decided:m1').title, /You're in: Snowfall/);
  assert.match(w.notes.get('boss|join-requests:m1').message, /An agent has asked/, 'count refreshed to 1');
  assert.strictEqual((await decideJoinRequest(w.deps, mission(), { actorId: 'boss', requestId: ivy.id, decision: 'decline' }, NOW)).status, 409, 'already decided');

  await decideJoinRequest(w.deps, mission(), { actorId: 'boss', requestId: noel.id, decision: 'decline' }, NOW);
  assert.strictEqual(noel.status, 'DECLINED');
  assert.ok(!w.members.some((m) => m.userId === 'noel'));
  assert.match(w.notes.get('noel|join-request-decided:m1').title, /Request declined/);
  assert.ok(!w.notes.has('boss|join-requests:m1'), 'alert removed when none are left');
});

test('Decide - the agent cap is checked at approval time', async () => {
  const w = world({ members: ['boss', 'a', 'b'], maxAgents: 4 });
  await joinMission(w.deps, mission(), { userId: 'ivy' }, NOW);
  await joinMission(w.deps, mission(), { userId: 'noel' }, NOW);
  assert.strictEqual((await decideJoinRequest(w.deps, mission(), { actorId: 'boss', requestId: w.requests[0].id, decision: 'approve' }, NOW)).status, 200);
  const full = await decideJoinRequest(w.deps, mission(), { actorId: 'boss', requestId: w.requests[1].id, decision: 'approve' }, NOW);
  assert.strictEqual(full.status, 400);
  assert.match(String(full.body.error), /capacity/);
  assert.strictEqual(w.requests[1].status, 'PENDING', 'still pending: the Head Elf can remove someone and approve');
});

test('Decide - a request left past RSVP expires instead', async () => {
  const w = world();
  await joinMission(w.deps, mission(), { userId: 'ivy' }, NOW);
  const later = NOW + 7 * DAY;
  const r = await decideJoinRequest(w.deps, mission(), { actorId: 'boss', requestId: w.requests[0].id, decision: 'approve' }, later);
  assert.strictEqual(r.status, 409);
  assert.strictEqual(w.requests[0].status, 'EXPIRED');
  assert.ok(!w.members.some((m) => m.userId === 'ivy'));
});

test('Lists - Head Elf sees pending (with verification), requester sees their status, expired drop off', async () => {
  const w = world();
  await joinMission(w.deps, mission(), { userId: 'unverified' }, NOW);
  const list = await pendingJoinRequests(w.db, mission(), NOW);
  assert.deepStrictEqual(list.map((r) => [r.name, r.emailVerified]), [['UNVERIFIED', false]]);
  assert.deepStrictEqual(await pendingJoinRequests(w.db, mission(), NOW + 7 * DAY), []);

  assert.strictEqual((await viewerJoinRequest(w.db, mission(), 'unverified', NOW))?.status, 'PENDING');
  assert.strictEqual((await viewerJoinRequest(w.db, mission(), 'unverified', NOW + 7 * DAY))?.status, 'EXPIRED');
  assert.strictEqual(await viewerJoinRequest(w.db, mission(), null, NOW), null);

  assert.deepStrictEqual((await myJoinRequests(w.db, 'unverified', NOW)).map((r) => r.status), ['PENDING']);
  w.requests[0]._cutoff = new Date(NOW - 3 * DAY);
  assert.deepStrictEqual(await myJoinRequests(w.db, 'unverified', NOW), [], 'expired requests are not shown');
});

test('Invitation emails carry the invite token', () => {
  const t = issueInviteToken('inv1');
  assert.strictEqual(invitationLink('https://k.test/', 'SNOW-1234', 'a@b.c', true, undefined, t), `https://k.test/exchange/SNOW-1234?invite=${encodeURIComponent(t)}`);
  assert.strictEqual(
    invitationLink('https://k.test', 'SNOW-1234', 'a@b.c', false, undefined, t),
    `https://k.test/register?code=SNOW-1234&email=a%40b.c&invite=${encodeURIComponent(t)}`
  );
  assert.strictEqual(invitationLink('https://k.test', 'SNOW-1234', 'a@b.c', true, 'KDM1', t), 'https://k.test/exchange/SNOW-1234?kdm=KDM1', 'Covert Delivery keeps its own token');
});
