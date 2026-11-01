import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { isSafePublicUrl, normalizeProductUrl, generateInviteCode, signToken, verifyToken } from './lib/security';
import { executeTargetSwap, buildExclusionIndex, LinkedAssignment, ExclusionRuleInput } from './lib/draw';
import { evaluateMemberAudit } from './lib/demerits';

test('Next.js Route Configuration & Edge Assets Alignment (Finding 3.2)', async (t) => {
  await t.test('next.config.ts configures static export for Cloudflare Pages/Workers', () => {
    const configPath = path.join(process.cwd(), 'next.config.ts');
    const content = fs.readFileSync(configPath, 'utf-8');
    assert.strictEqual(content.includes('output: "export"'), true);
    assert.strictEqual(content.includes('isStaticExport'), true);
  });
});

test('Cloudflare Edge Worker API Parity Logic (Finding 3.1)', async (t) => {
  await t.test('Circle-preserving target swap moves the new target into place', () => {
    const currentAssignments: LinkedAssignment[] = [
      { agentId: 'agent_1', targetId: 'agent_2' },
      { agentId: 'agent_2', targetId: 'agent_3' },
      { agentId: 'agent_3', targetId: 'agent_4' },
      { agentId: 'agent_4', targetId: 'agent_1' },
    ];

    const exclusions: ExclusionRuleInput[] = [
      { agentId: 'agent_1', restrictedAgentId: 'agent_5' },
    ];

    // Move agent_4 in after agent_1: agent_1 -> agent_4 -> agent_2, and agent_3 -> agent_1 closes the gap.
    const updated = executeTargetSwap(currentAssignments, 'agent_1', 'agent_4', exclusions);
    const targetOf = (id: string) => updated.find((a) => a.agentId === id)?.targetId;

    assert.strictEqual(targetOf('agent_1'), 'agent_4');
    assert.strictEqual(targetOf('agent_4'), 'agent_2');
    assert.strictEqual(targetOf('agent_3'), 'agent_1');
  });

  await t.test('Execution Day Demerit Audit logic handles penalties and clearing', () => {
    // Unfulfilled member with no tracking -> penalized
    const penalizedOutcome = evaluateMemberAudit({
      userId: 'user_neglect',
      shippingStatus: 'PENDING',
      deliveredConfirmed: false,
      trackingNumber: null,
      currentPenaltyPoints: 0,
      currentAccountStatus: 'ACTIVE',
      isWhiteElephant: false,
    });

    assert.strictEqual(penalizedOutcome.penalized, true);
    assert.strictEqual(penalizedOutcome.newDemeritCount, 1);

    // Member with tracking number -> protected
    const protectedOutcome = evaluateMemberAudit({
      userId: 'user_protected',
      shippingStatus: 'SHIPPED',
      deliveredConfirmed: false,
      trackingNumber: '9400111899562537624132',
      currentPenaltyPoints: 0,
      currentAccountStatus: 'ACTIVE',
      isWhiteElephant: false,
    });

    assert.strictEqual(protectedOutcome.penalized, false);
    assert.strictEqual(protectedOutcome.newDemeritCount, 0);

    // Rehabilitating member with previous points
    const rehabOutcome = evaluateMemberAudit({
      userId: 'user_rehab',
      shippingStatus: 'DELIVERED',
      deliveredConfirmed: true,
      trackingNumber: '9400111899562537624132',
      currentPenaltyPoints: 2,
      currentAccountStatus: 'ACTIVE',
      isWhiteElephant: false,
    });

    assert.strictEqual(rehabOutcome.demeritCleared, true);
    assert.strictEqual(rehabOutcome.newDemeritCount, 1);
  });

  await t.test('Scraper SSRF validation blocks malicious endpoints on edge', () => {
    assert.strictEqual(isSafePublicUrl('http://169.254.169.254/latest/meta-data').safe, false);
    assert.strictEqual(isSafePublicUrl('http://127.0.0.1:3000').safe, false);
    assert.strictEqual(isSafePublicUrl('http://10.0.0.1/admin').safe, false);
    assert.strictEqual(isSafePublicUrl('http://192.168.1.1/').safe, false);
    assert.strictEqual(isSafePublicUrl('https://www.amazon.com/dp/B08N5WRWNW').safe, true);
  });

  await t.test('Clearance leads route structure exists and is configured for edge', () => {
    const leadsRoutePath = path.join(process.cwd(), 'src', 'app', 'api', 'northpole', 'leads', 'route.ts');
    assert.strictEqual(fs.existsSync(leadsRoutePath), true);
    const content = fs.readFileSync(leadsRoutePath, 'utf-8');
    assert.strictEqual(content.includes('export async function GET'), true);
    assert.strictEqual(content.includes('export async function DELETE'), true);
  });

  await t.test('wrangler.json defines Cloudflare Worker scheduled cron trigger for mission lifecycle', () => {
    const wranglerPath = path.join(process.cwd(), 'wrangler.json');
    assert.strictEqual(fs.existsSync(wranglerPath), true);
    const wranglerConfig = JSON.parse(fs.readFileSync(wranglerPath, 'utf-8'));
    assert.ok(wranglerConfig.triggers, 'wrangler.json must define triggers');
    assert.ok(Array.isArray(wranglerConfig.triggers.crons), 'triggers.crons must be an array');
    assert.strictEqual(wranglerConfig.triggers.crons.includes('0 * * * *'), true);
  });

  await t.test('worker.ts default export provides scheduled handler invoking ctx.waitUntil for lifecycle', async () => {
    const worker = (await import('./worker')).default;
    assert.strictEqual(typeof worker.scheduled, 'function');

    let waitedPromise: Promise<any> | null = null;
    const mockCtx = {
      waitUntil: (p: Promise<any>) => {
        waitedPromise = p;
      },
    };

    await worker.scheduled(
      { cron: '0 6 * * *', scheduledTime: Date.now() },
      { ASSETS: { fetch: async () => new Response('ok') } },
      mockCtx
    );

    assert.ok(waitedPromise, 'scheduled() must pass execution promise to ctx.waitUntil()');
    await waitedPromise;
  });

  await t.test('worker.ts default export provides fetch handler for edge requests', async () => {
    const worker = (await import('./worker')).default;
    assert.strictEqual(typeof worker.fetch, 'function');
  });
});


test('Edge Worker Route Parity: every Next.js API route has a worker handler', () => {
  const workerSource = fs.readFileSync(path.join(process.cwd(), 'src', 'worker.ts'), 'utf-8');
  const setBlock = workerSource.match(/export const WORKER_API_PATHS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(setBlock, 'WORKER_API_PATHS must be declared in worker.ts');
  const workerPaths = new Set([...setBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));

  const apiRoot = path.join(process.cwd(), 'src', 'app', 'api');
  const nextPaths: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts') {
        nextPaths.push('/api/' + path.relative(apiRoot, dir).split(path.sep).join('/'));
      }
    }
  };
  walk(apiRoot);

  for (const p of nextPaths) {
    assert.ok(workerPaths.has(p), `Next.js route ${p} has no entry in WORKER_API_PATHS`);
  }
  for (const p of workerPaths) {
    assert.ok(workerSource.includes(`pathname === '${p}'`), `WORKER_API_PATHS lists ${p} but no handler matches it`);
  }
});

test('Edge Worker Email Config - every email path reads SystemConfig through the admin client', () => {
  // SystemConfig and SystemLog are in the admin schema. Resolving email settings through the app
  // client silently fell back to env vars, so invites, welcome mail and nudges were never sent.
  const source = fs.readFileSync(path.join(process.cwd(), 'src', 'worker.ts'), 'utf-8');
  const calls = source.match(/resolveWorkerEmailConfig\(env, \w+/g) ?? [];
  assert.ok(calls.length > 0, 'expected resolveWorkerEmailConfig call sites');
  assert.deepStrictEqual(calls.filter((c) => !c.endsWith('adminDb')), []);
  assert.match(source, /const configDbClient = adminConnStr \? getAdminDb\(adminConnStr\) : dbClient;/);
});

test('Session Revocation - every password change revokes other sessions, and both runtimes enforce it', () => {
  // A password change sets User.sessionsRevokedAt; user tokens issued earlier must stop working.
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), 'src', ...p), 'utf-8');
  const writers = [read('worker.ts'), read('app', 'api', 'users', 'me', 'route.ts'), read('app', 'api', 'users', 'profile', 'route.ts')];
  for (const source of writers) {
    const changes = source.match(/updateData\.passwordHash = await hashPassword\(newPassword\);\s*\n(?:\s*\/\/.*\n)?\s*updateData\.sessionsRevokedAt = new Date\(\);/g) ?? [];
    const writes = source.match(/updateData\.passwordHash = await hashPassword\(newPassword\);/g) ?? [];
    assert.ok(writes.length > 0);
    assert.strictEqual(changes.length, writes.length, 'each password change must also set sessionsRevokedAt');
  }

  const worker = read('worker.ts');
  assert.match(worker, /const db = getDb\(appConnStr\);\s*\n(?:\s*\/\/.*\n)+\s*await markRevokedUserSession\(request, db, adminDb, env, pathname\);/);
  assert.match(worker, /function getUserIdFromRequest\(request: Request\): string \| null \{\s*\n\s*if \(revokedSessionRequests\.has\(request\)\) return null;/);
  assert.match(read('lib', 'auth.ts'), /isSessionRevoked\(claims, user\.sessionsRevokedAt\)/);
});

test('Email Verification - unverified agents are gated in both runtimes, with only /me and verify routes exempt', () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), 'src', ...p), 'utf-8');
  const worker = read('worker.ts');
  // The Worker's one-per-request lookup marks unverified sessions and signs them out off the allow-list.
  assert.match(worker, /unverifiedSessionRequests\.add\(request\);\s*\n\s*if \(!UNVERIFIED_ALLOWED_PATHS\.has\(pathname\)\) revokedSessionRequests\.add\(request\);/);
  assert.match(worker, /request\.method === 'GET' && unverifiedSessionRequests\.has\(request\)/);
  // Self-hosted: getSessionUserId refuses unverified sessions unless the caller opts in.
  assert.match(read('lib', 'auth.ts'), /if \(session\.unverified && !options\.allowUnverified\) return null;/);

  // Only resend and account deletion opt in (the /me route reads the full session state instead).
  const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
  const optIns: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts' && fs.readFileSync(full, 'utf-8').includes('allowUnverified: true')) {
        optIns.push(path.relative(apiDir, full).split(path.sep).join('/'));
      }
    }
  };
  walk(apiDir);
  assert.deepStrictEqual(optIns.sort(), ['users/delete-account/route.ts', 'users/verify-email/route.ts']);

  // Both sign-up paths decide verification at creation.
  for (const source of [worker, read('app', 'api', 'users', 'route.ts')]) {
    assert.match(source, /emailVerifiedAt: mustVerify \? null : new Date\(\),/);
  }
});

test('Account Export - Worker serves downloads from the USER_EXPORTS binding declared in wrangler.json', () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), 'utf-8');
  const worker = read('src', 'worker.ts');
  assert.match(worker, /pathname === '\/api\/users\/data-export' && request\.method === 'GET'/);
  assert.match(worker, /exportStore: env\.USER_EXPORTS \? r2ExportStore\(env\.USER_EXPORTS\) : undefined,/);
  const wrangler = JSON.parse(read('wrangler.json')) as { r2_buckets?: Array<{ binding: string; bucket_name: string }> };
  assert.deepStrictEqual(wrangler.r2_buckets, [{ binding: 'USER_EXPORTS', bucket_name: 'kovertklaus' }]);
  // The disk store (Node fs) must never be bundled into the Worker.
  assert.doesNotMatch(worker, /export-store-disk/);
});

test('Head Elf Approval - joining by code and signing up with a code go through join-requests in both runtimes', () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), 'src', ...p), 'utf-8');
  const worker = read('worker.ts');
  const acceptBlock = worker.slice(worker.indexOf("if (pathname === '/api/invitations/accept'"), worker.indexOf("if (pathname === '/api/codename'"));
  const selfHostedAccept = read('app', 'api', 'invitations', 'accept', 'route.ts');
  for (const source of [acceptBlock, selfHostedAccept]) {
    assert.match(source, /await joinMission\(\{ db, adminDb \}, exchange, \{ userId: activeUserId, inviteToken: bodyString\(body\.inviteToken\) \}\)/);
    assert.doesNotMatch(source, /exchangeMember\.create|enrollWithCodename/, 'no direct enrollment by code');
  }
  for (const source of [worker, read('app', 'api', 'users', 'route.ts')]) {
    assert.match(source, /joinWithInviteAtSignup\(\{ db, adminDb \}, targetExchange, user\.id, bodyString\(body\.inviteToken\)\)/);
    assert.match(source, /requestToJoinAtSignup\(db, targetExchange, user\.id\)/);
  }
});

test('Nudge - both runtimes use the shared deadline nudge', () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), 'src', ...p), 'utf-8');
  for (const source of [read('worker.ts'), read('app', 'api', 'operations', 'route.ts')]) {
    assert.match(source, /await dispatchNudge\(db, \{/);
    assert.doesNotMatch(source, /Please update your Wishlist Manifest and review mission directives/);
  }
});
