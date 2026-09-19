import { db } from './db';
import { adminDb } from './adminDb';
import { advanceMissionLifecycle, LifecycleSummary } from './mission-lifecycle';

declare global {
  // eslint-disable-next-line no-var
  var __kovertklaus_lifecycle_ticker__: NodeJS.Timeout | undefined;
  // eslint-disable-next-line no-var
  var __kovertklaus_lifecycle_initial_timeout__: NodeJS.Timeout | undefined;
}

export interface DynamicSchedulerState {
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt: Date | null;
  lastTransitions: number;
  dueForSweep: boolean;
}

/**
 * Evaluates whether the mission lifecycle scheduler is currently due for an automated sweep
 * based on the singleton SystemConfig record in PostgreSQL.
 */
export async function evaluateSchedulerState(
  dbClient = adminDb,
  envOverrideEnabled = process.env.LIFECYCLE_CRON_ENABLED
): Promise<DynamicSchedulerState> {
  // Hard environment variable killswitch (e.g. during specific testing / offline scenarios)
  if (envOverrideEnabled === 'false' || envOverrideEnabled === '0') {
    return {
      enabled: false,
      intervalMinutes: 60,
      lastRunAt: null,
      lastTransitions: 0,
      dueForSweep: false,
    };
  }

  try {
    const config = await (dbClient as any).systemConfig.findUnique({
      where: { id: 'singleton' },
      select: {
        lifecycleCronEnabled: true,
        lifecycleCronIntervalMinutes: true,
        lastLifecycleRunAt: true,
        lastLifecycleTransitions: true,
      },
    });

    const enabled = config?.lifecycleCronEnabled ?? true;
    const intervalMinutes = Math.max(1, config?.lifecycleCronIntervalMinutes ?? 60);
    const lastRunAt = config?.lastLifecycleRunAt ? new Date(config.lastLifecycleRunAt) : null;
    const lastTransitions = config?.lastLifecycleTransitions ?? 0;

    if (!enabled) {
      return { enabled: false, intervalMinutes, lastRunAt, lastTransitions, dueForSweep: false };
    }

    if (!lastRunAt) {
      return { enabled: true, intervalMinutes, lastRunAt: null, lastTransitions, dueForSweep: true };
    }

    const elapsedMs = Date.now() - lastRunAt.getTime();
    const intervalMs = intervalMinutes * 60 * 1000;
    const dueForSweep = elapsedMs >= intervalMs;

    return { enabled: true, intervalMinutes, lastRunAt, lastTransitions, dueForSweep };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Lifecycle Scheduler] Unable to read SystemConfig: ${msg}. Skipping evaluation tick.`);
    return {
      enabled: false,
      intervalMinutes: 60,
      lastRunAt: null,
      lastTransitions: 0,
      dueForSweep: false,
    };
  }
}

/**
 * Executes a mission lifecycle sweep, advancing eligible missions across milestone dates
 * and stamping lastLifecycleRunAt / lastLifecycleTransitions in SystemConfig.
 */
export async function executeLifecycleSweep(
  source: 'scheduler' | 'manual' = 'scheduler',
  appDb = db,
  configDb = adminDb
): Promise<LifecycleSummary> {
  const summary = await advanceMissionLifecycle(appDb);
  const now = new Date();

  try {
    await (configDb as any).systemConfig.upsert({
      where: { id: 'singleton' },
      update: {
        lastLifecycleRunAt: now,
        lastLifecycleTransitions: summary.transitionsCount,
      },
      create: {
        id: 'singleton',
        lifecycleCronEnabled: true,
        lifecycleCronIntervalMinutes: 60,
        lastLifecycleRunAt: now,
        lastLifecycleTransitions: summary.transitionsCount,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Lifecycle Scheduler] Failed to stamp execution telemetry in SystemConfig: ${msg}`);
  }

  if (summary.transitionsCount > 0) {
    console.log(
      `[Lifecycle Scheduler] [${source}] Executed ${summary.transitionsCount} transition(s) across ${summary.missionsCheckedCount} active mission(s).`
    );
  } else {
    console.log(
      `[Lifecycle Scheduler] [${source}] Routine sweep complete: 0 transitions needed across ${summary.missionsCheckedCount} active mission(s).`
    );
  }

  return summary;
}

/**
 * Periodic tick handler. Evaluates dynamic state and runs the sweep if due.
 */
export async function tickLifecycleScheduler(
  appDb = db,
  configDb = adminDb
): Promise<boolean> {
  const state = await evaluateSchedulerState(configDb);
  if (!state.enabled || !state.dueForSweep) {
    return false;
  }

  await executeLifecycleSweep('scheduler', appDb, configDb);
  return true;
}

export function stopLifecycleScheduler(): void {
  if (globalThis.__kovertklaus_lifecycle_initial_timeout__) {
    clearTimeout(globalThis.__kovertklaus_lifecycle_initial_timeout__);
    globalThis.__kovertklaus_lifecycle_initial_timeout__ = undefined;
  }
  if (globalThis.__kovertklaus_lifecycle_ticker__) {
    clearInterval(globalThis.__kovertklaus_lifecycle_ticker__);
    globalThis.__kovertklaus_lifecycle_ticker__ = undefined;
  }
}

/**
 * Initializes the in-process 60-second ticker in the Node.js runtime.
 */
export function initLifecycleScheduler(tickIntervalMs = 60000): void {
  // Never run during production build or static export phases
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-export'
  ) {
    return;
  }

  // Clear any existing ticker (prevents duplicate intervals on reload)
  stopLifecycleScheduler();

  console.log('[Lifecycle Scheduler] Dynamic database-driven scheduler initialized (evaluating every 60s).');

  // Initial warm-up evaluation 10s after server startup
  const initialDelay = parseInt(process.env.LIFECYCLE_CRON_INITIAL_DELAY_SECONDS || '10', 10);
  const initialDelayMs = Math.max(0, isNaN(initialDelay) ? 10 : initialDelay) * 1000;

  if (initialDelayMs > 0) {
    const initialTimer = setTimeout(async () => {
      try {
        await tickLifecycleScheduler();
      } catch (err) {
        console.error('[Lifecycle Scheduler] Error on initial warm-up sweep:', err);
      }
    }, initialDelayMs);
    initialTimer.unref?.();
    globalThis.__kovertklaus_lifecycle_initial_timeout__ = initialTimer;
  }

  // 60-second recurring evaluation ticker
  const ticker = setInterval(async () => {
    try {
      await tickLifecycleScheduler();
    } catch (err) {
      console.error('[Lifecycle Scheduler] Error during periodic evaluation tick:', err);
    }
  }, tickIntervalMs);
  ticker.unref?.();
  globalThis.__kovertklaus_lifecycle_ticker__ = ticker;
}
