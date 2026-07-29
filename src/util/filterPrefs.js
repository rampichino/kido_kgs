// @flow
// Persists game-list view preferences (per-tab filter + sort, and the shared
// filter-row collapsed flag) to localStorage so they survive reloads and
// logins. Kept out of the IndexedDB app-state snapshot (AppStore) so the values
// are available synchronously at component init, matching the other kido_*
// preferences.

const STORAGE_KEY = "kido_game_view_prefs";

export type FilterScope = "watch" | "play" | "mygames";

type ScopePrefs = {
  filter?: Object,
  sort?: string,
};

type GameViewPrefs = {
  watch?: ScopePrefs,
  play?: ScopePrefs,
  mygames?: ScopePrefs,
  collapsed?: boolean,
};

function read(): GameViewPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch (e) {
    // corrupt or unavailable storage — fall through to defaults
  }
  return {};
}

function write(prefs: GameViewPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    // private mode / quota — preferences just won't persist this session
  }
}

export function loadFilter(scope: FilterScope): Object {
  const scoped = read()[scope];
  return scoped && typeof scoped.filter === "object" ? scoped.filter : {};
}

export function saveFilter(scope: FilterScope, filter: Object) {
  const prefs = read();
  prefs[scope] = { ...prefs[scope], filter };
  write(prefs);
}

export function loadSort(scope: FilterScope, fallback: string): string {
  const scoped = read()[scope];
  return scoped && typeof scoped.sort === "string" ? scoped.sort : fallback;
}

export function saveSort(scope: FilterScope, sort: string) {
  const prefs = read();
  prefs[scope] = { ...prefs[scope], sort };
  write(prefs);
}

export function loadCollapsed(defaultCollapsed: boolean = false): boolean {
  const c = read().collapsed;
  return typeof c === "boolean" ? c : defaultCollapsed;
}

export function saveCollapsed(collapsed: boolean) {
  const prefs = read();
  prefs.collapsed = collapsed;
  write(prefs);
}
