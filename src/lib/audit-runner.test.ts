import test from 'node:test';
import assert from 'node:assert';
import { processExchangeAudit } from './audit-runner';

test('Audit Runner - processExchangeAudit applies penalties, waivers, and transitions exchange status when enforcePenalties is true', async () => {
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
    enforcePenalties: true,
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
  assert.strictEqual(updatedExchanges[0].id, 'ex-001');
  assert.strictEqual(updatedExchanges[0].data.status, 'COMPLETED');
});

test('Audit Runner - processExchangeAudit bypasses demerits when enforcePenalties is false', async () => {
  const updatedUsers: Array<any> = [];
  const createdNotifications: Array<any> = [];
  const updatedExchanges: Array<any> = [];

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
    id: 'ex-no-penalties',
    title: 'Casual Office Exchange',
    enforcePenalties: false, // Demerits disabled for this operation
    isWhiteElephant: false,
    members: [
      {
        id: 'mem-1',
        shippingStatus: 'PENDING',
        deliveredConfirmed: false,
        trackingNumber: null,
        user: {
          id: 'user-neglect',
          name: 'Operative Casual',
          penaltyPoints: 0,
          accountStatus: 'ACTIVE',
        },
      },
    ],
  };

  const outcomes = await processExchangeAudit(mockDb, mockExchange);

  // Returns empty outcomes and touches zero users or notifications
  assert.strictEqual(outcomes.length, 0);
  assert.strictEqual(updatedUsers.length, 0);
  assert.strictEqual(createdNotifications.length, 0);

  // Exchange status is still completed
  assert.strictEqual(updatedExchanges.length, 1);
  assert.strictEqual(updatedExchanges[0].data.status, 'COMPLETED');
});
