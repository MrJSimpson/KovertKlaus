import test from 'node:test';
import assert from 'node:assert';
import { advanceMissionLifecycle } from './mission-lifecycle';

test('Mission Lifecycle Engine - advances RECRUITING to SETUP upon inviteCutoffDate', async () => {
  const pastDate = new Date(Date.now() - 86400000); // Yesterday
  const futureDate = new Date(Date.now() + 86400000 * 7); // Next week

  const updatedExchanges: Array<{ id: string; data: any }> = [];
  const createdNotifications: Array<{ data: any }> = [];

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
      update: async ({ where, data }: any) => {
        updatedExchanges.push({ id: where.id, data });
        return { ...where, ...data };
      },
    },
    notification: {
      create: async ({ data }: any) => {
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
  assert.ok(createdNotifications[0].data.title.includes('Recruitment Closed'));
});

test('Mission Lifecycle Engine - advances SETUP to MATCHED upon assignmentDate with automated draw', async () => {
  const pastDate = new Date(Date.now() - 86400000);
  const futureDate = new Date(Date.now() + 86400000 * 7);

  const updatedMembers: Array<{ id: string; data: any }> = [];
  const updatedExchanges: Array<{ id: string; data: any }> = [];
  const createdNotifications: Array<{ data: any }> = [];

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
            { id: 'm1', userId: 'u1', user: { name: 'Agent 1', email: 'a1@test.com', emailNotifications: false } },
            { id: 'm2', userId: 'u2', user: { name: 'Agent 2', email: 'a2@test.com', emailNotifications: false } },
            { id: 'm3', userId: 'u3', user: { name: 'Agent 3', email: 'a3@test.com', emailNotifications: false } },
            { id: 'm4', userId: 'u4', user: { name: 'Agent 4', email: 'a4@test.com', emailNotifications: false } },
          ],
          exclusionRules: [],
        },
      ],
      update: async ({ where, data }: any) => {
        updatedExchanges.push({ id: where.id, data });
        return { ...where, ...data };
      },
    },
    exchangeMember: {
      update: async ({ where, data }: any) => {
        updatedMembers.push({ id: where.id, data });
        return { ...where, ...data };
      },
    },
    notification: {
      create: async ({ data }: any) => {
        createdNotifications.push({ data });
        return { id: 'notif-' + createdNotifications.length, ...data };
      },
    },
    $transaction: async (ops: any[]) => {
      return ops;
    },
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

  const updatedExchanges: Array<{ id: string; data: any }> = [];

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
      update: async ({ where, data }: any) => {
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

  const updatedExchanges: Array<{ id: string; data: any }> = [];

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
      update: async ({ where, data }: any) => {
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
