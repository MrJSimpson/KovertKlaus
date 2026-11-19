import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBudget, relativeTime, stripLeadingEmoji } from './display-format';

test('Display format: budgets', () => {
  assert.equal(formatBudget(25, 50), '$25–$50');
  assert.equal(formatBudget(0, 40), '$40');
  assert.equal(formatBudget('20', '20'), '$20');
});

test('Display format: relative times', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  assert.equal(relativeTime('2026-11-20T11:59:40Z', now), 'Just now');
  assert.equal(relativeTime('2026-11-20T11:15:00Z', now), '45m ago');
  assert.equal(relativeTime('2026-11-20T10:00:00Z', now), '2h ago');
  assert.equal(relativeTime('2026-11-19T09:00:00Z', now), 'Yesterday');
  assert.equal(relativeTime('2026-11-16T09:00:00Z', now), '4 days ago');
});

test('Display format: leading emoji are removed, other text kept', () => {
  assert.equal(stripLeadingEmoji('🎯 Targets drawn'), 'Targets drawn');
  assert.equal(stripLeadingEmoji('⚠️ Draw paused'), 'Draw paused');
  assert.equal(stripLeadingEmoji('👩🏽‍🚀 Hi'), 'Hi');
  assert.equal(stripLeadingEmoji('Plain title 🎁'), 'Plain title 🎁');
});
