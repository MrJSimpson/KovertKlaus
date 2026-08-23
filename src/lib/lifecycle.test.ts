import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextMilestoneCountdown, formatDateString, formatCodename } from './security';
import { calculateAutomaticOperationDates } from './validations/operation';

test('Lifecycle & Milestone Engine Test Suite', async (t) => {
  await t.test('calculateAutomaticOperationDates derives correct staggered timeline from execution date', () => {
    const dates = calculateAutomaticOperationDates('2026-12-25');
    assert.equal(dates.executionDate, '2026-12-25');
    assert.ok(new Date(dates.inviteCutoffDate) <= new Date(dates.assignmentDate));
    assert.ok(new Date(dates.assignmentDate) <= new Date(dates.shippingDate));
    assert.ok(new Date(dates.shippingDate) <= new Date(dates.executionDate));
  });

  await t.test('getNextMilestoneCountdown handles null / empty mission gracefully', () => {
    const result = getNextMilestoneCountdown(null);
    assert.equal(result.phaseStatusLabel, 'Active');
    assert.equal(result.milestoneLabel, 'Milestone');
    assert.equal(result.daysLeft, 0);
    assert.equal(result.formattedText, 'N/A');
    assert.equal(result.isPast, false);
    assert.equal(result.isToday, false);
  });

  await t.test('getNextMilestoneCountdown recognizes COMPLETED status', () => {
    const mission = {
      status: 'COMPLETED',
      executionDate: '2026-12-25',
    };
    const result = getNextMilestoneCountdown(mission);
    assert.equal(result.phaseStatusLabel, 'Completed');
    assert.equal(result.milestoneLabel, 'Exchange Day');
    assert.equal(result.formattedText, 'Operation Completed');
    assert.equal(result.isPast, true);
    assert.equal(result.isToday, false);
  });

  await t.test('getNextMilestoneCountdown handles RECRUITING stage milestones', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const dateStr = futureDate.toISOString().split('T')[0];

    const mission = {
      status: 'RECRUITING',
      inviteCutoffDate: dateStr,
      assignmentDate: '2026-12-01',
      shippingDate: '2026-12-15',
      executionDate: '2026-12-25',
    };

    const result = getNextMilestoneCountdown(mission);
    assert.equal(result.phaseStatusLabel, 'Recruiting');
    assert.equal(result.milestoneLabel, 'RSVP Cutoff');
    assert.equal(result.daysLeft, 10);
    assert.equal(result.formattedText, 'In 10 days');
    assert.equal(result.isPast, false);
    assert.equal(result.isToday, false);
  });

  await t.test('getNextMilestoneCountdown handles Today milestone with celebratory label', () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    const mission = {
      status: 'RECRUITING',
      inviteCutoffDate: dateStr,
    };

    const result = getNextMilestoneCountdown(mission);
    assert.equal(result.phaseStatusLabel, 'RSVP Cutoff Day');
    assert.equal(result.daysLeft, 0);
    assert.equal(result.isToday, true);
    assert.equal(result.formattedText, 'Today! 🎉');
  });

  await t.test('getNextMilestoneCountdown handles Tomorrow milestone', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const mission = {
      status: 'RECRUITING',
      inviteCutoffDate: dateStr,
    };

    const result = getNextMilestoneCountdown(mission);
    assert.equal(result.daysLeft, 1);
    assert.equal(result.formattedText, 'Tomorrow ⏳');
  });

  await t.test('formatDateString formats ISO strings safely without UTC backward shifts', () => {
    assert.equal(formatDateString('2026-12-25'), 'Dec 25, 2026');
    assert.equal(formatDateString('2026-11-20T00:00:00.000Z'), 'Nov 20, 2026');
    assert.equal(formatDateString(null), 'N/A');
    assert.equal(formatDateString('invalid-date'), 'N/A');
  });

  await t.test('formatCodename enforces Agent: prefix cleanly', () => {
    assert.equal(formatCodename('Joshua'), 'Agent: Joshua');
    assert.equal(formatCodename('Agent: Trinity'), 'Agent: Trinity');
    assert.equal(formatCodename('Agent-Morpheus'), 'Agent: Morpheus');
    assert.equal(formatCodename(null, 'Shannon'), 'Agent: Shannon');
    assert.equal(formatCodename(null, null), 'Agent: Unknown');
  });
});
