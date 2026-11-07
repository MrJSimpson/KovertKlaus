import test from 'node:test';
import assert from 'node:assert';
import { rewriteExchangeShellPath, resolveExchangeCode } from './exchange-route';

test('Exchange Route - mission URLs are served by the prerendered shell', () => {
  assert.strictEqual(rewriteExchangeShellPath('/exchange/KKJA-CM7P'), '/exchange/preview');
  assert.strictEqual(rewriteExchangeShellPath('/exchange/KKJA-CM7P/'), '/exchange/preview/');
  assert.strictEqual(rewriteExchangeShellPath('/exchange/KKJA-CM7P.txt'), '/exchange/preview.txt');
  assert.strictEqual(rewriteExchangeShellPath('/exchange/KKJA-CM7P/__next._tree.txt'), '/exchange/preview/__next._tree.txt');
});

test('Exchange Route - the shell itself and non-mission paths are left alone', () => {
  assert.strictEqual(rewriteExchangeShellPath('/exchange/preview'), null);
  assert.strictEqual(rewriteExchangeShellPath('/exchange/preview.txt'), null);
  assert.strictEqual(rewriteExchangeShellPath('/exchange'), null);
  assert.strictEqual(rewriteExchangeShellPath('/dashboard'), null);
  assert.strictEqual(rewriteExchangeShellPath('/exchange/%3Cscript%3E'), null);
});

test('Exchange Route - the page takes its code from the URL', () => {
  assert.strictEqual(resolveExchangeCode('preview', '/exchange/kkja-cm7p', '/exchange/kkja-cm7p'), 'KKJA-CM7P');
  assert.strictEqual(resolveExchangeCode('preview', null, '/exchange/kkja-cm7p'), 'KKJA-CM7P');
  assert.strictEqual(resolveExchangeCode('kkja-cm7p', null, null), 'KKJA-CM7P');
  assert.strictEqual(resolveExchangeCode(undefined, null, '/somewhere'), '');
});

test('Exchange Route - a click-through from the dashboard loads the new mission, not the shell', () => {
  // Client-side navigation: the router already has the new path, the browser URL does not yet.
  assert.strictEqual(resolveExchangeCode('preview', '/exchange/KKXQ-7TNP', '/dashboard'), 'KKXQ-7TNP');
});

test('Exchange Route - the shell code is never loaded', () => {
  assert.strictEqual(resolveExchangeCode('preview', null, '/dashboard'), '');
  assert.strictEqual(resolveExchangeCode('preview', '/exchange/preview', '/exchange/preview'), '');
  assert.strictEqual(resolveExchangeCode('PREVIEW', null, null), '');
  assert.strictEqual(resolveExchangeCode('preview', '/exchange/%E0%A4%A', null), '');
});
