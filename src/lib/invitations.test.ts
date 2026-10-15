/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import {
  invitationLink,
  isInvitationOpen,
  sendMissionInvitation,
  listMyInvitations,
  updateInvitation,
  markInvitationAccepted,
  type InvitationEmail,
} from './invitations';

const NOW = Date.parse('2026-11-01T12:00:00Z');
const CUTOFF = new Date('2026-11-10T00:00:00Z');

test('Invitations - email links: new users register with the code, existing users open the mission', () => {
  assert.strictEqual(invitationLink('https://kk.test/', 'ABCD-1234', 'a+b@x.com', false), 'https://kk.test/register?code=ABCD-1234&email=a%2Bb%40x.com');
  assert.strictEqual(invitationLink('https://kk.test', 'ABCD-1234', 'a@x.com', true), 'https://kk.test/exchange/ABCD-1234');
  assert.strictEqual(invitationLink('https://kk.test', 'ABCD-1234', 'a@x.com', false, 'KDM-1'), 'https://kk.test/exchange/ABCD-1234?kdm=KDM-1');
});

test('Invitations - pending invites last through the cutoff day; Late Passes until completion', () => {
  const ex = { status: 'RECRUITING', inviteCutoffDate: CUTOFF };
  const pending = { status: 'PENDING', isLatePass: false };
  assert.strictEqual(isInvitationOpen(pending, ex, Date.parse('2026-11-10T23:00:00Z')), true);
  assert.strictEqual(isInvitationOpen(pending, ex, Date.parse('2026-11-11T00:00:00Z')), false);
  assert.strictEqual(isInvitationOpen({ ...pending, isLatePass: true }, ex, Date.parse('2026-12-01T00:00:00Z')), true);
  assert.strictEqual(isInvitationOpen({ ...pending, isLatePass: true }, { ...ex, status: 'COMPLETED' }, NOW), false);
  assert.strictEqual(isInvitationOpen({ ...pending, status: 'DECLINED' }, ex, NOW), false);
});

/** In-memory stand-in for the Prisma models the service touches. */
function fakeDb(opts: { users?: Array<{ id: string; email: string; name: string }>; members?: string[]; cutoff?: Date; covert?: boolean } = {}) {
  const users = opts.users ?? [{ id: 'boss', email: 'boss@x.com', name: 'Holly' }];
  const invitations: any[] = [];
  const notifications: any[] = [];
  const tokens: any[] = [];
  const exchange = {
    id: 'ex1', code: 'ABCD-1234', title: 'Family Swap', organizerId: 'boss', status: 'RECRUITING',
    inviteCutoffDate: opts.cutoff ?? CUTOFF, executionDate: new Date('2026-12-20T00:00:00Z'),
    budgetMin: null, budgetMax: 50, currency: 'USD', isWhiteElephant: false, isCovertDelivery: Boolean(opts.covert),
    organizer: { name: 'Holly', email: 'boss@x.com', codename: null },
    members: (opts.members ?? ['boss']).map((userId) => ({ userId })),
  };
  const db = {
    exchange: { findUnique: async () => exchange },
    user: { findUnique: async ({ where }: any) => users.find((u) => u.email === where.email || u.id === where.id) ?? null },
    missionInvitation: {
      upsert: async ({ where, create, update }: any) => {
        const found = invitations.find((i) => i.exchangeId === where.exchangeId_email.exchangeId && i.email === where.exchangeId_email.email);
        if (found) return Object.assign(found, update);
        const row = { id: `inv${invitations.length + 1}`, status: 'PENDING', createdAt: new Date(NOW), respondedAt: null, ...create };
        invitations.push(row);
        return row;
      },
      findMany: async ({ where }: any) =>
        invitations
          .filter((i) => i.email === where.email && i.status === where.status)
          .map((i) => ({ ...i, exchange: { ...exchange, members: exchange.members.filter((m) => m.userId === 'never') } })),
      findUnique: async ({ where }: any) => {
        const i = invitations.find((x) => x.id === where.id);
        return i ? { ...i, exchange: { organizerId: exchange.organizerId } } : null;
      },
      update: async ({ where, data }: any) => Object.assign(invitations.find((x) => x.id === where.id), data),
      updateMany: async ({ where, data }: any) => {
        invitations.filter((i) => i.exchangeId === where.exchangeId && i.email === where.email && i.status === where.status).forEach((i) => Object.assign(i, data));
        return { count: 0 };
      },
    },
    notification: { create: async ({ data }: any) => notifications.push(data) },
    covertInviteToken: { create: async ({ data }: any) => tokens.push(data) },
  };
  return { db: db as any, invitations, notifications, tokens };
}

function deps(sent: InvitationEmail[], ok = true) {
  return { baseUrl: 'https://kk.test', sendEmail: async (e: InvitationEmail) => { sent.push(e); return { success: ok }; } };
}
const invite = (db: any, sent: InvitationEmail[], email: string, extra: Record<string, unknown> = {}, nowMs = NOW) =>
  sendMissionInvitation(db, deps(sent), { exchangeId: 'ex1', inviterId: 'boss', email, ...extra }, nowMs);

test('Invitations - a new user gets a Join Exchange link to registration; nothing posts to a dashboard', async () => {
  const fake = fakeDb();
  const sent: InvitationEmail[] = [];
  const res = await invite(fake.db, sent, '  New.Person@X.com ');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(fake.invitations[0].email, 'new.person@x.com');
  assert.strictEqual(sent[0].isExistingUser, false);
  assert.match(sent[0].joinUrl, /\/register\?code=ABCD-1234&email=new\.person%40x\.com$/);
  assert.strictEqual(fake.notifications.length, 0);
});

test('Invitations - an existing user is notified and linked to the mission page', async () => {
  const fake = fakeDb({ users: [{ id: 'boss', email: 'boss@x.com', name: 'Holly' }, { id: 'u2', email: 'pal@x.com', name: 'Pal' }] });
  const sent: InvitationEmail[] = [];
  await invite(fake.db, sent, 'pal@x.com');
  assert.strictEqual(sent[0].isExistingUser, true);
  assert.strictEqual(sent[0].joinUrl, 'https://kk.test/exchange/ABCD-1234');
  assert.strictEqual(fake.notifications.length, 1);
});

test('Invitations - only the Head Elf invites; enrolled agents, self and bad emails are refused', async () => {
  const users = [{ id: 'boss', email: 'boss@x.com', name: 'Holly' }, { id: 'u2', email: 'pal@x.com', name: 'Pal' }];
  const fake = fakeDb({ users, members: ['boss', 'u2'] });
  const sent: InvitationEmail[] = [];
  assert.strictEqual((await sendMissionInvitation(fake.db, deps(sent), { exchangeId: 'ex1', inviterId: 'u2', email: 'a@x.com' }, NOW)).status, 403);
  assert.strictEqual((await invite(fake.db, sent, 'pal@x.com')).status, 409);
  assert.strictEqual((await invite(fake.db, sent, 'BOSS@x.com')).status, 400);
  assert.strictEqual((await invite(fake.db, sent, 'not-an-email')).status, 400);
  assert.strictEqual(sent.length, 0);
});

test('Invitations - after the cutoff only a Late Pass to a registered user is allowed', async () => {
  const late = Date.parse('2026-11-12T00:00:00Z');
  const users = [{ id: 'boss', email: 'boss@x.com', name: 'Holly' }, { id: 'u2', email: 'pal@x.com', name: 'Pal' }];
  const fake = fakeDb({ users });
  const sent: InvitationEmail[] = [];
  const closed = await invite(fake.db, sent, 'pal@x.com', {}, late);
  assert.strictEqual(closed.status, 400);
  assert.strictEqual(closed.body.canUseLatePass, true);
  assert.strictEqual((await invite(fake.db, sent, 'new@x.com', { isLatePass: true }, late)).status, 400);
  const pass = await invite(fake.db, sent, 'pal@x.com', { isLatePass: true }, late);
  assert.strictEqual(pass.status, 200);
  assert.strictEqual(fake.invitations[0].isLatePass, true);
});

test('Invitations - re-inviting reopens a declined invitation instead of duplicating it', async () => {
  const fake = fakeDb();
  const sent: InvitationEmail[] = [];
  await invite(fake.db, sent, 'a@x.com');
  fake.invitations[0].status = 'DECLINED';
  await invite(fake.db, sent, 'a@x.com');
  assert.strictEqual(fake.invitations.length, 1);
  assert.strictEqual(fake.invitations[0].status, 'PENDING');
});

test('Invitations - a failed email still records the invite and says so', async () => {
  const fake = fakeDb();
  const res = await sendMissionInvitation(fake.db, deps([], false), { exchangeId: 'ex1', inviterId: 'boss', email: 'a@x.com' }, NOW);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.emailSent, false);
  assert.strictEqual(fake.invitations.length, 1);
});

test('Invitations - Kovert Delivery invites carry a KDM token', async () => {
  const fake = fakeDb({ covert: true });
  const sent: InvitationEmail[] = [];
  await invite(fake.db, sent, 'a@x.com');
  assert.strictEqual(fake.tokens.length, 1);
  assert.match(sent[0].joinUrl, /\/exchange\/ABCD-1234\?kdm=/);
});

test('Invitations - the invitee sees, declines; the Head Elf revokes; enrollment accepts', async () => {
  const users = [{ id: 'boss', email: 'boss@x.com', name: 'Holly' }, { id: 'u2', email: 'pal@x.com', name: 'Pal' }];
  const fake = fakeDb({ users });
  const sent: InvitationEmail[] = [];
  await invite(fake.db, sent, 'pal@x.com');
  const mine = await listMyInvitations(fake.db, 'u2', NOW);
  assert.strictEqual((mine.body.invitations as any[]).length, 1);

  assert.strictEqual((await updateInvitation(fake.db, { invitationId: 'inv1', userId: 'boss', action: 'decline' })).status, 404);
  assert.strictEqual((await updateInvitation(fake.db, { invitationId: 'inv1', userId: 'u2', action: 'revoke' })).status, 403);
  assert.strictEqual((await updateInvitation(fake.db, { invitationId: 'inv1', userId: 'u2', action: 'decline' })).status, 200);
  assert.strictEqual(fake.invitations[0].status, 'DECLINED');
  assert.strictEqual((await updateInvitation(fake.db, { invitationId: 'inv1', userId: 'u2', action: 'decline' })).status, 409);

  await invite(fake.db, sent, 'pal@x.com');
  await markInvitationAccepted(fake.db, 'ex1', 'PAL@x.com', 'u2', NOW);
  assert.strictEqual(fake.invitations[0].status, 'ACCEPTED');
  assert.strictEqual(fake.invitations[0].userId, 'u2');
});
