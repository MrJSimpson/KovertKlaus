import test from 'node:test';
import assert from 'node:assert';
import {
  evaluateSchedulerState,
  executeLifecycleSweep,
  tickLifecycleScheduler,
  initLifecycleScheduler,
  stopLifecycleScheduler,
} from './lifecycle-scheduler';

test('Lifecycle Scheduler - marks dueForSweep true when never run before (lastLifecycleRunAt is null)', async () => {
  const mockConfigDb = {
    systemConfig: {
      findUnique: async () => ({
        lifecycleCronEnabled: true,
        lifecycleCronIntervalMinutes: 60,
        lastLifecycleRunAt: null,
        lastLifecycleTransitions: 0,
      }),
    },
  };

  const state = await evaluateSchedulerState(mockConfigDb as any);
  assert.strictEqual(state.enabled, true);
  assert.strictEqual(state.intervalMinutes, 60);
  assert.strictEqual(state.lastRunAt, null);
  assert.strictEqual(state.dueForSweep, true);
});

test('Lifecycle Scheduler - marks dueForSweep false when elapsed time is under interval', async () => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const mockConfigDb = {
    systemConfig: {
      findUnique: async () => ({
        lifecycleCronEnabled: true,
        lifecycleCronIntervalMinutes: 60, // 60 min interval
        lastLifecycleRunAt: tenMinutesAgo,
        lastLifecycleTransitions: 2,
      }),
    },
  };

  const state = await evaluateSchedulerState(mockConfigDb as any);
  assert.strictEqual(state.enabled, true);
  assert.strictEqual(state.intervalMinutes, 60);
  assert.strictEqual(state.dueForSweep, false);
});

test('Lifecycle Scheduler - marks dueForSweep true when elapsed time exceeds interval', async () => {
  const seventyMinutesAgo = new Date(Date.now() - 70 * 60 * 1000);
  const mockConfigDb = {
    systemConfig: {
      findUnique: async () => ({
        lifecycleCronEnabled: true,
        lifecycleCronIntervalMinutes: 60, // 60 min interval
        lastLifecycleRunAt: seventyMinutesAgo,
        lastLifecycleTransitions: 0,
      }),
    },
  };

  const state = await evaluateSchedulerState(mockConfigDb as any);
  assert.strictEqual(state.enabled, true);
  assert.strictEqual(state.dueForSweep, true);
});

test('Lifecycle Scheduler - respects database disabled toggle (lifecycleCronEnabled: false)', async () => {
  const mockConfigDb = {
    systemConfig: {
      findUnique: async () => ({
        lifecycleCronEnabled: false,
        lifecycleCronIntervalMinutes: 15,
        lastLifecycleRunAt: null,
        lastLifecycleTransitions: 0,
      }),
    },
  };

  const state = await evaluateSchedulerState(mockConfigDb as any);
  assert.strictEqual(state.enabled, false);
  assert.strictEqual(state.dueForSweep, false);
});

test('Lifecycle Scheduler - respects hard environment variable killswitch', async () => {
  const mockConfigDb = {
    systemConfig: {
      findUnique: async () => ({
        lifecycleCronEnabled: true,
        lifecycleCronIntervalMinutes: 15,
        lastLifecycleRunAt: null,
        lastLifecycleTransitions: 0,
      }),
    },
  };

  const state = await evaluateSchedulerState(mockConfigDb as any, 'false');
  assert.strictEqual(state.enabled, false);
  assert.strictEqual(state.dueForSweep, false);
});

test('Lifecycle Scheduler - executeLifecycleSweep stamps telemetry into SystemConfig', async () => {
  const mockAppDb = {
    exchange: {
      findMany: async () => [],
    },
  };

  let upsertPayload: any = null;
  const mockConfigDb = {
    systemConfig: {
      upsert: async (args: any) => {
        upsertPayload = args;
        return args;
      },
    },
  };

  const summary = await executeLifecycleSweep('manual', mockAppDb as any, mockConfigDb as any);
  assert.strictEqual(summary.missionsCheckedCount, 0);
  assert.strictEqual(summary.transitionsCount, 0);

  assert.ok(upsertPayload !== null);
  assert.strictEqual(upsertPayload.where.id, 'singleton');
  assert.strictEqual(upsertPayload.update.lastLifecycleTransitions, 0);
  assert.ok(upsertPayload.update.lastLifecycleRunAt instanceof Date);
});

test('Lifecycle Scheduler - tickLifecycleScheduler skips when not due and triggers when due', async () => {
  const recentRun = new Date(Date.now() - 2 * 60 * 1000); // 2m ago
  let sweepRan = false;

  const mockNotDueConfigDb = {
    systemConfig: {
      findUnique: async () => ({
        lifecycleCronEnabled: true,
        lifecycleCronIntervalMinutes: 60,
        lastLifecycleRunAt: recentRun,
        lastLifecycleTransitions: 0,
      }),
      upsert: async () => { sweepRan = true; },
    },
  };

  const mockAppDb = {
    exchange: { findMany: async () => [] },
  };

  const ran1 = await tickLifecycleScheduler(mockAppDb as any, mockNotDueConfigDb as any);
  assert.strictEqual(ran1, false);
  assert.strictEqual(sweepRan, false);

  const oldRun = new Date(Date.now() - 90 * 60 * 1000); // 90m ago
  const mockDueConfigDb = {
    systemConfig: {
      findUnique: async () => ({
        lifecycleCronEnabled: true,
        lifecycleCronIntervalMinutes: 60,
        lastLifecycleRunAt: oldRun,
        lastLifecycleTransitions: 0,
      }),
      upsert: async () => { sweepRan = true; },
    },
  };

  const ran2 = await tickLifecycleScheduler(mockAppDb as any, mockDueConfigDb as any);
  assert.strictEqual(ran2, true);
  assert.strictEqual(sweepRan, true);
});

test('Lifecycle Scheduler - initLifecycleScheduler and stopLifecycleScheduler manage ticker handle', () => {
  stopLifecycleScheduler();
  initLifecycleScheduler(10000);
  assert.ok(globalThis.__kovertklaus_lifecycle_ticker__ !== undefined);

  stopLifecycleScheduler();
  assert.strictEqual(globalThis.__kovertklaus_lifecycle_ticker__, undefined);
  assert.strictEqual(globalThis.__kovertklaus_lifecycle_initial_timeout__, undefined);
});
