/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Prisma client is deliberately untyped */
import test from 'node:test';
import assert from 'node:assert';
import { resolveRegistrationCode } from './registration-code';

const APPROVAL = { id: 'pla1', email: 'ivy@x.com', inviteCode: 'ALPHA-0123456789ABCDEF' };

function mission(over: Record<string, unknown> = {}) {
  return { id: 'm1', code: 'NORTH1', status: 'RECRUITING', maxParticipants: null, members: [{ id: 'a' }, { id: 'b' }], ...over };
}

function fakeDb(missions: any[] = [], approvals: any[] = [APPROVAL]) {
  return {
    preLaunchApproval: {
      findFirst: async ({ where }: any) =>
        approvals.find((a) => a.email.toLowerCase() === where.email.equals.toLowerCase() && a.inviteCode === where.inviteCode) ?? null,
    },
    exchange: { findUnique: async ({ where }: any) => missions.find((m) => m.code === where.code) ?? null },
  } as any;
}

test('Registration code - alpha requires a code; beta lets agents register without one', async () => {
  const alpha = await resolveRegistrationCode(fakeDb(), 'ivy@x.com', '', true);
  assert.strictEqual(!alpha.ok && alpha.status, 403);
  assert.deepStrictEqual(await resolveRegistrationCode(fakeDb(), 'ivy@x.com', '', false), { ok: true, approval: null, mission: null });
});

test('Registration code - an activation code matches only its own email, in any case', async () => {
  const own = await resolveRegistrationCode(fakeDb(), 'ivy@x.com', ' alpha-0123456789abcdef ', true);
  assert.ok(own.ok && own.approval?.id === 'pla1' && own.mission === null);
  const other = await resolveRegistrationCode(fakeDb(), 'eve@x.com', 'ALPHA-0123456789ABCDEF', true);
  assert.strictEqual(!other.ok && other.status, 404);
});

test('Registration code - a recruiting mission with room is matched in every stage', async () => {
  for (const isAlpha of [true, false]) {
    const result = await resolveRegistrationCode(fakeDb([mission()]), 'ivy@x.com', 'north1', isAlpha);
    assert.ok(result.ok && result.mission?.id === 'm1');
  }
});

test('Registration code - outside alpha, a drawn or full mission is refused (was enrolled before)', async () => {
  const drawn = await resolveRegistrationCode(fakeDb([mission({ status: 'ACTIVE' })]), 'ivy@x.com', 'NORTH1', false);
  assert.ok(!drawn.ok && drawn.status === 400 && /Recruitment for this mission has closed/.test(drawn.error));
  const full = await resolveRegistrationCode(fakeDb([mission({ maxParticipants: 2 })]), 'ivy@x.com', 'NORTH1', false);
  assert.ok(!full.ok && full.status === 400 && /maximum operative capacity/.test(full.error));
});

test('Registration code - an unknown code is refused in every stage, with stage-specific wording', async () => {
  const alpha = await resolveRegistrationCode(fakeDb(), 'ivy@x.com', 'NOPE', true);
  assert.ok(!alpha.ok && alpha.status === 404 && /alpha cipher/.test(alpha.error));
  const beta = await resolveRegistrationCode(fakeDb(), 'ivy@x.com', 'NOPE', false);
  assert.ok(!beta.ok && beta.status === 404 && /register without a code/.test(beta.error));
});
