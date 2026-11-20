import test from 'node:test';
import assert from 'node:assert/strict';
import { afterAuthPath, formatMissionCode, missionCodePath, readAuthParams } from './auth-flow';

test('Auth flow: invitation links keep their code, email and invite token', () => {
  const p = readAuthParams('?code=vg2t-cjcw&email=holly%40example.org&invite=abc.def');
  assert.deepEqual(p, { code: 'VG2T-CJCW', email: 'holly@example.org', invite: 'abc.def', next: null });
});

test('Auth flow: alphaCode still works and empty values are null', () => {
  assert.equal(readAuthParams('alphaCode=alpha-xyz').code, 'ALPHA-XYZ');
  assert.deepEqual(readAuthParams('?code=&email=%20'), { code: null, email: null, invite: null, next: null });
});

test('Auth flow: next only accepts allowlisted keys (no open redirect)', () => {
  assert.equal(readAuthParams('?next=start').next, 'start');
  assert.equal(readAuthParams('?next=join').next, 'join');
  for (const bad of ['https://evil.example', '//evil.example', '/northpole', 'toString', '__proto__', 'constructor']) {
    assert.equal(readAuthParams(`?next=${encodeURIComponent(bad)}`).next, null, bad);
  }
  assert.equal(afterAuthPath('start'), '/dashboard?start=1');
  assert.equal(afterAuthPath(null), '/dashboard');
});

test('Auth flow: mission codes format as XXXX-XXXX and open the mission page when complete', () => {
  assert.equal(formatMissionCode('ab12'), 'AB12');
  assert.equal(formatMissionCode(' ab12 cd34 99'), 'AB12-CD34');
  assert.equal(missionCodePath('ab12-cd3'), null);
  assert.equal(missionCodePath('ab12cd34'), '/exchange/AB12-CD34');
  assert.equal(missionCodePath('../../x'), null);
});
