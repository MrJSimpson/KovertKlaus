import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateDrawFeasibility, MIN_PARTICIPANTS, type ExclusionRuleInput, type FieldAgent } from './draw';
import { FEATURE_FACTS } from './features';
import { PURGE_AFTER_MS } from './mission-cancel';
import { calculateAutomaticOperationDates } from './validations/operation';
import { initializePartyGame } from './whiteElephant';
import { GUIDE_FACTS, GUIDES, GUIDES_INDEX, guideBySlug } from './guides';
import { SITEMAP_PATHS } from './seo';

const agents = (names: string[]): FieldAgent[] => names.map((n) => ({ id: n, name: n, hasWishlistAttached: true }));
const block = (pairs: [string, string][]): ExclusionRuleInput[] => pairs.map(([a, b]) => ({ agentId: a, restrictedAgentId: b }));
const feasible = (names: string[], pairs: [string, string][]) => evaluateDrawFeasibility(agents(names), block(pairs)).isFeasible;

test('Guides - every guide and the index are in the sitemap, with unique addresses', () => {
  const paths = [GUIDES_INDEX.path, ...GUIDES.map((g) => g.path)];
  for (const p of paths) assert.ok((SITEMAP_PATHS as readonly string[]).includes(p), p);
  assert.strictEqual(new Set(paths).size, paths.length);
  for (const g of GUIDES) {
    assert.strictEqual(g.path, `/guides/${g.slug}`);
    assert.strictEqual(guideBySlug(g.slug), g);
  }
  assert.strictEqual(guideBySlug('nope'), undefined);
});

test('Guides - search text fits search results and every guide ends with a start link', () => {
  for (const g of [...GUIDES, GUIDES_INDEX]) {
    assert.ok(g.description.length >= 70 && g.description.length <= 170, `${g.path}: description is ${g.description.length} chars`);
    assert.ok(g.searchTitle.endsWith('| KovertKlaus'), g.path);
  }
  for (const g of GUIDES) assert.match(g.cta.href, /^\/register\?next=start$/, g.path);
});

test('Guides - the steal freeze matches the White Elephant engine default', () => {
  const game = initializePartyGame([{ userId: 'a', name: 'A' }, { userId: 'b', name: 'B' }, { userId: 'c', name: 'C' }]);
  assert.strictEqual(game.maxSwapsPerGift, GUIDE_FACTS.freezeAfterSteals);
});

test('Guides - the exclusion examples give the answers the guide states', () => {
  // Three couples, each blocked: works.
  assert.ok(feasible(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'], [['a1', 'a2'], ['b1', 'b2'], ['c1', 'c2']]));
  // Two couples, each blocked: works (everyone keeps exactly two options).
  assert.ok(feasible(['a1', 'a2', 'b1', 'b2'], [['a1', 'a2'], ['b1', 'b2']]));
  // A family of four plus a friend, every family pair blocked: refused.
  const family = ['f1', 'f2', 'f3', 'f4'];
  const pairs: [string, string][] = [];
  for (let i = 0; i < family.length; i++) for (let j = i + 1; j < family.length; j++) pairs.push([family[i], family[j]]);
  assert.ok(!feasible([...family, 'friend'], pairs));
});

test('Guides - the partner minimum the guide states is the one the draw enforces', () => {
  // Five agents; blocking three of a's four partners leaves a with one option: refused.
  const names = ['a', 'b', 'c', 'd', 'e'];
  assert.ok(!feasible(names, [['a', 'b'], ['a', 'c'], ['a', 'd']]));
  // Blocking two leaves exactly the stated minimum: allowed.
  assert.strictEqual(GUIDE_FACTS.minAllowedPartners, 2);
  assert.ok(feasible(names, [['a', 'b'], ['a', 'c']]));
});

test('Guides - the mission walkthrough states the app’s numbers', () => {
  assert.strictEqual(GUIDE_FACTS.minReadyAgents, MIN_PARTICIPANTS);
  assert.deepStrictEqual([...GUIDE_FACTS.carriers], [...FEATURE_FACTS.carriers]);
  assert.strictEqual(GUIDE_FACTS.cancelledPurgeDays * 24 * 60 * 60 * 1000, PURGE_AFTER_MS);
  const text = JSON.stringify(guideBySlug('how-a-mission-runs'));
  assert.ok(text.includes('at least four agents'));
  assert.ok(text.includes(GUIDE_FACTS.carriers.slice(0, -1).join(', ') + ' or ' + GUIDE_FACTS.carriers.at(-1)));
  assert.ok(text.includes(`after ${GUIDE_FACTS.cancelledPurgeDays} days`));
  assert.ok(text.includes(`at least ${GUIDE_FACTS.minDaysBetweenStages} days between stages`));
});

test('Guides - starting four weeks out gives at least 7 days between stages, sooner gives less', () => {
  const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  const gaps = (weeksOut: number) => {
    const exec = new Date(Date.now() + weeksOut * 7 * 86_400_000);
    const d = calculateAutomaticOperationDates(exec);
    const today = new Date().toISOString().split('T')[0];
    return [days(today, d.inviteCutoffDate), days(d.inviteCutoffDate, d.assignmentDate), days(d.assignmentDate, d.shippingDate), days(d.shippingDate, d.executionDate)];
  };
  assert.ok(gaps(GUIDE_FACTS.minLeadWeeks).every((g) => g >= GUIDE_FACTS.minDaysBetweenStages - 1), String(gaps(GUIDE_FACTS.minLeadWeeks)));
  assert.ok(gaps(GUIDE_FACTS.minLeadWeeks + 1).every((g) => g >= GUIDE_FACTS.minDaysBetweenStages));
  assert.ok(gaps(GUIDE_FACTS.minLeadWeeks - 1).some((g) => g < GUIDE_FACTS.minDaysBetweenStages));
});

test('Guides - the self-hosting steps match the repository', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
  for (const script of ['db:password', 'demo:load', 'demo:remove']) assert.ok(pkg.scripts[script], script);
  const compose = readFileSync(join(process.cwd(), 'docker-compose.yml'), 'utf8');
  assert.match(compose, /container_name:\s*kovertklaus-app/);
  assert.match(compose, /2425/);
});
