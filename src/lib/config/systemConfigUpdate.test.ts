import test from 'node:test';
import assert from 'node:assert';
import { buildSystemConfigUpdate } from './systemConfigUpdate';

test('SystemConfig Update - copies allowlisted fields with type coercion', () => {
  const data = buildSystemConfigUpdate(
    { activeThemeId: 'winter_holiday', maintenanceMode: 1, defaultBudgetMax: '50', smtpPort: '465' },
    'admin_1'
  );
  assert.deepStrictEqual(data, {
    updatedByAdminId: 'admin_1',
    activeThemeId: 'winter_holiday',
    maintenanceMode: true,
    defaultBudgetMax: 50,
    smtpPort: 465,
  });
});

test('SystemConfig Update - drops fields outside the allowlist', () => {
  const data = buildSystemConfigUpdate({ id: 'other', appMode: 'selfhosted', updatedAt: 'x', bogus: true }, 'admin_1');
  assert.deepStrictEqual(data, { updatedByAdminId: 'admin_1' });
});

test('SystemConfig Update - rejects non-numeric numbers and clamps cron interval', () => {
  const data = buildSystemConfigUpdate({ maxWishlistItems: 'abc', lifecycleCronIntervalMinutes: 0 }, 'admin_1');
  assert.deepStrictEqual(data, { updatedByAdminId: 'admin_1', lifecycleCronIntervalMinutes: 1 });
});
