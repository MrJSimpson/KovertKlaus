import test from 'node:test';
import assert from 'node:assert';
import {
  evaluateSchedulerState,
  executeLifecycleSweep,
  tickLifecycleScheduler,
  initLifecycleScheduler,
  stopLifecycleScheduler,
} from './lifecycle-scheduler';

/** The scheduler's db parameters; each mock implements only the calls its test makes. */
type ConfigDb = NonNullable<Parameters<typeof evaluateSchedulerState>[0]>;
type AppDb = NonNullable<Parameters<typeof executeLifecycleSweep>[1]>;
const asConfigDb = (mock: object) => mock as ConfigDb;
const asAppDb = (mock: object) => mock as AppDb;

/** The SystemConfig upsert the sweep writes. */
interface SystemConfigUpsert {
  where: { id: string };
  update: { lastLifecycleTransitions?: number; lastLifecycleRunAt?: Date };
}

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

  const state = await evaluateSchedulerState(asConfigDb(mockConfigDb));
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

  const state = await evaluateSchedulerState(asConfigDb(mockConfigDb));
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

  const state = await evaluateSchedulerState(asConfigDb(mockConfigDb));
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

  const state = await evaluateSchedulerState(asConfigDb(mockConfigDb));
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

  const state = await evaluateSchedulerState(asConfigDb(mockConfigDb), 'false');
  assert.strictEqual(state.enabled, false);
  assert.strictEqual(state.dueForSweep, false);
});

test('Lifecycle Scheduler - executeLifecycleSweep stamps telemetry into SystemConfig', async () => {
  const mockAppDb = {
    exchange: {
      findMany: async () => [],
    },
  };

  let upsertPayload: SystemConfigUpsert | null = null;
  const mockConfigDb = {
    systemConfig: {
      upsert: async (args: SystemConfigUpsert) => {
        upsertPayload = args;
        return args;
      },
    },
  };

  const summary = await executeLifecycleSweep('manual', asAppDb(mockAppDb), asConfigDb(mockConfigDb));
  assert.strictEqual(summary.missionsCheckedCount, 0);
  assert.strictEqual(summary.transitionsCount, 0);

  assert.ok(upsertPayload !== null);
  const payload: SystemConfigUpsert = upsertPayload;
  assert.strictEqual(payload.where.id, 'singleton');
  assert.strictEqual(payload.update.lastLifecycleTransitions, 0);
  assert.ok(payload.update.lastLifecycleRunAt instanceof Date);
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

  const ran1 = await tickLifecycleScheduler(asAppDb(mockAppDb), asConfigDb(mockNotDueConfigDb));
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

  const ran2 = await tickLifecycleScheduler(asAppDb(mockAppDb), asConfigDb(mockDueConfigDb));
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
