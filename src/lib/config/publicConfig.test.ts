import test from 'node:test';
import assert from 'node:assert';
import { DEFAULT_PUBLIC_CONFIG, toPublicConfig } from './publicConfig';
import { resolveHomeVariant } from './homeVariant';

const fullConfigRow = {
  id: 'singleton',
  activeThemeId: 'spooky_autumn',
  activeSeason: 'auto',
  announcementBannerActive: false,
  altHome: ' Coming_Soon ',
  freeAnnualHostAllowance: 2,
  freeAnnualJoinAllowance: 4,
  paidEventPriceUsd: '7.50',
  maxFreeParticipants: 30,
  maxWishlistItems: 40,
  defaultBudgetMin: '10.00',
  defaultBudgetMax: '75.00',
  defaultCurrency: 'USD',
  // Secrets stored on the same row: must never appear in the public response.
  smtpPass: 'smtp-secret',
  smtpUser: 'mailer',
  brevoApiKey: 'brevo-secret',
  resendApiKey: 'resend-secret',
  updatedByAdminId: 'admin-1',
};

const theme = {
  name: 'Spooky Autumn',
  season: 'autumn',
  bannerTextLight: 'Boo',
  bannerTextDark: 'BOO',
  lightsStrandType: 'pumpkins',
  lightTokens: { accentColor: '#f97316' },
  darkTokens: { accentColor: '#a855f7' },
};

test('Public Config - never exposes secret or internal SystemConfig fields', () => {
  const out = toPublicConfig(fullConfigRow, theme, 'saas');
  const json = JSON.stringify(out);
  for (const secret of ['smtp-secret', 'brevo-secret', 'resend-secret', 'mailer', 'admin-1']) {
    assert.ok(!json.includes(secret), `public config leaked ${secret}`);
  }
  for (const key of ['smtpPass', 'smtpUser', 'brevoApiKey', 'resendApiKey', 'updatedByAdminId', 'id']) {
    assert.ok(!(key in out), `public config exposed key ${key}`);
  }
});

test('Public Config - reflects live settings and resolves auto season from the theme', () => {
  const out = toPublicConfig(fullConfigRow, theme, 'saas');
  assert.strictEqual(out.activeThemeId, 'spooky_autumn');
  assert.strictEqual(out.activeSeason, 'autumn');
  assert.strictEqual(out.announcementBannerActive, false);
  assert.strictEqual(out.bannerTextLight, 'Boo');
  assert.strictEqual(out.lightsStrandType, 'pumpkins');
  assert.strictEqual(out.altHome, 'coming_soon');
  assert.strictEqual(out.paidEventPriceUsd, 7.5);
  assert.strictEqual(out.defaultBudgetMax, 75);
  assert.strictEqual(out.edition, 'saas');
});

test('Public Config - defaults when the database is empty or unreachable', () => {
  const out = toPublicConfig(null, null, 'selfhosted');
  assert.deepStrictEqual(out, { ...DEFAULT_PUBLIC_CONFIG, edition: 'selfhosted' });
});

test('Home Variant - aliases, edition defaults, and unknown values', () => {
  assert.strictEqual(resolveHomeVariant('coming-soon', false), 'coming_soon');
  assert.strictEqual(resolveHomeVariant('APPHOME', true), 'app_home');
  assert.strictEqual(resolveHomeVariant('', true), 'coming_soon');
  assert.strictEqual(resolveHomeVariant(null, false), 'app_home');
  assert.strictEqual(resolveHomeVariant('nonsense', true), 'coming_soon');
});
