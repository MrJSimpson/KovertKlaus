/**
 * @file mission-list.ts
 * @description The dashboard's mission list: filters and the "hide finished missions" preference.
 *
 * Tier 1 (what): `filterMissions` applies the search box, role, status and hide toggles to the
 * signed-in agent's missions. `isHiddenFinished` says whether a mission is hidden by the Hide
 * Completed / Hide Cancelled toggles; `readHidePrefs` and `writeHidePrefs` keep the toggles in
 * browser storage, and `subscribeHidePrefs` / `getHidePrefsSnapshot` / `setHidePrefs` expose them
 * to `useSyncExternalStore`.
 * Tier 2 (why): The dashboard is the one place agents see their missions (the Operations Center
 * was folded into it on 2026-10-26), so it lists every mission and needs the old page's filters.
 * Completed missions are a permanent record and cancelled ones stay for 90 days
 * (`mission-cancel.ts`), so the list fills with missions that need nothing; agents may hide
 * completed and/or cancelled (failed) ones. That is a per-browser convenience, so it lives in
 * localStorage rather than the account.
 * Tier 3 (how): Pure functions over the `GET /api/operations` list. Storage access is wrapped in
 * try/catch (private windows can throw) and falls back to showing everything. `storage` is
 * injectable for tests.
 */

/** Which finished missions the dashboard hides. */
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

/** A mission as the dashboard lists it (`GET /api/operations`). */
export interface MissionListItem {
  id: string;
  title: string;
  code: string;
  status: string;
  organizerId: string;
}

/** Role filter: every mission, those the agent runs as Head Elf, or those they joined as an Elf Agent. */
export type RoleFilter = 'ALL' | 'HEAD_ELF' | 'ELF_AGENT';

/** Status filter: the dashboard's groups of real `ExchangeStatus` values. */
export type StatusFilter = 'ALL' | 'RECRUITING' | 'ASSIGNED' | 'COMPLETED';

/** Which `ExchangeStatus` values each status filter shows. Recruiting covers setup; Assigned covers drawn missions. */
export const STATUS_FILTER_GROUPS: Record<Exclude<StatusFilter, 'ALL'>, string[]> = {
  RECRUITING: ['RECRUITING', 'SETUP'],
  ASSIGNED: ['MATCHED', 'SHIPPED', 'EXECUTED'],
  COMPLETED: ['COMPLETED'],
};

/** Everything that narrows the list. */
export interface MissionFilters {
  query: string;
  role: RoleFilter;
  status: StatusFilter;
  hide: HidePrefs;
}

/** The missions that pass every filter, in their original order. Search matches title or code. */
export function filterMissions<T extends MissionListItem>(missions: T[], userId: string, filters: MissionFilters): T[] {
  const q = filters.query.trim().toLowerCase();
  return missions.filter((m) => {
    if (q && !m.title.toLowerCase().includes(q) && !m.code.toLowerCase().includes(q)) return false;
    const isHeadElf = m.organizerId === userId;
    if (filters.role === 'HEAD_ELF' && !isHeadElf) return false;
    if (filters.role === 'ELF_AGENT' && isHeadElf) return false;
    if (filters.status !== 'ALL' && !STATUS_FILTER_GROUPS[filters.status].includes(m.status)) return false;
    return !isHiddenFinished(m.status, filters.hide);
  });
}
