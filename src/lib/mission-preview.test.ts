import test from 'node:test';
import assert from 'node:assert';
import { isMissionInsider, missionPreview, type PreviewSource } from './mission-preview';

function mission(extra: Record<string, unknown> = {}): PreviewSource & Record<string, unknown> {
  return {
    id: 'ex1',
    code: 'K9X2-R7M4',
    title: 'Operation Snowfall',
    description: 'Meet at the cabin',
    eventLocation: '12 Example Lane',
    status: 'RECRUITING',
    organizerId: 'u-head',
    isWhiteElephant: false,
    isCovertDelivery: false,
    propertyWaiverText: null,
    isLocalOnly: false,
    budgetMin: 25,
    budgetMax: 50,
    currency: 'USD',
    allowWishlistOverBudget: true,
    maxParticipants: 25,
    inviteCutoffDate: '2026-11-20T00:00:00.000Z',
    assignmentDate: '2026-11-21T00:00:00.000Z',
    shippingDate: '2026-12-12T00:00:00.000Z',
    executionDate: '2026-12-20T00:00:00.000Z',
    members: [
      { id: 'm1', userId: 'u-head', codename: 'Brass-Reindeer' },
      { id: 'm2', userId: 'u-agent', codename: 'Frosted-Owl' },
    ],
    reports: [{ id: 'report-secret' }],
    exclusionRules: [{ id: 'rule-secret' }],
    covertInviteTokens: [{ token: 'KDM-AAAA-BBBB-CCCC' }],
    repairIssues: '[{"kind":"NO_ADDRESS"}]',
    ...extra,
  };
}

test('isMissionInsider: Head Elf and enrolled agents only', () => {
  const m = mission();
  assert.strictEqual(isMissionInsider(m, 'u-head'), true);
  assert.strictEqual(isMissionInsider(m, 'u-agent'), true);
  assert.strictEqual(isMissionInsider(m, 'u-stranger'), false);
  assert.strictEqual(isMissionInsider(m, null), false);
  assert.strictEqual(isMissionInsider(m, undefined), false);
});

test('missionPreview: keeps what the join form needs', () => {
  const p = missionPreview(mission());
  assert.strictEqual(p.preview, true);
  assert.strictEqual(p.title, 'Operation Snowfall');
  assert.strictEqual(p.code, 'K9X2-R7M4');
  assert.strictEqual(p.status, 'RECRUITING');
  assert.strictEqual(p.budgetMax, 50);
  assert.strictEqual(p.memberCount, 2);
  assert.strictEqual(p.executionDate, '2026-12-20T00:00:00.000Z');
});

test('missionPreview: shows the Head Elf by codename only and hides every other agent', () => {
  const p = missionPreview(mission());
  assert.deepStrictEqual(p.members, [{ id: 'm1', userId: 'u-head', codename: 'Brass-Reindeer', role: 'ORGANIZER' }]);
  assert.strictEqual(p.organizer.name, null);
  assert.ok(!JSON.stringify(p).includes('Frosted-Owl'));
});

test('missionPreview: leaves out reports, rules, invite tokens, repair details, description and location', () => {
  const json = JSON.stringify(missionPreview(mission()));
  for (const secret of ['report-secret', 'rule-secret', 'KDM-AAAA-BBBB-CCCC', 'NO_ADDRESS', 'Meet at the cabin', '12 Example Lane']) {
    assert.ok(!json.includes(secret), secret);
  }
});
