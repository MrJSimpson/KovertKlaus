import test from 'node:test';
import assert from 'node:assert/strict';
import { getThemeClasses } from './theme';

test('Theme Design Token System Test Suite', async (t) => {
  await t.test('getThemeClasses resolves complete token dictionary for Dark Mode (Kovert ❄️)', () => {
    const tokens = getThemeClasses(true);
    assert.ok(tokens.pageBg.includes('bg-kk-page'));
    assert.ok(tokens.btnPrimary.includes('bg-kk-primary'));
    assert.ok(tokens.consoleCard.includes('border-kk-border-strong'));
    assert.ok(tokens.badgeCountdownToday.includes('animate-pulse'));
    assert.ok(tokens.badgeSecretSanta.includes('bg-kk-success'));
    assert.ok(tokens.badgeWhiteElephant.includes('bg-kk-gold'));
  });

  await t.test('getThemeClasses resolves complete token dictionary for Light Mode (Klaus 🎄)', () => {
    const tokens = getThemeClasses(false);
    assert.ok(tokens.pageBg.includes('bg-kk-page'));
    assert.ok(tokens.btnPrimary.includes('bg-kk-primary'));
    assert.ok(tokens.headerBg.includes('bg-kk-header'));
    assert.ok(tokens.badgeCountdownToday.includes('bg-kk-success'));
    assert.ok(tokens.badgeSecretSanta.includes('bg-kk-success'));
    assert.ok(tokens.badgeWhiteElephant.includes('bg-kk-gold'));
  });

  await t.test('getThemeClasses correctly applies database-persisted preset token overrides', () => {
    const customOverride = {
      btnPrimary: 'bg-custom-gold text-black shadow-gold',
      pageBg: 'bg-holiday-pine text-white',
    };
    const tokens = getThemeClasses(false, customOverride);
    assert.equal(tokens.btnPrimary, 'bg-custom-gold text-black shadow-gold');
    assert.equal(tokens.pageBg, 'bg-holiday-pine text-white');
    // Non-overridden tokens remain base
    assert.ok(tokens.headerBg.includes('bg-kk-header'));
  });

  await t.test('Every color class in the base tokens comes from the kk-* palette (no stray Tailwind hues)', () => {
    const stray = /(?:bg|text|border|ring|from|via|to)-(?:slate|stone|gray|zinc|neutral|red|rose|emerald|green|sky|blue|cyan|amber|yellow|orange|purple|indigo|teal)-d/;
    for (const mode of [true, false]) {
      for (const [key, value] of Object.entries(getThemeClasses(mode))) {
        assert.ok(!stray.test(value), `${mode ? 'Dark' : 'Light'} token ${key} uses a non-palette color: ${value}`);
      }
    }
  });

  await t.test('All expected token keys exist in both Light and Dark modes with zero undefined values', () => {
    const darkTokens = getThemeClasses(true) as Record<string, string>;
    const lightTokens = getThemeClasses(false) as Record<string, string>;

    const requiredKeys = [
      'pageBg', 'headerBg', 'footerBg', 'sectionFrame', 'cardBg', 'cardInnerBg',
      'modalBg', 'consoleCard', 'consoleHeading', 'consoleText', 'consoleBadge',
      'btnPrimary', 'btnSecondary', 'btnToggle', 'btnNeutral', 'btnEmerald',
      'btnAmber', 'btnSky', 'btnPurple', 'inputBg', 'inputModalBg', 'inputDisabled',
      'tabBarBg', 'tabActive', 'tabInactive', 'badgeCode', 'badgeSecretSanta',
      'badgeWhiteElephant', 'badgeAmber', 'badgeRose', 'badgeCountdown',
      'badgeCountdownUrgent', 'badgeCountdownToday', 'alertError', 'alertWarning',
      'alertSuccess', 'headerNav', 'heroSubtext', 'heroGradient', 'textAccent',
      'textBrand', 'textGoldOnDark', 'textHeading', 'textLabel', 'textSubLabel',
      'textMuted', 'textDate',
    ];

    for (const key of requiredKeys) {
      assert.ok(darkTokens[key], `Dark token missing key: ${key}`);
      assert.ok(lightTokens[key], `Light token missing key: ${key}`);
      assert.equal(typeof darkTokens[key], 'string');
      assert.equal(typeof lightTokens[key], 'string');
    }
  });
});
