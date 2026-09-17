import test from 'node:test';
import assert from 'node:assert';
import { processExchangeAudit, executeDueDemeritAudits } from './audit-runner';

test('Audit Runner - processExchangeAudit applies penalties, waivers, and transitions exchange status', async () => {
  const updatedUsers: Array<{ id: string; data: any }> = [];
  const createdNotifications: Array<{ data: any }> = [];
  const updatedExchanges: Array<{ id: string; data: any }> = [];

  const mockDb = {
    user: {
      update: async ({ where, data }: any) => {
        updatedUsers.push({ id: where.id, data });
        return { ...where, ...data };
      },
    },
    notification: {
      create: async ({ data }: any) => {
        createdNotifications.push({ data });
        return { id: 'notif-' + createdNotifications.length, ...data };
      },
    },
    exchange: {
      update: async ({ where, data }: any) => {
        updatedExchanges.push({ id: where.id, data });
        return { ...where, ...data };
      },
    },
  };

  const mockExchange = {
    id: 'ex-001',
    title: 'Operation Mistletoe Strike',
    isWhiteElephant: false,
    members: [
      {
        id: 'mem-1',
        shippingStatus: 'PENDING',
        deliveredConfirmed: false,
        trackingNumber: null,
        user: {
          id: 'user-neglect',
          name: 'Operative Lazy',
          penaltyPoints: 0,
          accountStatus: 'ACTIVE',
        },
      },
      {
        id: 'mem-2',
        shippingStatus: 'PENDING',
        deliveredConfirmed: false,
        trackingNumber: '9400111899562537624128',
        user: {
          id: 'user-carrier-proof',
          name: 'Operative Diligent',
          penaltyPoints: 0,
          accountStatus: 'ACTIVE',
        },
      },
      {
        id: 'mem-3',
        shippingStatus: 'DELIVERED',
        deliveredConfirmed: true,
        trackingNumber: '1Z9999999999999999',
        user: {
          id: 'user-rehabilitated',
          name: 'Operative Redeemed',
          penaltyPoints: 1,
          accountStatus: 'ACTIVE',
        },
      },
    ],
  };

  const outcomes = await processExchangeAudit(mockDb, mockExchange);

  assert.strictEqual(outcomes.length, 3);

  // 1. Neglectful member received +1 penalty
  assert.strictEqual(outcomes[0].penalized, true);
  assert.strictEqual(outcomes[0].newDemeritCount, 1);

  // 2. Carrier-waived member received 0 penalty
  assert.strictEqual(outcomes[1].penalized, false);
  assert.strictEqual(outcomes[1].carrierWaived, true);

  // 3. Rehabilitated member had penalty decremented from 1 -> 0
  assert.strictEqual(outcomes[2].demeritCleared, true);
  assert.strictEqual(outcomes[2].newDemeritCount, 0);

  // Verify DB user updates: neglectful + redeemed updated; carrier waived unchanged
  assert.strictEqual(updatedUsers.length, 2);
  assert.deepStrictEqual(updatedUsers[0], {
    id: 'user-neglect',
    data: { penaltyPoints: 1, accountStatus: 'ACTIVE' },
  });
  assert.deepStrictEqual(updatedUsers[1], {
    id: 'user-rehabilitated',
    data: { penaltyPoints: 0, accountStatus: 'ACTIVE' },
  });

  // Verify notifications: 1 penalty notification, 1 cleared notification
  assert.strictEqual(createdNotifications.length, 2);
  assert.strictEqual(createdNotifications[0].data.userId, 'user-neglect');
  assert.strictEqual(createdNotifications[0].data.title.includes('Penalty Issued'), true);
  assert.strictEqual(createdNotifications[1].data.userId, 'user-rehabilitated');
  assert.strictEqual(createdNotifications[1].data.title.includes('Demerit Cleared'), true);

  // Verify exchange marked as COMPLETED
  assert.strictEqual(updatedExchanges.length, 1);
  assert.deepStrictEqual(updatedExchanges[0], {
    id: 'ex-001',
    data: { status: 'COMPLETED' },
  });
});

test('Audit Runner - executeDueDemeritAudits queries due missions and runs batch audits', async () => {
  const mockDueExchanges = [
    {
      id: 'ex-past-1',
      title: 'Operation North Wind',
      isWhiteElephant: false,
      executionDate: new Date(Date.now() - 3600000), // 1 hour ago
      status: 'ASSIGNED',
      members: [
        {
          id: 'mem-10',
          shippingStatus: 'PENDING',
          deliveredConfirmed: false,
          trackingNumber: null,
          user: {
            id: 'user-a',
            name: 'Operative Alpha',
            penaltyPoints: 0,
            accountStatus: 'ACTIVE',
          },
        },
      ],
    },
  ];

  let queryFilter: any = null;

  const mockDb = {
    exchange: {
      findMany: async (args: any) => {
        queryFilter = args;
        return mockDueExchanges;
      },
      update: async () => ({}),
    },
    user: {
      update: async () => ({}),
    },
    notification: {
      create: async () => ({}),
    },
  };

  const summary = await executeDueDemeritAudits(mockDb);

  // Verify Prisma query criteria
  assert.ok(queryFilter);
  assert.deepStrictEqual(queryFilter.where.status.in, ['RECRUITING', 'SETUP', 'ASSIGNED', 'EXECUTED']);
  assert.ok(queryFilter.where.executionDate.lte instanceof Date);

  // Verify summary results
  assert.strictEqual(summary.exchangesAuditedCount, 1);
  assert.strictEqual(summary.details[0].exchangeId, 'ex-past-1');
  assert.strictEqual(summary.details[0].exchangeTitle, 'Operation North Wind');
  assert.strictEqual(summary.details[0].results.length, 1);
  assert.strictEqual(summary.details[0].results[0].penalized, true);
  assert.strictEqual(typeof summary.processedAt, 'string');
});

test('Audit Runner - executeDueDemeritAudits handles zero due missions cleanly', async () => {
  const mockDb = {
    exchange: {
      findMany: async () => [],
    },
  };

  const summary = await executeDueDemeritAudits(mockDb);

  assert.strictEqual(summary.exchangesAuditedCount, 0);
  assert.deepStrictEqual(summary.details, []);
  assert.strictEqual(typeof summary.processedAt, 'string');
});
