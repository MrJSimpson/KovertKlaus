import test from 'node:test';
import assert from 'node:assert';
import { DEFAULT_QUOTA_CONFIG, toQuotaConfig, validateEmailQuotaSettings } from './quota-config';

test('Quota setting - validation accepts in-bounds values and names every problem', () => {
  assert.deepStrictEqual(validateEmailQuotaSettings({}), []);
  assert.deepStrictEqual(validateEmailQuotaSettings({ emailQuotaPeriod: 'MONTH', emailQuota: 50000, emailQuotaResetDay: 28, emailDailyCap: 0 }), []);
  const errors = validateEmailQuotaSettings({ emailQuotaPeriod: 'WEEK', emailQuota: 5, emailQuotaResetDay: 31, emailDailyCap: -1 });
  assert.strictEqual(errors.length, 4);
  assert.match(errors.join(' '), /from 10 to 1000000/);
  assert.match(errors.join(' '), /reset day must be a whole number from 1 to 28/i);
  assert.match(errors.join(' '), /DAY, MONTH/);
  assert.strictEqual(validateEmailQuotaSettings({ emailQuota: 300.5 }).length, 1, 'whole numbers only');
});

test('Quota setting - reads defaults when unset and clamps out-of-bounds stored values', () => {
  assert.deepStrictEqual(toQuotaConfig(null), DEFAULT_QUOTA_CONFIG);
  assert.deepStrictEqual(toQuotaConfig({}), DEFAULT_QUOTA_CONFIG);
  assert.deepStrictEqual(toQuotaConfig({ emailQuotaPeriod: 'MONTH', emailQuota: 50000, emailQuotaResetDay: 15, emailDailyCap: 2500 }), {
    period: 'MONTH', quota: 50000, resetDay: 15, dailyCap: 2500,
  });
  assert.deepStrictEqual(toQuotaConfig({ emailQuotaPeriod: 'YEAR', emailQuota: 1, emailQuotaResetDay: 40, emailDailyCap: 'x' }), {
    period: 'DAY', quota: 10, resetDay: 28, dailyCap: 0,
  });
});
