import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEME_SEASONS } from './season';

/** Parses src/styles/kk-tokens.css into { "<season>-<mode>": { token: "#rrggbb" } }. */
function loadThemes(): Record<string, Record<string, string>> {
  const css = readFileSync(join(process.cwd(), 'src/styles/kk-tokens.css'), 'utf8');
  const themes: Record<string, Record<string, string>> = {};
  for (const m of css.matchAll(/\/\* (\w+) (light|dark) \*\/\n[^{]*\{([^}]*)\}/g)) {
    const tokens: Record<string, string> = {};
    for (const t of m[3].matchAll(/--kk-([\w-]+):\s*([^;]+);/g)) tokens[t[1]] = t[2].trim();
    themes[`${m[1]}-${m[2]}`] = tokens;
  }
  return themes;
}

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = loadThemes();

test('Theme tokens: 4 seasons x 2 modes, each with the same token set', () => {
  const ids = THEME_SEASONS.flatMap((s) => [`${s}-light`, `${s}-dark`]);
  assert.deepEqual(Object.keys(themes).sort(), ids.sort());
  const keys = Object.keys(themes['winter-light']).sort();
  assert.ok(keys.length >= 38, `winter-light has ${keys.length} tokens`);
  for (const id of ids) assert.deepEqual(Object.keys(themes[id]).sort(), keys, `${id} token set differs from winter-light`);
});

/** [foreground, background] pairs that carry text (4.5:1, WCAG AA). Links use accent = primary. */
const TEXT_PAIRS: [string, string][] = [
  ['ink', 'page'], ['ink', 'surface'], ['ink', 'inset'], ['ink', 'tab'],
  ['muted', 'page'], ['muted', 'surface'], ['muted', 'inset'],
  ['heading', 'page'], ['heading', 'surface'],
  ['primary', 'page'], ['primary', 'surface'], ['primary', 'inset'],
  ['primary-hover', 'page'], ['primary-hover', 'surface'],
  ['on-primary', 'primary'], ['on-primary', 'primary-hover'],
  ['on-secondary', 'secondary'], ['on-secondary', 'secondary-hover'],
  ['on-header', 'header'], ['on-gold', 'gold'],
  ['on-success', 'success'], ['on-warning', 'warning'], ['on-danger-soft', 'danger-soft'],
  ['danger', 'surface'], ['stamp', 'surface'], ['stamp', 'page'],
  ['on-stage1', 'stage1'], ['on-stage2', 'stage2'], ['on-stage3', 'stage3'], ['on-stage4', 'stage4'],
];

/** Control borders and focus rings (3:1, WCAG 1.4.11). */
const UI_PAIRS: [string, string][] = [
  ['border-control', 'surface'], ['border-control', 'inset'],
  ['focus', 'page'], ['focus', 'surface'],
];

test('Theme tokens: every text pair meets 4.5:1 and every control border 3:1, in all eight themes', () => {
  const failures: string[] = [];
  for (const [id, t] of Object.entries(themes)) {
    for (const [fg, bg] of TEXT_PAIRS) {
      const r = contrast(t[fg], t[bg]);
      if (r < 4.5) failures.push(`${id}: ${fg} on ${bg} = ${r.toFixed(2)}:1`);
    }
    for (const [fg, bg] of UI_PAIRS) {
      const r = contrast(t[fg], t[bg]);
      if (r < 3) failures.push(`${id}: ${fg} on ${bg} = ${r.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(failures, []);
});
