import test from 'node:test';
import assert from 'node:assert/strict';
import { stageCardClass, stageState, statusBadgeClass, type MissionStage } from './stage-colors';
import { getNextMilestoneCountdown } from './security';

test('Mission stage color system', async (t) => {
  await t.test('stageState marks earlier stages done, the current stage current, later ones upcoming', () => {
    assert.equal(stageState(1, 3), 'done');
    assert.equal(stageState(3, 3), 'current');
    assert.equal(stageState(4, 3), 'upcoming');
  });

  await t.test('a complete mission shows every stage as done', () => {
    for (const s of [1, 2, 3, 4] as MissionStage[]) assert.equal(stageState(s, 4, true), 'done');
  });

  await t.test('each stage uses its own token hue in every state', () => {
    for (const s of [1, 2, 3, 4] as MissionStage[]) {
      for (const state of ['done', 'current', 'upcoming'] as const) {
        assert.ok(stageCardClass(s, state).includes(`kk-stage${s}`), `stage ${s} ${state}`);
      }
    }
  });

  await t.test('status badges follow the phase: solid while running, soft when complete', () => {
    assert.ok(statusBadgeClass({ stage: 2, isComplete: false }).includes('bg-kk-stage2 '));
    assert.ok(statusBadgeClass({ stage: 4, isComplete: true }).includes('bg-kk-stage4-soft'));
  });

  await t.test('getNextMilestoneCountdown reports the stage for each mission status', () => {
    const dates = {
      inviteCutoffDate: '2026-11-01',
      assignmentDate: '2026-11-05',
      shippingDate: '2026-12-10',
      executionDate: '2026-12-20',
      virtualSystemDate: '2026-10-20',
    };
    assert.equal(getNextMilestoneCountdown({ ...dates, status: 'RECRUITING' }).stage, 1);
    assert.equal(getNextMilestoneCountdown({ ...dates, status: 'SETUP' }).stage, 2);
    // A drawn mission is in the shipping stage even before the planned draw date.
    assert.equal(getNextMilestoneCountdown({ ...dates, status: 'MATCHED' }).stage, 3);
    assert.equal(getNextMilestoneCountdown({ ...dates, status: 'SHIPPED' }).stage, 4);
    const done = getNextMilestoneCountdown({ ...dates, status: 'COMPLETED' });
    assert.equal(done.stage, 4);
    assert.equal(done.isComplete, true);
  });
});
