import test from 'node:test';
import assert from 'node:assert';
import { sendEmail } from './dispatcher';
import type { EmailConfig } from './types';

/**
 * `sendEmail` with the daily limit: Brevo is a mocked fetch and the ledger is an in-memory stand-in
 * for the `EmailOutbox` delegate, passed as `dbClient`.
 */

interface Row { status: string; recipients: number; subject: string; message?: string | null }

function fakeClient(sentToday: number, opts: { ledgerDown?: boolean } = {}) {
  const rows: Row[] = [];
  return {
    rows,
    emailOutbox: {
      async aggregate() {
        if (opts.ledgerDown) throw new Error('Connection terminated unexpectedly');
        const sent = rows.filter((r) => r.status === 'SENT').reduce((n, r) => n + r.recipients, 0);
        return { _sum: { recipients: sentToday + sent } };
      },
      async create({ data }: { data: Row }) {
        rows.push(data);
        return data;
      },
    },
    systemLog: { async create() {} },
  };
}

function brevoConfig(client: unknown): Partial<EmailConfig> {
  return {
    provider: 'brevo',
    brevoApiKey: 'test-placeholder',
    brevoSenderEmail: 'santa@example.com',
    brevoSenderName: 'KovertKlaus',
    dbClient: client,
    env: {},
  };
}

const message = { to: 'agent@example.com', subject: 'Your target', html: '<p>x</p>' };

function mockBrevo(t: test.TestContext, status: number) {
  return t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify(status === 201 ? { messageId: 'm-1' } : { message: 'rejected' }), { status })
  );
}

test('Email limit - under the cap the email is sent and counted', async (t) => {
  t.mock.method(console, 'log', () => {});
  const fetchMock = mockBrevo(t, 201);
  const client = fakeClient(10);
  const result = await sendEmail(message, brevoConfig(client), 1);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.held, undefined);
  assert.strictEqual(fetchMock.mock.callCount(), 1);
  assert.deepStrictEqual(client.rows.map((r) => [r.status, r.recipients]), [['SENT', 1]]);
});

test('Email limit - at the cap the email is held, not sent', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const fetchMock = mockBrevo(t, 201);
  const client = fakeClient(290);
  const result = await sendEmail(message, brevoConfig(client), 1);

  assert.deepStrictEqual([result.success, result.held], [true, true]);
  assert.strictEqual(fetchMock.mock.callCount(), 0);
  assert.strictEqual(client.rows.length, 1);
  assert.strictEqual(client.rows[0].status, 'HELD');
  assert.strictEqual(JSON.parse(client.rows[0].message!).subject, 'Your target');
});

test('Email limit - a Brevo quota rejection holds the email instead of losing it', async (t) => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  mockBrevo(t, 429);
  const client = fakeClient(100);
  const result = await sendEmail(message, brevoConfig(client), 1);

  assert.deepStrictEqual([result.success, result.held], [true, true]);
  assert.deepStrictEqual(client.rows.map((r) => r.status), ['HELD']);
});

test('Email limit - other Brevo errors still fail and are not held', async (t) => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  mockBrevo(t, 400);
  const client = fakeClient(100);
  const result = await sendEmail(message, brevoConfig(client), 1);

  assert.strictEqual(result.success, false);
  assert.strictEqual(client.rows.length, 0);
});

test('Email limit - if the ledger is down the email is still sent', async (t) => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'log', () => {});
  const fetchMock = mockBrevo(t, 201);
  const result = await sendEmail(message, brevoConfig(fakeClient(0, { ledgerDown: true })), 1);

  assert.strictEqual(result.success, true);
  assert.strictEqual(fetchMock.mock.callCount(), 1);
});
