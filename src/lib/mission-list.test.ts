import test from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_HIDE_PREFS,
  filterMissions,
  getHidePrefsSnapshot,
  getServerHidePrefsSnapshot,
  HIDE_PREFS_KEY,
  isHiddenFinished,
  readHidePrefs,
  setHidePrefs,
  subscribeHidePrefs,
  writeHidePrefs,
} from './mission-list';

/** In-memory storage; `broken` makes every call throw like a blocked private window. */
function memoryStorage(broken = false) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => {
      if (broken) throw new Error('SecurityError');
      return data.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error('SecurityError');
      data.set(k, v);
    },
  };
}

test('Mission list - each toggle hides only its own status', () => {
  const both = { hideCompleted: true, hideCancelled: true };
  assert.strictEqual(isHiddenFinished('COMPLETED', both), true);
  assert.strictEqual(isHiddenFinished('CANCELLED', both), true);
  for (const status of ['SETUP', 'RECRUITING', 'MATCHED', 'SHIPPED', 'EXECUTED']) {
    assert.strictEqual(isHiddenFinished(status, both), false, status);
  }
  assert.strictEqual(isHiddenFinished('COMPLETED', { hideCompleted: false, hideCancelled: true }), false);
  assert.strictEqual(isHiddenFinished('CANCELLED', { hideCompleted: true, hideCancelled: false }), false);
  assert.strictEqual(isHiddenFinished('COMPLETED', DEFAULT_HIDE_PREFS), false);
});

test('Mission list - toggles round-trip through storage', () => {
  const s = memoryStorage();
  assert.deepStrictEqual(readHidePrefs(s), DEFAULT_HIDE_PREFS);
  writeHidePrefs({ hideCompleted: true, hideCancelled: false }, s);
  assert.deepStrictEqual(readHidePrefs(s), { hideCompleted: true, hideCancelled: false });
});

test('Mission list - bad or blocked storage falls back to showing everything', () => {
  const s = memoryStorage();
  s.data.set(HIDE_PREFS_KEY, '{not json');
  assert.deepStrictEqual(readHidePrefs(s), DEFAULT_HIDE_PREFS);
  s.data.set(HIDE_PREFS_KEY, JSON.stringify({ hideCompleted: 'yes', hideCancelled: 1 }));
  assert.deepStrictEqual(readHidePrefs(s), DEFAULT_HIDE_PREFS);
  const blocked = memoryStorage(true);
  assert.deepStrictEqual(readHidePrefs(blocked), DEFAULT_HIDE_PREFS);
  assert.doesNotThrow(() => writeHidePrefs({ hideCompleted: true, hideCancelled: true }, blocked));
  assert.deepStrictEqual(readHidePrefs(null), DEFAULT_HIDE_PREFS);
});

test('Mission list - store notifies subscribers and saves the toggles', () => {
  const s = memoryStorage();
  let calls = 0;
  const unsubscribe = subscribeHidePrefs(() => calls++);
  const next = { hideCompleted: false, hideCancelled: true };
  setHidePrefs(next, s);
  assert.strictEqual(calls, 1);
  assert.strictEqual(getHidePrefsSnapshot(), next, 'snapshot is the same object until the next change');
  assert.strictEqual(getHidePrefsSnapshot(), getHidePrefsSnapshot());
  assert.deepStrictEqual(readHidePrefs(s), next);
  assert.deepStrictEqual(getServerHidePrefsSnapshot(), DEFAULT_HIDE_PREFS);
  unsubscribe();
  setHidePrefs(DEFAULT_HIDE_PREFS, s);
  assert.strictEqual(calls, 1);
});

test('Mission list - filters by search, role, status and hide toggles', () => {
  const missions = [
    { id: '1', title: 'Family Secret Santa', code: 'KOVERT-AAAA', status: 'RECRUITING', organizerId: 'me' },
    { id: '2', title: 'Office Swap', code: 'KOVERT-BBBB', status: 'MATCHED', organizerId: 'boss' },
    { id: '3', title: 'Last Year', code: 'KOVERT-CCCC', status: 'COMPLETED', organizerId: 'me' },
    { id: '4', title: 'Failed One', code: 'KOVERT-DDDD', status: 'CANCELLED', organizerId: 'boss' },
  ];
  const ids = (f: Partial<Parameters<typeof filterMissions>[2]>) =>
    filterMissions(missions, 'me', { query: '', role: 'ALL', status: 'ALL', hide: DEFAULT_HIDE_PREFS, ...f }).map((m) => m.id);

  assert.deepStrictEqual(ids({}), ['1', '2', '3', '4'], 'everything by default');
  assert.deepStrictEqual(ids({ query: '  santa ' }), ['1']);
  assert.deepStrictEqual(ids({ query: 'bbbb' }), ['2'], 'search matches the code');
  assert.deepStrictEqual(ids({ role: 'HEAD_ELF' }), ['1', '3']);
  assert.deepStrictEqual(ids({ role: 'ELF_AGENT' }), ['2', '4']);
  assert.deepStrictEqual(ids({ status: 'RECRUITING' }), ['1']);
  assert.deepStrictEqual(ids({ status: 'ASSIGNED' }), ['2']);
  assert.deepStrictEqual(ids({ status: 'COMPLETED' }), ['3']);
  assert.deepStrictEqual(ids({ hide: { hideCompleted: true, hideCancelled: true } }), ['1', '2']);
  assert.deepStrictEqual(ids({ status: 'COMPLETED', hide: { hideCompleted: true, hideCancelled: false } }), [], 'hide wins over the status filter');
});
