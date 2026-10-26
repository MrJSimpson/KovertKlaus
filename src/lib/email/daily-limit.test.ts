import test from 'node:test';
import assert from 'node:assert';
import {
  checkQuota,
  crossedWarning,
  EmailQuotaStore,
  flushHeldEmails,
  HeldEmail,
  isQuotaRejection,
  MAX_FLUSH_ATTEMPTS,
  quotaDayStart,
  quotaSettings,
  recipientCount,
} from './daily-limit';
import type { EmailMessage, EmailResult } from './types';

/** In-memory EmailQuotaStore: sends are timestamped, held emails kept in order. */
function memoryStore(sentToday = 0, now = new Date()) {
  const sent: { at: Date; recipients: number }[] = sentToday ? [{ at: now, recipients: sentToday }] : [];
  const held: (HeldEmail & { status: string })[] = [];
  let nextId = 1;
  const store: EmailQuotaStore = {
    async sentSince(since) {
      return sent.filter((s) => s.at >= since).reduce((n, s) => n + s.recipients, 0);
    },
    async heldCount() {
      return held.filter((h) => h.status === 'HELD').length;
    },
    async recordSent(recipients) {
      sent.push({ at: now, recipients });
    },
    async hold(message, recipients) {
      held.push({ id: String(nextId++), message, recipients, attempts: 0, status: 'HELD' });
    },
    async listHeld(take) {
      return held.filter((h) => h.status === 'HELD').slice(0, take);
    },
    async markSent(id) {
      const h = held.find((x) => x.id === id)!;
      h.status = 'SENT';
      sent.push({ at: now, recipients: h.recipients });
    },
    async markAttemptFailed(id) {
      const h = held.find((x) => x.id === id)!;
      h.attempts++;
      if (h.attempts < MAX_FLUSH_ATTEMPTS) return { gaveUp: false };
      h.status = 'FAILED';
      return { gaveUp: true };
    },
    async prune() {},
  };
  return { store, sent, held };
}

const msg = (subject: string, to: EmailMessage['to'] = 'agent@example.com'): EmailMessage => ({ to, subject, html: '<p>x</p>' });
const ok = async (): Promise<EmailResult> => ({ success: true, provider: 'brevo' });
const settings = quotaSettings();

test('Daily limit - defaults: quota 300, cap 290, warning at 240; EMAIL_DAILY_QUOTA overrides', () => {
  assert.deepStrictEqual(quotaSettings(), { quota: 300, cap: 290, warnAt: 240 });
  assert.deepStrictEqual(quotaSettings({ EMAIL_DAILY_QUOTA: '1000' }), { quota: 1000, cap: 990, warnAt: 800 });
  assert.deepStrictEqual(quotaSettings({ EMAIL_DAILY_QUOTA: 'nope' }), { quota: 300, cap: 290, warnAt: 240 });
});

test('Daily limit - the quota day starts at midnight Pacific, across daylight-saving changes', () => {
  const cases: [string, string][] = [
    ['2026-10-26T20:00:00Z', '2026-10-26T07:00:00Z'], // PDT
    ['2026-10-27T07:00:00Z', '2026-10-27T07:00:00Z'], // exactly midnight
    ['2026-10-27T06:59:59Z', '2026-10-26T07:00:00Z'], // one second before
    ['2026-11-01T12:00:00Z', '2026-11-01T07:00:00Z'], // fall back day (beta launch): midnight was PDT
    ['2026-11-02T03:00:00Z', '2026-11-01T07:00:00Z'], // Nov 1, 19:00 PST
    ['2026-11-02T08:30:00Z', '2026-11-02T08:00:00Z'], // first PST midnight
    ['2026-03-08T12:00:00Z', '2026-03-08T08:00:00Z'], // spring forward day: midnight was PST
  ];
  for (const [now, start] of cases) {
    assert.strictEqual(quotaDayStart(new Date(now)).toISOString(), new Date(start).toISOString(), now);
  }
});

test('Daily limit - recipients count per address', () => {
  assert.strictEqual(recipientCount(msg('a')), 1);
  assert.strictEqual(recipientCount(msg('a', ['x@example.com', { email: 'y@example.com' }])), 2);
});

test('Daily limit - an email is sent up to the cap and held past it', async () => {
  assert.deepStrictEqual(await checkQuota(memoryStore(289).store, 1, settings), { send: true, usedBefore: 289 });
  assert.deepStrictEqual(await checkQuota(memoryStore(290).store, 1, settings), { send: false, usedBefore: 290 });
  assert.strictEqual((await checkQuota(memoryStore(289).store, 2, settings)).send, false);
});

test('Daily limit - sends before midnight Pacific do not count today', async () => {
  const now = new Date('2026-10-27T08:00:00Z'); // 01:00 PDT
  const { store, sent } = memoryStore(0, now);
  sent.push({ at: new Date('2026-10-27T06:30:00Z'), recipients: 290 }); // 23:30 PDT yesterday
  assert.deepStrictEqual(await checkQuota(store, 1, settings, now), { send: true, usedBefore: 0 });
});

test('Daily limit - the 80% warning fires once, on the send that reaches it', () => {
  assert.strictEqual(crossedWarning(238, 1, settings), false);
  assert.strictEqual(crossedWarning(239, 1, settings), true);
  assert.strictEqual(crossedWarning(238, 3, settings), true);
  assert.strictEqual(crossedWarning(240, 1, settings), false);
});

test('Daily limit - provider quota rejections are recognised', () => {
  assert.strictEqual(isQuotaRejection('Brevo API HTTP 429: Too Many Requests'), true);
  assert.strictEqual(isQuotaRejection('Brevo API HTTP 402: Not enough credits'), true);
  assert.strictEqual(isQuotaRejection('Brevo API HTTP 400: invalid email'), false);
  assert.strictEqual(isQuotaRejection(undefined), false);
});

test('Daily limit - flush sends held emails oldest first and stops at the cap', async () => {
  const { store, held } = memoryStore(287);
  for (const s of ['first', 'second', 'third', 'fourth']) await store.hold(msg(s), 1, 'cap');
  const delivered: string[] = [];
  const summary = await flushHeldEmails(store, async (m) => { delivered.push(m.subject); return ok(); }, settings);

  assert.deepStrictEqual(delivered, ['first', 'second', 'third']);
  assert.deepStrictEqual(summary, { sent: 3, failed: 0, gaveUp: 0, remaining: 1 });
  assert.strictEqual(held[3].status, 'HELD');
});

test('Daily limit - flush keeps order: a large email that does not fit blocks smaller ones behind it', async () => {
  const { store } = memoryStore(288);
  await store.hold(msg('big', ['a@example.com', 'b@example.com', 'c@example.com']), 3, 'cap');
  await store.hold(msg('small'), 1, 'cap');
  const delivered: string[] = [];
  const summary = await flushHeldEmails(store, async (m) => { delivered.push(m.subject); return ok(); }, settings);
  assert.deepStrictEqual(delivered, []);
  assert.strictEqual(summary.remaining, 2);
});

test('Daily limit - a failing held email is retried, then given up after the attempt limit', async () => {
  const { store, held } = memoryStore(0);
  await store.hold(msg('bounces'), 1, 'cap');
  const fail = async (): Promise<EmailResult> => ({ success: false, provider: 'brevo', error: 'Brevo API HTTP 500: oops' });
  for (let run = 1; run < MAX_FLUSH_ATTEMPTS; run++) {
    assert.deepStrictEqual(await flushHeldEmails(store, fail, settings), { sent: 0, failed: 1, gaveUp: 0, remaining: 1 });
  }
  assert.deepStrictEqual(await flushHeldEmails(store, fail, settings), { sent: 0, failed: 1, gaveUp: 1, remaining: 0 });
  assert.strictEqual(held[0].status, 'FAILED');
});

test('Daily limit - a provider quota rejection stops the flush until the next run', async () => {
  const { store } = memoryStore(0);
  await store.hold(msg('one'), 1, 'cap');
  await store.hold(msg('two'), 1, 'cap');
  let calls = 0;
  const summary = await flushHeldEmails(store, async () => { calls++; return { success: false, provider: 'brevo', error: 'Brevo API HTTP 429: limit' }; }, settings);
  assert.strictEqual(calls, 1);
  assert.deepStrictEqual(summary, { sent: 0, failed: 1, gaveUp: 0, remaining: 2 });
});
