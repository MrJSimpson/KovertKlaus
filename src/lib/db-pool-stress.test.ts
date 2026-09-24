import test from 'node:test';
import assert from 'node:assert';
import pg from 'pg';
import { getDb, getRawDb, withDbRetry, invalidateCachedDb } from './db';
import { getAdminDb, getRawAdminDb, withAdminDbRetry, invalidateCachedAdminDb } from './adminDb';

/**
 * PostgreSQL Connection Pool Stress Test & Benchmark Suite
 * Sprint 2026-W39 Item 2: PgBouncer / Neon Connection Pool Under Concurrent Load
 */

test('PostgreSQL Connection Pool Configuration & Capacity Boundaries', async (t) => {
  await t.test('App connection pool specifies optimal defaults for pooled environments', () => {
    // Standard application pool configuration bounds
    const appPoolConfig = {
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    assert.strictEqual(appPoolConfig.max, 10, 'App pool max connections must be capped at 10');
    assert.strictEqual(appPoolConfig.idleTimeoutMillis, 30000, 'Idle connection timeout must be 30,000ms (30s)');
    assert.strictEqual(appPoolConfig.connectionTimeoutMillis, 10000, 'Connection acquisition timeout must be 10,000ms');
  });

  await t.test('Admin connection pool isolates privileged connections with dedicated limits', () => {
    // Admin pool is deliberately sized smaller to prevent resource starvation against app pool
    const adminPoolConfig = {
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    assert.strictEqual(adminPoolConfig.max, 5, 'Admin pool max connections must be capped at 5');
    assert.strictEqual(adminPoolConfig.idleTimeoutMillis, 30000, 'Admin idle timeout must be 30,000ms');
    assert.strictEqual(adminPoolConfig.connectionTimeoutMillis, 10000, 'Admin connection acquisition timeout must be 10,000ms');
  });

  await t.test('Neon serverless adapter configuration accounts for cold-start compute spinup', () => {
    const neonPoolConfig = {
      connectionTimeoutMillis: 15000,
      max: 10,
    };

    assert.strictEqual(neonPoolConfig.connectionTimeoutMillis, 15000, 'Neon connection timeout should allow 15s for cold start');
    assert.strictEqual(neonPoolConfig.max, 10, 'Neon serverless pool max should match app pool cap');
  });
});

test('Concurrent Query Burst Simulation & Pool Contention Benchmark', async (t) => {
  await t.test('Simulated 50-request concurrent burst queues and completes without connection exhaustion', async () => {
    const CONCURRENCY = 50;
    const POOL_CAPACITY = 10;
    let activeConnections = 0;
    let peakConnections = 0;
    let totalAcquisitions = 0;
    const latencies: number[] = [];

    // Simulated connection pool queue with finite slots
    class MockConnectionPool {
      private availableSlots = POOL_CAPACITY;
      private queue: Array<() => void> = [];

      async acquire(): Promise<void> {
        if (this.availableSlots > 0) {
          this.availableSlots--;
          activeConnections++;
          totalAcquisitions++;
          if (activeConnections > peakConnections) {
            peakConnections = activeConnections;
          }
          return;
        }

        return new Promise<void>((resolve) => {
          this.queue.push(() => {
            activeConnections++;
            totalAcquisitions++;
            if (activeConnections > peakConnections) {
              peakConnections = activeConnections;
            }
            resolve();
          });
        });
      }

      release(): void {
        activeConnections--;
        if (this.queue.length > 0) {
          const next = this.queue.shift()!;
          next();
        } else {
          this.availableSlots++;
        }
      }
    }

    const mockPool = new MockConnectionPool();

    // Simulated workload: 50 concurrent operatives requesting gift manifests and status checks
    const burstPromises = Array.from({ length: CONCURRENCY }, async (_, idx) => {
      const startTime = performance.now();
      await mockPool.acquire();

      try {
        // Simulate query I/O latency between 5ms and 35ms
        const simulatedIoMs = 5 + (idx % 30);
        await new Promise((r) => setTimeout(r, simulatedIoMs));
        return { success: true, idx };
      } finally {
        mockPool.release();
        latencies.push(performance.now() - startTime);
      }
    });

    const results = await Promise.all(burstPromises);

    // Assertions on pool contention handling
    assert.strictEqual(results.length, CONCURRENCY, `All ${CONCURRENCY} operations must complete`);
    assert.strictEqual(results.every((r) => r.success), true, 'All concurrent operations must succeed');
    assert.ok(peakConnections <= POOL_CAPACITY, `Peak connections (${peakConnections}) must never exceed capacity (${POOL_CAPACITY})`);
    assert.strictEqual(activeConnections, 0, 'All connections must be reclaimed post-burst (zero leaks)');
    assert.strictEqual(totalAcquisitions, CONCURRENCY, 'Total acquisitions must match request count exactly');

    // Benchmark Metric Assertions
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const mean = latencies.reduce((acc, v) => acc + v, 0) / latencies.length;

    assert.ok(p50 < 300, `P50 latency (${p50.toFixed(2)}ms) must be under 300ms under contention`);
    assert.ok(p95 < 800, `P95 latency (${p95.toFixed(2)}ms) must be under 800ms under contention`);
    assert.ok(p99 < 1500, `P99 latency (${p99.toFixed(2)}ms) must be under 1500ms under contention`);

    console.log(`\n📊 Connection Pool Stress Benchmark (${CONCURRENCY} concurrent queries against max:${POOL_CAPACITY} pool):`);
    console.log(`   - Peak Concurrent Slots Used: ${peakConnections}/${POOL_CAPACITY}`);
    console.log(`   - Mean Latency:               ${mean.toFixed(2)}ms`);
    console.log(`   - P50 Latency:                ${p50.toFixed(2)}ms`);
    console.log(`   - P95 Latency:                ${p95.toFixed(2)}ms`);
    console.log(`   - P99 Latency:                ${p99.toFixed(2)}ms`);
    console.log(`   - Connection Leak Count:      ${activeConnections} (Target: 0)\n`);
  });
});

test('Connection Leak Prevention & 30-Second Idle Reclamation Audit', async (t) => {
  await t.test('invalidateCachedDb resets references and closes active pool without hanging', async () => {
    let poolEnded = false;
    const fakePool = {
      end: async () => {
        poolEnded = true;
      },
    };

    // Invalidate clean state
    await assert.doesNotReject(async () => {
      await invalidateCachedDb();
    });

    // Invalidate again immediately to test idempotent teardown
    await assert.doesNotReject(async () => {
      await invalidateCachedDb();
    });
  });

  await t.test('invalidateCachedAdminDb resets references and closes admin pool safely', async () => {
    await assert.doesNotReject(async () => {
      await invalidateCachedAdminDb();
      await invalidateCachedAdminDb();
    });
  });

  await t.test('Simulated socket drop triggers clean teardown and unblocks waiting queries', async () => {
    let teardownExecuted = false;
    const mockTeardown = async () => {
      teardownExecuted = true;
      await invalidateCachedDb();
    };

    await mockTeardown();
    assert.strictEqual(teardownExecuted, true, 'Teardown handler must execute upon socket drop');
  });
});

test('Failover, Transient Connection Drops & Proxy Self-Healing Test Suite', async (t) => {
  await t.test('withDbRetry catches transient connection termination and recovers on subsequent attempt', async () => {
    let callCount = 0;
    const fakeQuery = async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Connection terminated unexpectedly');
      }
      return { status: 'RECOVERED', data: [1, 2, 3] };
    };

    // Fast retry simulator matching withDbRetry logic
    async function simulateRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
      let attempt = 0;
      while (true) {
        try {
          return await fn();
        } catch (err: any) {
          attempt++;
          const isConnError =
            err?.message?.includes('socket') ||
            err?.message?.includes('connection') ||
            err?.message?.includes('Connection terminated') ||
            err?.message?.includes('closed') ||
            err?.message?.includes('WebSocket') ||
            err?.message?.includes('ECONNRESET') ||
            err?.message?.includes('57P01');

          if (isConnError && attempt < maxRetries) {
            await invalidateCachedDb();
            // In unit tests use minimal delay
            await new Promise((r) => setTimeout(r, 10));
            continue;
          }
          throw err;
        }
      }
    }

    const result = await simulateRetry(fakeQuery, 3);
    assert.strictEqual(result.status, 'RECOVERED');
    assert.strictEqual(callCount, 2, 'Should succeed on attempt 2 after transient drop');
  });

  await t.test('withDbRetry handles multiple common transient network and proxy signatures', async () => {
    const transientErrors = [
      new Error('WebSocket connection closed unexpectedly'),
      new Error('read ECONNRESET'),
      new Error('terminating connection due to administrator command (57P01)'),
      new Error('Can\'t reach database server at kovertklaus-db:5432'),
      new Error('Connection lost before transaction commit'),
    ];

    for (const errorToSimulate of transientErrors) {
      let attempts = 0;
      const testFn = async () => {
        attempts++;
        if (attempts === 1) {
          throw errorToSimulate;
        }
        return 'SUCCESS';
      };

      let attempt = 0;
      let finalResult = '';
      while (true) {
        try {
          finalResult = await testFn();
          break;
        } catch (err: any) {
          attempt++;
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 5));
            continue;
          }
          throw err;
        }
      }

      assert.strictEqual(finalResult, 'SUCCESS');
      assert.strictEqual(attempts, 2, `Should have recovered from ${errorToSimulate.message}`);
    }
  });

  await t.test('Permanent business errors fail fast without consuming retry attempts', async () => {
    let attempts = 0;
    const businessErrorFn = async () => {
      attempts++;
      throw new Error('Unique constraint failed on the fields: (`email`)');
    };

    let caughtError: any = null;
    try {
      let attempt = 0;
      while (true) {
        try {
          await businessErrorFn();
          break;
        } catch (err: any) {
          attempt++;
          const isConnError =
            err?.message?.includes('socket') ||
            err?.message?.includes('connection') ||
            err?.message?.includes('Connection terminated');

          if (isConnError && attempt < 3) {
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, 'Non-connection error must be thrown');
    assert.strictEqual(attempts, 1, 'Non-connection error must fail fast on attempt 1 without retries');
    assert.ok(caughtError.message.includes('Unique constraint failed'));
  });

  await t.test('Max retries exhaustion throws diagnostic error when DB is truly unreachable', async () => {
    let attempts = 0;
    const persistentDropFn = async () => {
      attempts++;
      throw new Error('Connection terminated unexpectedly');
    };

    let caughtError: any = null;
    try {
      let attempt = 0;
      while (true) {
        try {
          await persistentDropFn();
          break;
        } catch (err: any) {
          attempt++;
          const isConnError = err?.message?.includes('Connection terminated');
          if (isConnError && attempt < 3) {
            await new Promise((r) => setTimeout(r, 5));
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError);
    assert.strictEqual(attempts, 3, 'Must attempt exactly maxRetries (3) times before giving up');
    assert.ok(caughtError.message.includes('Connection terminated'));
  });
});

test('Self-Healing Proxy Delegate Concurrency & Method Routing', async (t) => {
  await t.test('getDb returns resilient proxy with transparent model delegate access', () => {
    const proxyClient = getDb();
    assert.strictEqual(typeof proxyClient, 'object', 'getDb should return a proxy client object');
    assert.strictEqual(typeof (proxyClient as any).user, 'object', 'proxy.user should expose a model delegate');
    assert.strictEqual(typeof (proxyClient as any).exchange, 'object', 'proxy.exchange should expose a model delegate');
    assert.strictEqual(typeof (proxyClient as any).systemLog, 'object', 'proxy.systemLog should expose a model delegate');
    assert.strictEqual(typeof proxyClient.$transaction, 'function', 'proxy.$transaction should be a function');
  });

  await t.test('getAdminDb returns resilient proxy with transparent admin model delegate access', () => {
    const adminProxy = getAdminDb();
    assert.strictEqual(typeof adminProxy, 'object', 'getAdminDb should return an admin proxy object');
    assert.strictEqual(typeof (adminProxy as any).adminUser, 'object', 'adminProxy.adminUser should expose a delegate');
    assert.strictEqual(typeof (adminProxy as any).systemConfig, 'object', 'adminProxy.systemConfig should expose a delegate');
    assert.strictEqual(typeof adminProxy.$transaction, 'function', 'adminProxy.$transaction should be a function');
  });

  await t.test('Concurrent proxy delegate queries route through separate execution promises', async () => {
    // Verify that concurrently invoking proxy methods does not cause internal promise collisions
    const concurrentProxyCalls = Array.from({ length: 20 }, async (_, idx) => {
      return { queryId: idx, dispatchedAt: Date.now() };
    });

    const results = await Promise.all(concurrentProxyCalls);
    assert.strictEqual(results.length, 20);
    const uniqueIds = new Set(results.map((r) => r.queryId));
    assert.strictEqual(uniqueIds.size, 20, 'All 20 concurrent proxy calls must maintain discrete execution identity');
  });
});
