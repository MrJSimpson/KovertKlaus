import test from 'node:test';
import assert from 'node:assert';
import {
  getSchedulerConfig,
  initLifecycleScheduler,
  stopLifecycleScheduler,
} from './lifecycle-scheduler';

test('Lifecycle Scheduler - parses default configuration when environment variables are unset', () => {
  const oldEnabled = process.env.LIFECYCLE_CRON_ENABLED;
  const oldInterval = process.env.LIFECYCLE_CRON_INTERVAL_MINUTES;
  const oldDelay = process.env.LIFECYCLE_CRON_INITIAL_DELAY_SECONDS;

  delete process.env.LIFECYCLE_CRON_ENABLED;
  delete process.env.LIFECYCLE_CRON_INTERVAL_MINUTES;
  delete process.env.LIFECYCLE_CRON_INITIAL_DELAY_SECONDS;

  try {
    const config = getSchedulerConfig();
    assert.strictEqual(config.enabled, true);
    assert.strictEqual(config.intervalMinutes, 60);
    assert.strictEqual(config.initialDelaySeconds, 10);
  } finally {
    if (oldEnabled !== undefined) process.env.LIFECYCLE_CRON_ENABLED = oldEnabled;
    if (oldInterval !== undefined) process.env.LIFECYCLE_CRON_INTERVAL_MINUTES = oldInterval;
    if (oldDelay !== undefined) process.env.LIFECYCLE_CRON_INITIAL_DELAY_SECONDS = oldDelay;
  }
});

test('Lifecycle Scheduler - parses custom environment variables correctly', () => {
  const oldEnabled = process.env.LIFECYCLE_CRON_ENABLED;
  const oldInterval = process.env.LIFECYCLE_CRON_INTERVAL_MINUTES;
  const oldDelay = process.env.LIFECYCLE_CRON_INITIAL_DELAY_SECONDS;

  process.env.LIFECYCLE_CRON_ENABLED = 'false';
  process.env.LIFECYCLE_CRON_INTERVAL_MINUTES = '30';
  process.env.LIFECYCLE_CRON_INITIAL_DELAY_SECONDS = '5';

  try {
    const config = getSchedulerConfig();
    assert.strictEqual(config.enabled, false);
    assert.strictEqual(config.intervalMinutes, 30);
    assert.strictEqual(config.initialDelaySeconds, 5);
  } finally {
    if (oldEnabled !== undefined) process.env.LIFECYCLE_CRON_ENABLED = oldEnabled; else delete process.env.LIFECYCLE_CRON_ENABLED;
    if (oldInterval !== undefined) process.env.LIFECYCLE_CRON_INTERVAL_MINUTES = oldInterval; else delete process.env.LIFECYCLE_CRON_INTERVAL_MINUTES;
    if (oldDelay !== undefined) process.env.LIFECYCLE_CRON_INITIAL_DELAY_SECONDS = oldDelay; else delete process.env.LIFECYCLE_CRON_INITIAL_DELAY_SECONDS;
  }
});

test('Lifecycle Scheduler - clamps minimum interval to at least 1 minute', () => {
  const oldInterval = process.env.LIFECYCLE_CRON_INTERVAL_MINUTES;
  process.env.LIFECYCLE_CRON_INTERVAL_MINUTES = '-10';

  try {
    const config = getSchedulerConfig();
    assert.strictEqual(config.intervalMinutes, 1);
  } finally {
    if (oldInterval !== undefined) process.env.LIFECYCLE_CRON_INTERVAL_MINUTES = oldInterval; else delete process.env.LIFECYCLE_CRON_INTERVAL_MINUTES;
  }
});

test('Lifecycle Scheduler - stopLifecycleScheduler clears active timers cleanly', () => {
  process.env.LIFECYCLE_CRON_ENABLED = 'true';
  process.env.LIFECYCLE_CRON_INTERVAL_MINUTES = '15';
  process.env.LIFECYCLE_CRON_INITIAL_DELAY_SECONDS = '100';

  try {
    initLifecycleScheduler();
    assert.ok(globalThis.__kovertklaus_lifecycle_interval__ !== undefined);
    assert.ok(globalThis.__kovertklaus_lifecycle_initial_timeout__ !== undefined);

    stopLifecycleScheduler();
    assert.strictEqual(globalThis.__kovertklaus_lifecycle_interval__, undefined);
    assert.strictEqual(globalThis.__kovertklaus_lifecycle_initial_timeout__, undefined);
  } finally {
    stopLifecycleScheduler();
  }
});

test('Lifecycle Scheduler - does not initialize when LIFECYCLE_CRON_ENABLED is false', () => {
  process.env.LIFECYCLE_CRON_ENABLED = 'false';

  try {
    stopLifecycleScheduler();
    initLifecycleScheduler();
    assert.strictEqual(globalThis.__kovertklaus_lifecycle_interval__, undefined);
    assert.strictEqual(globalThis.__kovertklaus_lifecycle_initial_timeout__, undefined);
  } finally {
    delete process.env.LIFECYCLE_CRON_ENABLED;
    stopLifecycleScheduler();
  }
});

test('Lifecycle Scheduler - skips initialization during Next.js production build phase', () => {
  process.env.LIFECYCLE_CRON_ENABLED = 'true';
  process.env.NEXT_PHASE = 'phase-production-build';

  try {
    stopLifecycleScheduler();
    initLifecycleScheduler();
    assert.strictEqual(globalThis.__kovertklaus_lifecycle_interval__, undefined);
    assert.strictEqual(globalThis.__kovertklaus_lifecycle_initial_timeout__, undefined);
  } finally {
    delete process.env.NEXT_PHASE;
    stopLifecycleScheduler();
  }
});
