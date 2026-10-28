import test from 'node:test';
import assert from 'node:assert';
import { bodyObject, bodyString, readJsonBody } from './request-body';

const jsonRequest = (body: string) => new Request('https://example.test/api', { method: 'POST', body });

test('readJsonBody - returns a JSON object body unchanged', async () => {
  assert.deepStrictEqual(await readJsonBody(jsonRequest('{"email":"a@b.test","n":1}')), { email: 'a@b.test', n: 1 });
});

test('readJsonBody - invalid JSON, arrays, null and primitives read as {}', async () => {
  for (const raw of ['not json', '', '[1,2]', 'null', '42', '"text"', 'true']) {
    assert.deepStrictEqual(await readJsonBody(jsonRequest(raw)), {}, `body ${JSON.stringify(raw)}`);
  }
});

test('bodyString - keeps strings and empties everything else', () => {
  assert.strictEqual(bodyString('agent'), 'agent');
  assert.strictEqual(bodyString(''), '');
  for (const value of [undefined, null, 123, true, {}, ['a']]) {
    assert.strictEqual(bodyString(value), '');
  }
});

test('bodyObject - keeps plain objects and rejects arrays, null and primitives', () => {
  const obj = { title: 'Mission' };
  assert.strictEqual(bodyObject(obj), obj);
  for (const value of [undefined, null, [], ['a'], 'x', 0, false]) {
    assert.strictEqual(bodyObject(value), null);
  }
});
