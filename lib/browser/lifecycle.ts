export interface TabLifecyclePreferences {
  memorySaver: boolean;
  sleepAfterMinutes: number;
  archiveAfterDays: number;
}

export interface ArchiveEntry {
  id: string;
  windowId: string;
  archivedAt: number;
  tab: import("./persistence").PersistedTab;
}

export function shouldSleepTab(input: {
  active: boolean;
  pinned: boolean;
  grouped: boolean;
  internal: boolean;
  busy: boolean;
  lastActiveAt: number;
  now: number;
  preferences: TabLifecyclePreferences;
}) {
  return (
    input.preferences.memorySaver &&
    !input.active &&
    !input.pinned &&
    !input.grouped &&
    !input.internal &&
    !input.busy &&
    input.now - input.lastActiveAt >=
      input.preferences.sleepAfterMinutes * 60_000
  );
}
