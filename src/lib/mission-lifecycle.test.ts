import test from 'node:test';
import assert from 'node:assert';
import { advanceMissionLifecycle } from './mission-lifecycle';
import type { AssignmentEmailParams } from './email/types';

/** Prisma-style arguments the lifecycle engine passes to the mock db. */
type Row = Record<string, unknown>;
interface UpdateArgs { where: { id: string }; data: Row }
interface CreateArgs { data: Row }

test('Mission Lifecycle Engine - advances RECRUITING to SETUP upon inviteCutoffDate', async () => {
  const pastDate = new Date(Date.now() - 86400000); // Yesterday
  const futureDate = new Date(Date.now() + 86400000 * 7); // Next week

  const updatedExchanges: Array<{ id: string; data: Row }> = [];
  const createdNotifications: Array<{ data: Row }> = [];

  const mockDb = {
    exchange: {
      findMany: async () => [
        {
          id: 'op-recruiting-due',
          title: 'Operation Frostbite',
          status: 'RECRUITING',
          organizerId: 'org-1',
          inviteCutoffDate: pastDate,
          assignmentDate: futureDate,
          shippingDate: futureDate,
          executionDate: futureDate,
          isWhiteElephant: false,
          members: [
            { id: 'm1', userId: 'u1', user: { name: 'Agent 1' } },
            { id: 'm2', userId: 'u2', user: { name: 'Agent 2' } },
          ],
          exclusionRules: [],
        },
      ],
      update: async ({ where, data }: UpdateArgs) => {
        updatedExchanges.push({ id: where.id, data });
        return { ...where, ...data };
      },
    },
    notification: {
      create: async ({ data }: CreateArgs) => {
        createdNotifications.push({ data });
        return { id: 'notif-' + createdNotifications.length, ...data };
      },
    },
  };

  const summary = await advanceMissionLifecycle(mockDb);

  assert.strictEqual(summary.transitionsCount, 1);
  assert.strictEqual(summary.transitions[0].previousStatus, 'RECRUITING');
  assert.strictEqual(summary.transitions[0].newStatus, 'SETUP');
  assert.strictEqual(summary.transitions[0].milestoneTriggered, 'inviteCutoffDate');

  assert.strictEqual(updatedExchanges.length, 1);
  assert.strictEqual(updatedExchanges[0].data.status, 'SETUP');

  assert.strictEqual(createdNotifications.length, 1);
  assert.strictEqual(createdNotifications[0].data.userId, 'org-1');
  assert.ok(String(createdNotifications[0].data.title).includes('Recruitment Closed'));
});

test('Mission Lifecycle Engine - advances SETUP to MATCHED upon assignmentDate with automated draw', async () => {
  const pastDate = new Date(Date.now() - 86400000);
  const futureDate = new Date(Date.now() + 86400000 * 7);

  const updatedMembers: Array<{ id: string; data: Row }> = [];
  const updatedExchanges: Array<{ id: string; data: Row }> = [];
  const createdNotifications: Array<{ data: Row }> = [];

  const mockDb = {
    exchange: {
      findMany: async () => [
        {
          id: 'op-draw-due',
          title: 'Operation Kovert Strike',
          status: 'SETUP',
          organizerId: 'org-1',
          code: 'STRIKE26',
          inviteCutoffDate: pastDate,
          assignmentDate: pastDate,
          shippingDate: futureDate,
          executionDate: futureDate,
          isWhiteElephant: false,
          members: [
            { id: 'm1', userId: 'u1', user: { name: 'Agent 1', email: 'a1@test.com', emailNotifications: false, streetAddress: '1 Elf Way', city: 'North Pole', state: 'AK', zipCode: '99705' }, wishlist: { _count: { wishlistItems: 1 } } },
            { id: 'm2', userId: 'u2', user: { name: 'Agent 2', email: 'a2@test.com', emailNotifications: false, streetAddress: '1 Elf Way', city: 'North Pole', state: 'AK', zipCode: '99705' }, wishlist: { _count: { wishlistItems: 1 } } },
            { id: 'm3', userId: 'u3', user: { name: 'Agent 3', email: 'a3@test.com', emailNotifications: false, streetAddress: '1 Elf Way', city: 'North Pole', state: 'AK', zipCode: '99705' }, wishlist: { _count: { wishlistItems: 1 } } },
            { id: 'm4', userId: 'u4', user: { name: 'Agent 4', email: 'a4@test.com', emailNotifications: false, streetAddress: '1 Elf Way', city: 'North Pole', state: 'AK', zipCode: '99705' }, wishlist: { _count: { wishlistItems: 1 } } },
          ],
          exclusionRules: [],
        },
      ],
      update: async ({ where, data }: UpdateArgs) => {
        updatedExchanges.push({ id: where.id, data });
        return { ...where, ...data };
      },
    },
    exchangeMember: {
      update: async ({ where, data }: UpdateArgs) => {
        updatedMembers.push({ id: where.id, data });
        return { ...where, ...data };
      },
    },
    notification: {
      create: async ({ data }: CreateArgs) => {
        createdNotifications.push({ data });
        return { id: 'notif-' + createdNotifications.length, ...data };
      },
    },
    // Callback form only, like the real `db` proxy allows (src/lib/db.ts).
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb),
  };

  const summary = await advanceMissionLifecycle(mockDb);

  assert.strictEqual(summary.transitionsCount, 1);
  assert.strictEqual(summary.transitions[0].previousStatus, 'SETUP');
  assert.strictEqual(summary.transitions[0].newStatus, 'MATCHED');
  assert.strictEqual(summary.transitions[0].milestoneTriggered, 'assignmentDate');

  // Verify all 4 members received targets
  assert.strictEqual(updatedMembers.length, 4);
  for (const m of updatedMembers) {
    assert.ok(m.data.targetUserId, 'Target must be assigned');
  }

  // Verify notifications dispatched to all 4 agents
  assert.strictEqual(createdNotifications.length, 4);
});

test('Mission Lifecycle Engine - advances MATCHED to SHIPPED upon shippingDate', async () => {
  const pastDate = new Date(Date.now() - 86400000);
  const futureDate = new Date(Date.now() + 86400000 * 7);

  const updatedExchanges: Array<{ id: string; data: Row }> = [];

  const mockDb = {
    exchange: {
      findMany: async () => [
        {
          id: 'op-shipped-due',
          title: 'Operation Package Drop',
          status: 'MATCHED',
          organizerId: 'org-1',
          inviteCutoffDate: pastDate,
          assignmentDate: pastDate,
          shippingDate: pastDate,
          executionDate: futureDate,
          isWhiteElephant: false,
          members: [
            { id: 'm1', userId: 'u1', user: { name: 'Agent 1' } },
            { id: 'm2', userId: 'u2', user: { name: 'Agent 2' } },
          ],
          exclusionRules: [],
        },
      ],
      update: async ({ where, data }: UpdateArgs) => {
        updatedExchanges.push({ id: where.id, data });
        return { ...where, ...data };
      },
    },
    notification: {
      create: async () => ({}),
    },
  };

  const summary = await advanceMissionLifecycle(mockDb);

  assert.strictEqual(summary.transitionsCount, 1);
  assert.strictEqual(summary.transitions[0].previousStatus, 'MATCHED');
  assert.strictEqual(summary.transitions[0].newStatus, 'SHIPPED');
  assert.strictEqual(summary.transitions[0].milestoneTriggered, 'shippingDate');

  assert.strictEqual(updatedExchanges.length, 1);
  assert.strictEqual(updatedExchanges[0].data.status, 'SHIPPED');
});

test('Mission Lifecycle Engine - advances SHIPPED to EXECUTED upon executionDate', async () => {
  const pastDate = new Date(Date.now() - 86400000);

  const updatedExchanges: Array<{ id: string; data: Row }> = [];

  const mockDb = {
    exchange: {
      findMany: async () => [
        {
          id: 'op-exec-due',
          title: 'Operation Christmas Day',
          status: 'SHIPPED',
          organizerId: 'org-1',
          inviteCutoffDate: pastDate,
          assignmentDate: pastDate,
          shippingDate: pastDate,
          executionDate: pastDate,
          isWhiteElephant: false,
          members: [
            { id: 'm1', userId: 'u1', user: { name: 'Agent 1' } },
            { id: 'm2', userId: 'u2', user: { name: 'Agent 2' } },
          ],
          exclusionRules: [],
        },
      ],
      update: async ({ where, data }: UpdateArgs) => {
        updatedExchanges.push({ id: where.id, data });
        return { ...where, ...data };
      },
    },
    notification: {
      create: async () => ({}),
    },
  };

  const summary = await advanceMissionLifecycle(mockDb);

  assert.strictEqual(summary.transitionsCount, 1);
  assert.strictEqual(summary.transitions[0].previousStatus, 'SHIPPED');
  assert.strictEqual(summary.transitions[0].newStatus, 'EXECUTED');
  assert.strictEqual(summary.transitions[0].milestoneTriggered, 'executionDate');

  assert.strictEqual(updatedExchanges.length, 1);
  assert.strictEqual(updatedExchanges[0].data.status, 'EXECUTED');
});

test('Mission Lifecycle Engine - Assignment Day draw waits for every assignment email (Workers drop unfinished sends)', async () => {
  const pastDate = new Date(Date.now() - 86400000);
  const futureDate = new Date('2026-12-20T20:00:00Z');
  const user = (n: number, emailNotifications: boolean) => ({
    name: `Agent ${n}`, email: `a${n}@test.com`, emailNotifications,
    streetAddress: '1 Elf Way', city: 'North Pole', state: 'AK', zipCode: '99705',
  });

  type Write = { where: { id: string }; data: Record<string, unknown> };
  const echo = async ({ where, data }: Write) => ({ ...where, ...data });
  const mockDb = {
    exchange: {
      findMany: async () => [
        {
          id: 'op-draw-emails',
          title: 'Operation Mailbag',
          status: 'SETUP',
          organizerId: 'org-1',
          code: 'MAIL26',
          inviteCutoffDate: pastDate,
          assignmentDate: pastDate,
          shippingDate: futureDate,
          executionDate: futureDate,
          isWhiteElephant: false,
          members: [1, 2, 3, 4].map((n) => ({
            id: `m${n}`, userId: `u${n}`, codename: `Snowy Spider ${n}`,
            user: user(n, n !== 4), // agent 4 turned email off
            wishlist: { _count: { wishlistItems: 1 } },
          })),
          exclusionRules: [],
        },
      ],
      update: echo,
    },
    exchangeMember: { update: echo },
    notification: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'n', ...data }) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => fn(mockDb),
  };

  const delivered: AssignmentEmailParams[] = [];
  const summary = await advanceMissionLifecycle(mockDb, {
    baseUrl: 'https://kovertklaus.example/',
    sendEmail: async () => ({ success: true }),
    sendRepairEmail: async () => ({ success: true }),
    sendAssignmentEmail: async (email) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (email.recipientEmail === 'a2@test.com') throw new Error('provider down');
      delivered.push(email);
    },
  });

  assert.strictEqual(summary.transitions[0]?.newStatus, 'MATCHED');
  // Every send finished before the sweep resolved; one failure did not stop the others or the draw
  assert.deepStrictEqual(delivered.map((e) => e.recipientEmail).sort(), ['a1@test.com', 'a3@test.com']);
  for (const e of delivered) {
    assert.strictEqual(e.exchangeUrl, 'https://kovertklaus.example/exchange/MAIL26');
    assert.match(e.targetCodename ?? '', /^Snowy Spider [1-4]$/);
    assert.strictEqual(e.shippingDeadline, 'Dec 20, 2026');
  }
});
