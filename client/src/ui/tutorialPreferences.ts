/** Optional UI preference only: never read or written by simulation/save exports. */
const KEY = 'muyun-tutorial-ui-v1';
export interface TutorialPreferences { offered: boolean; completed: boolean }
const defaults = (): TutorialPreferences => ({ offered: false, completed: false });
let storageUnavailableFallback = defaults();
let failedWrite = false;

export function tutorialPreferences(): TutorialPreferences {
  if (failedWrite) return { ...storageUnavailableFallback };
  let raw: string | null;
  try { raw = localStorage.getItem(KEY); }
  catch { return { ...storageUnavailableFallback }; }
  if (!raw) return defaults();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults();
    const value = parsed as Record<string, unknown>;
    return { offered: value.offered === true, completed: value.completed === true };
  } catch {
    return defaults();
  }
}

function remember(value: TutorialPreferences): void {
  storageUnavailableFallback = { ...value };
  try { localStorage.setItem(KEY, JSON.stringify(value)); }
  catch { failedWrite = true; /* Keep preferences for this page session. */ }
}

/** Call only when the invitation can actually be shown to the player. */
export function offerTutorialOnce(): boolean {
  const value = tutorialPreferences();
  if (value.offered || value.completed) return false;
  remember({ ...value, offered: true });
  return true;
}

/** A completed practice never creates or replaces either real game save. */
export function completeTutorial(): void {
  remember({ offered: true, completed: true });
}
