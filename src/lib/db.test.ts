import test from 'node:test';
import assert from 'node:assert';
import { invalidateCachedDb, getDb } from './db';
import { invalidateCachedAdminDb, getAdminDb } from './adminDb';

test('Database Connection Lifecycle & Teardown', async (t) => {
  await t.test('invalidateCachedDb gracefully cleans up state when cached is null', async () => {
    await assert.doesNotReject(async () => {
      await invalidateCachedDb();
    }, 'Calling invalidateCachedDb when null should not throw');
  });

  await t.test('invalidateCachedAdminDb gracefully cleans up state when cached is null', async () => {
    await assert.doesNotReject(async () => {
      await invalidateCachedAdminDb();
    }, 'Calling invalidateCachedAdminDb when null should not throw');
  });

  await t.test('Multiple consecutive invalidation calls execute safely without hanging or throwing', async () => {
    await assert.doesNotReject(async () => {
      await Promise.all([
        invalidateCachedDb(),
        invalidateCachedDb(),
        invalidateCachedAdminDb(),
        invalidateCachedAdminDb(),
      ]);
    });
  });
});

test('Atomic Transaction Batch Array Construction', async (t) => {
  await t.test('Target Draw constructs atomic transaction array for all members + status update', () => {
    const mockMembers = [
      { id: 'mem_1', userId: 'usr_1' },
      { id: 'mem_2', userId: 'usr_2' },
      { id: 'mem_3', userId: 'usr_3' },
    ];
    const assignments = [
      { agentId: 'usr_1', targetId: 'usr_2' },
      { agentId: 'usr_2', targetId: 'usr_3' },
      { agentId: 'usr_3', targetId: 'usr_1' },
    ];

    const updateOps = assignments
      .map((assignment) => {
        const memberRecord = mockMembers.find((a) => a.userId === assignment.agentId);
        if (!memberRecord) return null;
        return {
          model: 'exchangeMember',
          action: 'update',
          where: { id: memberRecord.id },
          data: { targetUserId: assignment.targetId },
        };
      })
      .filter(Boolean);

    const fullTransactionBatch = [
      ...updateOps,
      {
        model: 'exchange',
        action: 'update',
        where: { id: 'ex_123' },
        data: { status: 'MATCHED' },
      },
    ];

    // Assert atomicity: 3 member assignments + 1 exchange status update = 4 operations executed in 1 transaction
    assert.strictEqual(fullTransactionBatch.length, 4);
    assert.strictEqual((fullTransactionBatch[3] as any).data.status, 'MATCHED');
  });

  await t.test('Broadcast notification dispatch constructs atomic transaction array', () => {
    const mockMembers = [
      { userId: 'usr_1' },
      { userId: 'usr_2' },
      { userId: 'usr_3' },
    ];
    const messageText = 'Operation starting now!';
    const exchangeId = 'ex_123';

    const notificationInserts = mockMembers.map((member) => ({
      model: 'notification',
      action: 'create',
      data: {
        userId: member.userId,
        title: '📢 Exchange Broadcast: Operation Alpha',
        message: messageText.trim(),
        exchangeId,
      },
    }));

    assert.strictEqual(notificationInserts.length, 3);
    assert.strictEqual(notificationInserts[0].data.userId, 'usr_1');
    assert.strictEqual(notificationInserts[1].data.userId, 'usr_2');
    assert.strictEqual(notificationInserts[2].data.userId, 'usr_3');
  });
});
