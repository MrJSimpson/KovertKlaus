import test from 'node:test';
import assert from 'node:assert';
import { validateReportInput } from './report';

test('Report Validator - accepts text, web photos and inline images', () => {
  assert.strictEqual(validateReportInput('Thank you!', undefined), null);
  assert.strictEqual(validateReportInput('', 'https://example.com/a.jpg'), null);
  assert.strictEqual(validateReportInput('', 'data:image/webp;base64,AAAA'), null);
});

test('Report Validator - rejects empty entries and unsafe photo schemes', () => {
  assert.ok(validateReportInput('  ', ''));
  assert.ok(validateReportInput('hi', 'javascript:alert(1)'));
  assert.ok(validateReportInput('hi', 'data:text/html;base64,AAAA'));
  assert.ok(validateReportInput('x'.repeat(2001), undefined));
});
