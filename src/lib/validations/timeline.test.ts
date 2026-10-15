import test from 'node:test';
import assert from 'node:assert';
import { changeEventDate, changeEventDates, TimelineChangeError, type Timeline } from './timeline';

// Recruitment closed on Dec 1; today is Dec 5.
const today = new Date('2026-12-05T15:00:00Z');
const timeline: Timeline = {
  inviteCutoffDate: new Date('2026-12-01T00:00:00Z'),
  assignmentDate: new Date('2026-12-08T00:00:00Z'),
  shippingDate: new Date('2026-12-15T00:00:00Z'),
  executionDate: new Date('2026-12-20T00:00:00Z'),
};
const day = (d: Date | undefined) => d?.toISOString().slice(0, 10);

test('Timeline - a future date can move after the cutoff has passed', () => {
  const updates = changeEventDate(timeline, 2, '2026-12-18', today);
  assert.deepStrictEqual(Object.keys(updates), ['shippingDate']);
  assert.strictEqual(day(updates.shippingDate), '2026-12-18');
});

test('Timeline - index 0 must be after today and before the next date', () => {
  assert.strictEqual(day(changeEventDate(timeline, 0, '2026-12-07', today).inviteCutoffDate), '2026-12-07');
  assert.throws(() => changeEventDate(timeline, 0, '2026-12-05', today), /after today/);
  assert.throws(() => changeEventDate(timeline, 0, '2026-12-08', today), /Target Draw Date .* must be after Go\/No-Go Date/);
});

test('Timeline - middle dates must sit between their neighbours', () => {
  assert.throws(() => changeEventDate(timeline, 1, '2026-12-15', today), /Ship Deadline .* must be after Target Draw Date/);
  assert.throws(() => changeEventDate(timeline, 2, '2026-12-20', today), /Exchange Day .* must be after Ship Deadline/);
});

test('Timeline - the last date must be after the previous date and after today', () => {
  assert.strictEqual(day(changeEventDate(timeline, 3, '2026-12-27', today).executionDate), '2026-12-27');
  assert.throws(() => changeEventDate(timeline, 3, '2026-12-14', today), TimelineChangeError);
});

test('Timeline - unknown indexes and bad dates are rejected', () => {
  assert.throws(() => changeEventDate(timeline, 4, '2026-12-27', today), /eventIndex/);
  assert.throws(() => changeEventDate(timeline, -1, '2026-12-27', today), /eventIndex/);
  assert.throws(() => changeEventDate(timeline, 3, 'not-a-date', today), /not a valid date/);
});

test('Timeline - several dates can be pushed back together in one save', () => {
  // Moving Exchange Day alone to Dec 14 would fail; moving ship and exchange together is fine.
  const updates = changeEventDates(timeline, { shippingDate: '2026-12-22', executionDate: '2026-12-27' }, today);
  assert.deepStrictEqual(Object.keys(updates).sort(), ['executionDate', 'shippingDate']);
});

test('Timeline - unchanged and blank entries are ignored, so the full form can be sent', () => {
  const updates = changeEventDates(
    timeline,
    { inviteCutoffDate: '2026-12-01', assignmentDate: '2026-12-08', shippingDate: '', executionDate: '2026-12-21' },
    today
  );
  assert.deepStrictEqual(Object.keys(updates), ['executionDate']);
});

test('Timeline - a mission without a ship deadline orders the remaining dates', () => {
  const noShip = { ...timeline, shippingDate: null };
  assert.strictEqual(day(changeEventDate(noShip, 3, '2026-12-09', today).executionDate), '2026-12-09');
  assert.throws(() => changeEventDate(noShip, 3, '2026-12-08', today), /Exchange Day .* must be after Target Draw Date/);
});
