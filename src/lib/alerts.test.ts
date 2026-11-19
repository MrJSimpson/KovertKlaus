import test from 'node:test';
import assert from 'node:assert';
import { alertGroup, alertTimeLabel, groupAlerts } from './alerts';
import { displayTitle, NOTICE, notificationKind, PINNED_KEY_PREFIXES } from './notification-copy';

// Local times, so the tests hold in any time zone.
const NOW = new Date(2026, 10, 19, 15, 0); // Thu Nov 19 2026, 3:00 PM
const at = (d: number, h = 9, m = 14) => new Date(2026, 10, d, h, m).toISOString();

test('Alerts - groups by local day: today, the six days before, earlier', () => {
  assert.strictEqual(alertGroup(at(19, 0, 0), NOW), 'today');
  assert.strictEqual(alertGroup(at(18, 23, 59), NOW), 'week');
  assert.strictEqual(alertGroup(at(13, 0, 0), NOW), 'week');
  assert.strictEqual(alertGroup(at(12, 23, 59), NOW), 'earlier');
  assert.strictEqual(alertGroup(at(20), NOW), 'today', 'a clock slightly ahead still counts as today');
});

test('Alerts - groupAlerts keeps order and skips empty groups', () => {
  const items = [{ id: 'a', createdAt: at(19) }, { id: 'b', createdAt: at(1) }, { id: 'c', createdAt: at(19, 8) }];
  const groups = groupAlerts(items, NOW);
  assert.deepStrictEqual(groups.map((g) => [g.label, g.items.map((i) => i.id)]), [['Today', ['a', 'c']], ['Earlier', ['b']]]);
});

test('Alerts - time labels: clock today, weekday this week, date earlier', () => {
  assert.strictEqual(alertTimeLabel(at(19), NOW), '9:14 AM');
  assert.strictEqual(alertTimeLabel(at(17), NOW), 'Tue');
  assert.strictEqual(alertTimeLabel(at(2), NOW), 'Nov 2');
  assert.strictEqual(alertTimeLabel(new Date(2025, 11, 24, 9).toISOString(), NOW), 'Dec 24, 2025');
});

test('Notification copy - every notice maps back to a kind', () => {
  const notices = [
    NOTICE.targetAssigned('x'), NOTICE.drawFailed('x', 'r'), NOTICE.drawTooFew('x', 3), NOTICE.missionPaused('x', ['a'], 'Nov 1'),
    NOTICE.agentActionNeeded('x', 'add an address', 'Nov 1'), NOTICE.missionCancelled('x', 'm'), NOTICE.missionDeleted('x', 'You', 'M'),
    NOTICE.agentLeft('x', 'u', 'M'), NOTICE.missionRemovedWithAccount('x', 'M'), NOTICE.joinRequests('x', 2), NOTICE.joinDeclined('x', 'M'),
    NOTICE.joinApproved('x'), NOTICE.invited('x', 'Holly'), NOTICE.recruitmentClosed('x'), NOTICE.shippingDeadline('x'), NOTICE.exchangeDay('x'),
    NOTICE.coalIssued('x', 1, 'ACTIVE'), NOTICE.coalCleared('x', 0, 'ACTIVE'), NOTICE.giftShipped('x', { local: true }), NOTICE.broadcast('x', 'hi'), NOTICE.nudge('x', 'hi'),
  ];
  for (const n of notices) {
    assert.notStrictEqual(notificationKind(n.dedupeKey, n.title), 'general', n.dedupeKey);
    assert.ok(!/^[^\p{L}\p{N}]/u.test(n.title), `no emoji: ${n.title}`);
  }
});

test('Notification copy - broadcasts and nudges get a fresh key each time, so they stack', () => {
  assert.notStrictEqual(NOTICE.broadcast('x', 'a').dedupeKey, NOTICE.broadcast('x', 'a').dedupeKey);
  assert.notStrictEqual(NOTICE.nudge('x', 'a').dedupeKey, NOTICE.nudge('x', 'a').dedupeKey);
  assert.strictEqual(NOTICE.targetAssigned('x').dedupeKey, NOTICE.targetAssigned('x').dedupeKey);
});

test('Notification copy - repair notices are the pinned ones', () => {
  const pinnedPrefix = (key: string) => PINNED_KEY_PREFIXES.some((p) => key.startsWith(`${p}:`));
  assert.ok(pinnedPrefix(NOTICE.missionPaused('x', [], 'd').dedupeKey));
  assert.ok(pinnedPrefix(NOTICE.agentActionNeeded('x', 't', 'd').dedupeKey));
  assert.ok(!pinnedPrefix(NOTICE.drawFailed('x', 'r').dedupeKey));
});

test('Notification copy - legacy titles: kind from the title, display without emoji or mission suffix', () => {
  assert.strictEqual(notificationKind(null, '📢 Exchange Broadcast: Office'), 'message');
  assert.strictEqual(notificationKind(null, '🔔 Mission Nudge: Office'), 'message');
  assert.strictEqual(notificationKind(null, 'Something else'), 'general');
  assert.strictEqual(displayTitle('🛑 Mission Cancelled: Office', 'Office'), 'Mission Cancelled');
  assert.strictEqual(displayTitle('⚠️ Action Needed: Office', 'Office'), 'Action Needed');
  assert.strictEqual(displayTitle('Target assigned', 'Office'), 'Target assigned');
  assert.strictEqual(displayTitle('An agent left Office', 'Office'), 'An agent left Office');
});
