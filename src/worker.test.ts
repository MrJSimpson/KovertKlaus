import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { isSafePublicUrl, normalizeProductUrl, generateInviteCode, signToken, verifyToken } from './lib/security';
import { executeTargetSwap, buildExclusionIndex, LinkedAssignment, ExclusionRuleInput } from './lib/draw';
import { evaluateMemberAudit } from './lib/demerits';

test('Next.js Dynamic Route Directives Alignment (Finding 3.2)', async (t) => {
  const apiDir = path.join(process.cwd(), 'src', 'app', 'api');

  function scanDir(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanDir(fullPath));
      } else if (entry.name === 'route.ts') {
        results.push(fullPath);
      }
    }
    return results;
  }

  const routeFiles = scanDir(apiDir);

  await t.test('All dynamic API routes do not contain force-static', () => {
    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const hasForceStatic = content.includes("export const dynamic = 'force-static'");
      assert.strictEqual(
        hasForceStatic,
        false,
        `File ${path.relative(process.cwd(), file)} contains illegal force-static directive!`
      );
    }
  });
});

test('Cloudflare Edge Worker API Parity Logic (Finding 3.1)', async (t) => {
  await t.test('2-Way Cascade Target Swap logic handles swaps correctly', () => {
    const currentAssignments: LinkedAssignment[] = [
      { agentId: 'agent_1', targetId: 'agent_2' },
      { agentId: 'agent_2', targetId: 'agent_3' },
      { agentId: 'agent_3', targetId: 'agent_1' },
    ];

    const exclusions: ExclusionRuleInput[] = [
      { agentId: 'agent_1', restrictedAgentId: 'agent_4' },
    ];

    // Swap agent_1 target to agent_3
    const updated = executeTargetSwap(currentAssignments, 'agent_1', 'agent_3', exclusions);

    const a1Target = updated.find((a) => a.agentId === 'agent_1')?.targetId;
    const displacedGiverTarget = updated.find((a) => a.agentId === 'agent_2')?.targetId;

    assert.strictEqual(a1Target, 'agent_3');
    assert.strictEqual(displacedGiverTarget, 'agent_2');
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
});
