import test from 'node:test';
import assert from 'node:assert/strict';
import { missionCardView, toMissionListItem, type MissionListItem, type ViewerSummary } from './mission-card';

const NOW = new Date('2026-11-20T12:00:00Z');

function mission(over: Partial<MissionListItem> = {}, viewer: Partial<ViewerSummary> = {}): MissionListItem {
  return {
    id: 'm1',
    code: 'AB12-CD34',
    title: 'Operation Snowfall',
    status: 'RECRUITING',
    organizerId: 'boss',
    isWhiteElephant: false,
    budgetMin: 25,
    budgetMax: 50,
    currency: 'USD',
    maxParticipants: 25,
    inviteCutoffDate: '2026-11-25',
    assignmentDate: '2026-11-27',
    shippingDate: '2026-12-12',
    executionDate: '2026-12-20',
    createdAt: '2026-11-01T10:00:00Z',
    memberCount: 8,
    viewer: { isHeadElf: false, isMember: true, codename: 'Frosted Owl', wishlistItems: 0, hasTarget: false, shippingStatus: 'PENDING', blocking: [], ...viewer },
    ...over,
  };
}

const AFTER_CUTOFF = new Date('2026-11-26T12:00:00Z');
const AFTER_DRAW = new Date('2026-12-01T12:00:00Z');
const AFTER_SHIP = new Date('2026-12-15T12:00:00Z');

test('Mission card: RSVP rows (agent empty, agent ready, Head Elf)', () => {
  let c = missionCardView(mission(), NOW);
  assert.deepEqual([c.primary.label, c.secondary?.label, c.stamp.label], ['Build my wishlist', 'View mission', 'Elf Agent']);
  assert.deepEqual(c.steps, ['current', 'upcoming', 'upcoming', 'upcoming']);
  assert.equal(c.meta[1].value, '25 NOV');
  c = missionCardView(mission({}, { wishlistItems: 3 }), NOW);
  assert.equal(c.primary.label, 'Edit my wishlist');
  c = missionCardView(mission({ organizerId: 'me' }, { isHeadElf: true }), NOW);
  assert.deepEqual([c.primary.label, c.secondary?.label, c.stamp.label], ['Invite agents', 'Manage mission', 'Head Elf']);
});

test('Mission card: draw paused for Head Elf, blocking agent and bystander', () => {
  const paused = { repairDeadline: '2026-11-29' };
  let c = missionCardView(mission({ ...paused, organizerId: 'me' }, { isHeadElf: true }), AFTER_CUTOFF);
  assert.deepEqual([c.primary.label, c.secondary?.label, c.stamp.label, c.stamp.tone], ['Fix the draw', 'Manage mission', 'Draw paused', 'danger']);
  c = missionCardView(mission(paused, { blocking: ['EMPTY_WISHLIST'] }), AFTER_CUTOFF);
  assert.deepEqual([c.primary.label, c.stamp.label], ['Fix my wishlist', 'Action needed']);
  c = missionCardView(mission(paused, { blocking: ['MISSING_ADDRESS'] }), AFTER_CUTOFF);
  assert.equal(c.primary.label, 'Fix my address');
  c = missionCardView(mission(paused, { blocking: ['UNVERIFIED_EMAIL'] }), AFTER_CUTOFF);
  assert.deepEqual([c.primary.label, c.primary.href], ['Verify my email', '/verify-email']);
  c = missionCardView(mission(paused), AFTER_CUTOFF);
  assert.equal(c.primary.label, 'View mission');
});

test('Mission card: Sleigh rows (not shipped, shipped, doorstep drop)', () => {
  const drawn = { status: 'MATCHED' };
  let c = missionCardView(mission(drawn, { hasTarget: true }), AFTER_DRAW);
  assert.deepEqual([c.primary.label, c.secondary?.label], ['Add tracking', 'See my target']);
  assert.deepEqual(c.steps, ['done', 'done', 'current', 'upcoming']);
  c = missionCardView(mission(drawn, { hasTarget: true, shippingStatus: 'SHIPPED' }), AFTER_DRAW);
  assert.deepEqual([c.primary.label, c.secondary?.label, c.stamp.label], ['Track delivery', 'Mission Comms', 'Shipped']);
  c = missionCardView(mission(drawn, { hasTarget: true, shippingStatus: 'LOCAL_DELIVERY' }), AFTER_DRAW);
  assert.equal(c.stamp.label, 'Delivered');
});

test('Mission card: Party, Completed and Cancelled (void stamp, reason, deletion date)', () => {
  let c = missionCardView(mission({ status: 'SHIPPED' }, { hasTarget: true, shippingStatus: 'SHIPPED' }), AFTER_SHIP);
  assert.deepEqual([c.primary.label, c.secondary?.label], ['Post a thank-you', 'View mission']);
  c = missionCardView(mission({ status: 'COMPLETED' }), AFTER_SHIP);
  assert.deepEqual([c.primary.label, c.primary.variant, c.secondary, c.stamp.label], ['View mission', 'ghost', null, 'Completed']);
  c = missionCardView(mission({ status: 'CANCELLED', cancelCode: 'NOT_ENOUGH_AGENTS', cancelledAt: '2026-11-18T09:00:00Z', cancelledFromStatus: 'RECRUITING' }), NOW);
  assert.equal(c.cancelled, true);
  assert.equal(c.lead, 'Not enough agents joined.');
  assert.match(c.status, /Nothing was drawn or shipped\. Deleted on 16 Feb\./);
  assert.equal(c.tabDate, 'Cancelled 18 Nov');
  assert.ok(!c.steps.includes('current'));
});

test('Mission card: Head Elf note is quoted only for Head Elf cancellations', () => {
  const c = missionCardView(mission({ status: 'CANCELLED', cancelCode: 'HEAD_ELF_CANCELLED', cancelReason: 'Moved to January', cancelledAt: '2026-11-18T09:00:00Z' }), NOW);
  assert.equal(c.lead, 'Cancelled by the Head Elf.');
  assert.match(c.status, /“Moved to January”/);
});

test('Mission card: White Elephant asks for the gift, not a wishlist', () => {
  const c = missionCardView(mission({ isWhiteElephant: true }), NOW);
  assert.equal(c.primary.label, 'Add my gift');
});

test('Mission list: the viewer summary never carries other members’ targets or tracking', () => {
  const item = toMissionListItem(
    {
      organizerId: 'boss',
      repairIssues: JSON.stringify([{ type: 'EMPTY_WISHLIST', userId: 'me' }, { type: 'MISSING_ADDRESS', userId: 'other' }]),
      members: [
        { id: 'a', userId: 'me', role: 'MEMBER', shippingStatus: 'PENDING', targetUserId: 'other', trackingNumber: null, codename: 'Frosted Owl', wishlist: { _count: { wishlistItems: 0 } } },
        { id: 'b', userId: 'other', role: 'MEMBER', shippingStatus: 'SHIPPED', targetUserId: 'me', trackingNumber: '9400111899223344556677', codename: 'Tinsel Fox', wishlist: null },
      ],
    },
    'me',
  );
  const json = JSON.stringify(item);
  assert.ok(!json.includes('targetUserId'), 'targets stay on the server');
  assert.ok(!json.includes('9400111899223344556677'), 'tracking stays on the server');
  assert.ok(!json.includes('Tinsel Fox'), 'other codenames stay on the server');
  assert.deepEqual(item.viewer, { isHeadElf: false, isMember: true, codename: 'Frosted Owl', wishlistItems: 0, hasTarget: true, shippingStatus: 'PENDING', blocking: ['EMPTY_WISHLIST'] });
  assert.ok(!(item.repairIssues ?? '').includes('other'), 'agents only see issues that name them');
  assert.equal(item.memberCount, 2);
});

test('Mission card: a visitor who has not joined sees an invitation, not agent tasks', () => {
  const c = missionCardView(mission({}, { isMember: false }), NOW);
  assert.equal(c.stamp.label, 'Recruiting');
  assert.match(c.status, /^Recruiting until 25 Nov\. Join/);
});
