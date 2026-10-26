/**
 * @file mission-list-prefs.ts
 * @description The Operations Center's "hide finished missions" preference.
 *
 * Tier 1 (what): `isHiddenFinished` says whether a mission is hidden by the Hide Completed / Hide
 * Cancelled toggles; `readHidePrefs` and `writeHidePrefs` keep the toggles in browser storage, and
 * `subscribeHidePrefs` / `getHidePrefsSnapshot` / `setHidePrefs` expose them to `useSyncExternalStore`.
 * Tier 2 (why): Completed missions are a permanent record and cancelled ones stay for 90 days
 * (`mission-cancel.ts`), so a Head Elf's list fills with missions that need nothing. Owner request
 * (2026-10-26): let agents hide completed and/or cancelled (failed) missions. It is a per-browser
 * convenience, so it lives in localStorage rather than the account.
 * Tier 3 (how): Storage access is wrapped in try/catch (private windows can throw) and falls back
 * to showing everything. `storage` is injectable for tests.
 */

/** Which finished missions the Operations Center hides. */
export interface HidePrefs {
  hideCompleted: boolean;
  hideCancelled: boolean;
}

/** localStorage key for the toggles. */
export const HIDE_PREFS_KEY = 'kovertklaus_hide_finished_missions';

/** Default: show every mission. */
export const DEFAULT_HIDE_PREFS: HidePrefs = { hideCompleted: false, hideCancelled: false };

/** Whether a mission in `status` is hidden by `prefs`. */
export function isHiddenFinished(status: string, prefs: HidePrefs): boolean {
  return (prefs.hideCompleted && status === 'COMPLETED') || (prefs.hideCancelled && status === 'CANCELLED');
}

type PrefStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): PrefStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/** The saved toggles, or the default when unset, unreadable or storage is unavailable. */
export function readHidePrefs(storage: PrefStorage | null = defaultStorage()): HidePrefs {
  try {
    const parsed = JSON.parse(storage?.getItem(HIDE_PREFS_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return DEFAULT_HIDE_PREFS;
    return { hideCompleted: parsed.hideCompleted === true, hideCancelled: parsed.hideCancelled === true };
  } catch {
    return DEFAULT_HIDE_PREFS;
  }
}

/** Saves the toggles; a storage failure only means they are not remembered. */
export function writeHidePrefs(prefs: HidePrefs, storage: PrefStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(HIDE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked or full: the toggles still apply for this visit.
  }
}

// External store for `useSyncExternalStore`: the snapshot is cached so React sees a stable object.
let current: HidePrefs | null = null;
const listeners = new Set<() => void>();

/** Subscribes to toggle changes; returns the unsubscribe function. */
export function subscribeHidePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current toggles (read from storage once, then cached). */
export function getHidePrefsSnapshot(): HidePrefs {
  current ??= readHidePrefs();
  return current;
}

/** The server render shows everything; the client reads storage after hydration. */
export function getServerHidePrefsSnapshot(): HidePrefs {
  return DEFAULT_HIDE_PREFS;
}

/** Changes the toggles, saves them and re-renders subscribers. */
export function setHidePrefs(next: HidePrefs, storage: PrefStorage | null = defaultStorage()): void {
  current = next;
  writeHidePrefs(next, storage);
  listeners.forEach((l) => l());
}
