import { db } from './db';
import { advanceMissionLifecycle } from './mission-lifecycle';

declare global {
  // eslint-disable-next-line no-var
  var __kovertklaus_lifecycle_interval__: NodeJS.Timeout | undefined;
  // eslint-disable-next-line no-var
  var __kovertklaus_lifecycle_initial_timeout__: NodeJS.Timeout | undefined;
}

export interface SchedulerConfig {
  enabled: boolean;
  intervalMinutes: number;
  initialDelaySeconds: number;
}

export function getSchedulerConfig(): SchedulerConfig {
  const enabledEnv = process.env.LIFECYCLE_CRON_ENABLED;
  const enabled = enabledEnv !== 'false' && enabledEnv !== '0';

  const intervalEnv = parseInt(process.env.LIFECYCLE_CRON_INTERVAL_MINUTES || '60', 10);
  const intervalMinutes = Math.max(1, isNaN(intervalEnv) ? 60 : intervalEnv);

  const initialDelayEnv = parseInt(process.env.LIFECYCLE_CRON_INITIAL_DELAY_SECONDS || '10', 10);
  const initialDelaySeconds = Math.max(0, isNaN(initialDelayEnv) ? 10 : initialDelayEnv);

  return { enabled, intervalMinutes, initialDelaySeconds };
}

export function stopLifecycleScheduler(): void {
  if (globalThis.__kovertklaus_lifecycle_initial_timeout__) {
    clearTimeout(globalThis.__kovertklaus_lifecycle_initial_timeout__);
    globalThis.__kovertklaus_lifecycle_initial_timeout__ = undefined;
  }
  if (globalThis.__kovertklaus_lifecycle_interval__) {
    clearInterval(globalThis.__kovertklaus_lifecycle_interval__);
    globalThis.__kovertklaus_lifecycle_interval__ = undefined;
  }
}

export async function executeLifecycleSweep(): Promise<void> {
  try {
    const summary = await advanceMissionLifecycle(db);
    if (summary.transitionsCount > 0) {
      console.log(`[Lifecycle Scheduler] Executed ${summary.transitionsCount} transition(s) across ${summary.missionsCheckedCount} active mission(s).`);
    } else {
      console.log(`[Lifecycle Scheduler] Routine check complete: 0 transitions needed (${summary.missionsCheckedCount} active mission(s)).`);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Lifecycle Scheduler] Error running mission lifecycle check: ${errorMsg}`);
  }
}

export function initLifecycleScheduler(): void {
  // Never run during production build or static export phases
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-export'
  ) {
    return;
  }

  const config = getSchedulerConfig();

  if (!config.enabled) {
    console.log('[Lifecycle Scheduler] Disabled via LIFECYCLE_CRON_ENABLED=false.');
    return;
  }

  // Clear any pre-existing timers in this process (prevents duplicate intervals on reload)
  stopLifecycleScheduler();

  const intervalMs = config.intervalMinutes * 60 * 1000;
  const initialDelayMs = config.initialDelaySeconds * 1000;

  console.log(
    `[Lifecycle Scheduler] In-process scheduler initialized: running every ${config.intervalMinutes}m (initial run in ${config.initialDelaySeconds}s).`
  );

  if (initialDelayMs > 0) {
    const initialTimer = setTimeout(async () => {
      await executeLifecycleSweep();
    }, initialDelayMs);
    initialTimer.unref?.();
    globalThis.__kovertklaus_lifecycle_initial_timeout__ = initialTimer;
  }

  const recurringTimer = setInterval(async () => {
    await executeLifecycleSweep();
  }, intervalMs);
  recurringTimer.unref?.();
  globalThis.__kovertklaus_lifecycle_interval__ = recurringTimer;
}
