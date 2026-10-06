import Database from "better-sqlite3";
import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import { userProfilesMigration } from "@/database/migrations/user-profiles";

import {
  bookmarks,
  history,
  profiles,
  recentlyClosed,
  settings,
  tabGroupMembers,
  tabGroups,
  tabs,
  windows,
  downloads,
  archivedTabs,
} from "@/database/schema";

import {
  defaultBrowserPreferences,
  type BrowserPreferences,
  type BrowserSnapshot,
  type PersistedTab,
  type PersistedTabGroup,
  type PersistedWindowState,
} from "@/lib/browser/persistence";
import { parseInternalPage } from "@/lib/browser/internal-pages";
import type {
  DownloadRecord,
  DownloadPreferences,
} from "@/lib/browser/downloads";

const PROFILE_ID = "default";
const WINDOW_ID = "main";
const sharedBaselines = new Map<
  string,
  Pick<BrowserSnapshot, "bookmarks" | "history">
>();
export function readShortcutOverrides(): Record<string, string> {
  const row = getDatabase()
    .database.select()
    .from(settings)
    .where(
      and(eq(settings.profileId, PROFILE_ID), eq(settings.key, "shortcuts")),
    )
    .get();
  return parseJson<Record<string, string>>(row?.value, {});
}
export function writeShortcutOverrides(value: Record<string, string>) {
  getDatabase()
    .database.insert(settings)
    .values({
      profileId: PROFILE_ID,
      key: "shortcuts",
      value: JSON.stringify(value),
    })
    .onConflictDoUpdate({
      target: [settings.profileId, settings.key],
      set: { value: JSON.stringify(value) },
    })
    .run();
}
let sqlite: Database.Database | null = null;
let database: ReturnType<typeof drizzle> | null = null;

function initializeDatabase(userDataPath: string) {
  sqlite = new Database(path.join(userDataPath, "gorth-browser.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(userProfilesMigration);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (profile_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(profile_id, key));
    CREATE TABLE IF NOT EXISTS tabs (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, position INTEGER NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, favicon_url TEXT NOT NULL, is_muted INTEGER NOT NULL, is_pinned INTEGER NOT NULL, internal_page TEXT, is_active INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tab_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT 'Tab group', profile_id TEXT NOT NULL, mode TEXT NOT NULL, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tab_group_members (group_id TEXT NOT NULL, tab_id TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY(group_id, tab_id));
    CREATE TABLE IF NOT EXISTS bookmarks (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, tab_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, visited_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS history_visited_at_idx ON history(visited_at DESC);
    CREATE TABLE IF NOT EXISTS recently_closed (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, tab_json TEXT NOT NULL, closed_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS recently_closed_at_idx ON recently_closed(closed_at DESC);
    CREATE TABLE IF NOT EXISTS windows (id TEXT PRIMARY KEY, x INTEGER, y INTEGER, width INTEGER NOT NULL, height INTEGER NOT NULL, is_maximized INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS downloads (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, filename TEXT NOT NULL, url TEXT NOT NULL, save_path TEXT NOT NULL, mime_type TEXT NOT NULL, received_bytes INTEGER NOT NULL, total_bytes INTEGER NOT NULL, state TEXT NOT NULL, started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS downloads_started_at_idx ON downloads(started_at DESC);
  `);
  const groupColumns = sqlite
    .prepare("PRAGMA table_info(tab_groups)")
    .all() as { name: string }[];
  if (!groupColumns.some((column) => column.name === "name")) {
    sqlite.exec(
      "ALTER TABLE tab_groups ADD COLUMN name TEXT NOT NULL DEFAULT 'Tab group'",
    );
  }
  for (const [table, column, definition] of [
    ["tabs", "window_id", "TEXT NOT NULL DEFAULT 'main'"],
    ["tabs", "lifecycle", "TEXT NOT NULL DEFAULT '{}'"],
    ["tab_groups", "window_id", "TEXT NOT NULL DEFAULT 'main'"],
    ["recently_closed", "window_id", "TEXT NOT NULL DEFAULT 'main'"],
    ["windows", "is_open", "INTEGER NOT NULL DEFAULT 1"],
  ]) {
    const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
    }[];
    if (!columns.some((item) => item.name === column))
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS archived_tabs (id TEXT PRIMARY KEY, window_id TEXT NOT NULL, tab_json TEXT NOT NULL, archived_at INTEGER NOT NULL)",
  );
  database = drizzle({ client: sqlite });
  // DownloadItems cannot survive an application restart. Retain their history for retry.
  sqlite
    .prepare(
      "UPDATE downloads SET state = 'interrupted' WHERE state IN ('progressing', 'paused')",
    )
    .run();
  database
    .insert(profiles)
    .values({ id: PROFILE_ID, name: "Default", createdAt: Date.now() })
    .onConflictDoNothing()
    .run();
}

function getDatabase() {
  if (!database || !sqlite)
    throw new Error("Browser database is not initialized.");
  return { database, sqlite };
}

export function getRestoredWindowIds() {
  const ids = getDatabase()
    .database.select({ id: windows.id })
    .from(windows)
    .where(eq(windows.isOpen, true))
    .all()
    .map((row) => row.id);
  return ids.length ? ids : [WINDOW_ID];
}

export function setWindowOpen(windowId: string, isOpen: boolean) {
  getDatabase()
    .database.update(windows)
    .set({ isOpen })
    .where(eq(windows.id, windowId))
    .run();
}

export function readBrowserSetting<Value>(key: string, fallback: Value): Value {
  const row = getDatabase()
    .database.select()
    .from(settings)
    .where(and(eq(settings.profileId, PROFILE_ID), eq(settings.key, key)))
    .get();
  return parseJson<Value>(row?.value, fallback);
}

export function writeBrowserSetting(key: string, value: unknown) {
  getDatabase()
    .database.insert(settings)
    .values({ profileId: PROFILE_ID, key, value: JSON.stringify(value) })
    .onConflictDoUpdate({
      target: [settings.profileId, settings.key],
      set: { value: JSON.stringify(value) },
    })
    .run();
}

export function listArchivedTabs() {
  return getDatabase()
    .database.select()
    .from(archivedTabs)
    .orderBy(desc(archivedTabs.archivedAt))
    .all()
    .map((row) => ({
      id: row.id,
      windowId: row.windowId,
      archivedAt: row.archivedAt,
      tab: parseJson<PersistedTab>(row.tabJson, {} as PersistedTab),
    }));
}

export function archiveTab(tab: PersistedTab, windowId: string) {
  const { database, sqlite } = getDatabase();
  sqlite.transaction(() => {
    removeTabFromGroups(tab.id, windowId);
    database
      .insert(archivedTabs)
      .values({
        id: tab.id,
        windowId,
        tabJson: JSON.stringify(tab),
        archivedAt: Date.now(),
      })
      .onConflictDoNothing()
      .run();
    database
      .delete(tabs)
      .where(and(eq(tabs.id, tab.id), eq(tabs.windowId, windowId)))
      .run();
  })();
}

export function takeArchivedTab(id: string, removeOnly = false) {
  const { database, sqlite } = getDatabase();
  return sqlite.transaction(() => {
    const row = database
      .select()
      .from(archivedTabs)
      .where(eq(archivedTabs.id, id))
      .get();
    if (!row) return null;
    database.delete(archivedTabs).where(eq(archivedTabs.id, id)).run();
    return removeOnly
      ? null
      : parseJson<PersistedTab | null>(row.tabJson, null);
  })();
}

export function restoreArchivedTab(id: string, windowId: string) {
  const { database, sqlite } = getDatabase();
  return sqlite.transaction(() => {
    const archived = takeArchivedTab(id);
    if (!archived) return null;
    const tab: PersistedTab = {
      ...archived,
      id: crypto.randomUUID(),
      isSleeping: false,
      lastActiveAt: Date.now(),
    };
    database
      .insert(tabs)
      .values({
        id: tab.id,
        windowId,
        profileId: PROFILE_ID,
        position: database
          .select()
          .from(tabs)
          .where(eq(tabs.windowId, windowId))
          .all().length,
        title: tab.title,
        url: tab.url,
        faviconUrl: tab.faviconUrl,
        isMuted: tab.isMuted,
        isPinned: tab.isPinned,
        internalPage: tab.internalPage,
        isActive: false,
        lifecycle: JSON.stringify({
          navigation: tab.navigation,
          lastActiveAt: tab.lastActiveAt,
          isSleeping: false,
        }),
      })
      .run();
    return tab;
  })();
}

function parseJson<Value>(value: string | undefined, fallback: Value): Value {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as Value;
  } catch {
    return fallback;
  }
}

function loadBrowserSnapshot(windowId = WINDOW_ID): BrowserSnapshot {
  const { database } = getDatabase();
  const savedSettings = Object.fromEntries(
    database
      .select()
      .from(settings)
      .where(eq(settings.profileId, PROFILE_ID))
      .all()
      .map((row) => [row.key, row.value]),
  );
  const preferences: BrowserPreferences = {
    ...defaultBrowserPreferences,
    ...parseJson<Partial<BrowserPreferences>>(
      savedSettings[`preferences:${windowId}`] ?? savedSettings.preferences,
      {},
    ),
    flags: {
      ...defaultBrowserPreferences.flags,
      ...parseJson<Partial<BrowserPreferences>>(
        savedSettings[`preferences:${windowId}`] ?? savedSettings.preferences,
        {},
      ).flags,
    },
  };
  preferences.flags.smoothScrolling = readBrowserSetting(
    "smoothScrolling",
    preferences.flags.smoothScrolling,
  );
  const savedTabs = database
    .select()
    .from(tabs)
    .where(and(eq(tabs.profileId, PROFILE_ID), eq(tabs.windowId, windowId)))
    .orderBy(asc(tabs.position))
    .all();
  const splitGroup = database
    .select()
    .from(tabGroups)
    .where(
      and(
        eq(tabGroups.profileId, PROFILE_ID),
        eq(tabGroups.windowId, windowId),
        eq(tabGroups.mode, "split"),
      ),
    )
    .get();
  const splitMembers = splitGroup
    ? database
        .select()
        .from(tabGroupMembers)
        .where(eq(tabGroupMembers.groupId, splitGroup.id))
        .orderBy(asc(tabGroupMembers.position))
        .all()
    : [];
  const snapshot: BrowserSnapshot = {
    activeTabId:
      savedTabs.find((tab) => tab.isActive)?.id ?? savedTabs[0]?.id ?? null,
    splitTabId: parseJson<string | null>(
      savedSettings[`splitTabId:${windowId}`] ??
        (windowId === WINDOW_ID ? savedSettings.splitTabId : undefined),
      splitMembers[1]?.tabId ?? null,
    ),
    groups: loadTabGroups(windowId),
    tabs: savedTabs.map((tab) => ({
      ...parseJson<
        Pick<PersistedTab, "isSleeping" | "lastActiveAt" | "navigation">
      >(tab.lifecycle, {}),
      id: tab.id,
      title: tab.title,
      url: tab.url,
      faviconUrl: tab.faviconUrl,
      isMuted: tab.isMuted,
      isPinned: tab.isPinned,
      internalPage: tab.internalPage
        ? parseInternalPage(`gorth://${tab.internalPage}`)
        : null,
    })),
    bookmarks: database
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.profileId, PROFILE_ID))
      .orderBy(asc(bookmarks.position))
      .all()
      .map(({ id, title, url }) => ({ id, title, url })),
    history: database
      .select()
      .from(history)
      .where(eq(history.profileId, PROFILE_ID))
      .orderBy(desc(history.visitedAt))
      .limit(2000)
      .all()
      .map(({ id, tabId, title, url, visitedAt }) => ({
        id,
        tabId,
        title,
        url,
        visitedAt,
      })),
    preferences,
  };
  sharedBaselines.set(
    windowId,
    structuredClone({
      bookmarks: snapshot.bookmarks,
      history: snapshot.history,
    }),
  );
  return snapshot;
}

function saveBrowserSnapshot(snapshot: BrowserSnapshot, windowId = WINDOW_ID) {
  const { database, sqlite } = getDatabase();
  sqlite.transaction(() => {
    database
      .delete(tabs)
      .where(and(eq(tabs.profileId, PROFILE_ID), eq(tabs.windowId, windowId)))
      .run();
    // Apply only this window's changes to shared data. A stale window snapshot
    // must never delete or overwrite another window's newly added entries.
    const baseline = sharedBaselines.get(windowId) ?? {
      bookmarks: [],
      history: [],
    };
    for (const row of baseline.bookmarks) {
      if (!snapshot.bookmarks.some((item) => item.id === row.id))
        database.delete(bookmarks).where(eq(bookmarks.id, row.id)).run();
    }
    for (const row of baseline.history) {
      if (!snapshot.history.some((item) => item.id === row.id))
        database.delete(history).where(eq(history.id, row.id)).run();
    }
    database
      .insert(settings)
      .values({
        profileId: PROFILE_ID,
        key: `preferences:${windowId}`,
        value: JSON.stringify(snapshot.preferences),
      })
      .onConflictDoUpdate({
        target: [settings.profileId, settings.key],
        set: { value: JSON.stringify(snapshot.preferences) },
      })
      .run();
    database
      .insert(settings)
      .values({
        profileId: PROFILE_ID,
        key: `splitTabId:${windowId}`,
        value: JSON.stringify(snapshot.splitTabId),
      })
      .onConflictDoUpdate({
        target: [settings.profileId, settings.key],
        set: { value: JSON.stringify(snapshot.splitTabId) },
      })
      .run();
    const openTabs = snapshot.tabs.filter(
      (tab) =>
        !database
          .select({ id: archivedTabs.id })
          .from(archivedTabs)
          .where(eq(archivedTabs.id, tab.id))
          .get(),
    );
    if (openTabs.length)
      database
        .insert(tabs)
        .values(
          openTabs.map((tab, position) => ({
            ...tab,
            windowId,
            lifecycle: JSON.stringify({
              isSleeping: tab.isSleeping,
              lastActiveAt: tab.lastActiveAt,
              navigation: tab.navigation,
            }),
            profileId: PROFILE_ID,
            position,
            internalPage: tab.internalPage,
            isActive: tab.id === snapshot.activeTabId,
          })),
        )
        .run();
    snapshot.bookmarks.forEach((item, position) => {
      if (
        JSON.stringify(baseline.bookmarks.find((row) => row.id === item.id)) ===
        JSON.stringify(item)
      )
        return;
      database
        .insert(bookmarks)
        .values({ ...item, profileId: PROFILE_ID, position })
        .onConflictDoUpdate({
          target: bookmarks.id,
          set: { ...item, position },
        })
        .run();
    });
    snapshot.history.slice(0, 2000).forEach((item) => {
      if (
        JSON.stringify(baseline.history.find((row) => row.id === item.id)) ===
        JSON.stringify(item)
      )
        return;
      database
        .insert(history)
        .values({ ...item, profileId: PROFILE_ID })
        .onConflictDoUpdate({ target: history.id, set: item })
        .run();
    });
  })();
  sharedBaselines.set(
    windowId,
    structuredClone({
      bookmarks: snapshot.bookmarks,
      history: snapshot.history,
    }),
  );
}

function loadTabGroups(windowId = WINDOW_ID): PersistedTabGroup[] {
  const { database } = getDatabase();
  return database
    .select()
    .from(tabGroups)
    .where(
      and(
        eq(tabGroups.profileId, PROFILE_ID),
        eq(tabGroups.windowId, windowId),
      ),
    )
    .orderBy(asc(tabGroups.position))
    .all()
    .map((group) => ({
      id: group.id,
      name: group.name,
      mode: group.mode as PersistedTabGroup["mode"],
      tabIds: database
        .select()
        .from(tabGroupMembers)
        .where(eq(tabGroupMembers.groupId, group.id))
        .orderBy(asc(tabGroupMembers.position))
        .all()
        .map((member) => member.tabId),
    }));
}

function saveTabGroup(group: PersistedTabGroup, windowId = WINDOW_ID) {
  const { database, sqlite } = getDatabase();
  const owner = database
    .select({ windowId: tabGroups.windowId })
    .from(tabGroups)
    .where(eq(tabGroups.id, group.id))
    .get();
  if (owner && owner.windowId !== windowId)
    throw new Error("This group belongs to another window.");
  const existing = loadTabGroups(windowId);
  const savedTabs = database
    .select()
    .from(tabs)
    .where(and(eq(tabs.profileId, PROFILE_ID), eq(tabs.windowId, windowId)))
    .all();
  if (group.tabIds.some((id) => !savedTabs.some((tab) => tab.id === id))) {
    throw new Error("One of the selected tabs is no longer open.");
  }
  if (
    group.mode !== "normal" &&
    group.tabIds.some(
      (id) => savedTabs.find((tab) => tab.id === id)?.internalPage !== null,
    )
  ) {
    throw new Error("Split and glance groups require website tabs.");
  }
  if (
    existing.some(
      (item) =>
        item.id !== group.id &&
        item.tabIds.some((id) => group.tabIds.includes(id)),
    )
  ) {
    throw new Error(
      "A tab can only belong to one group. Remove it from its current group first.",
    );
  }
  sqlite.transaction(() => {
    database
      .insert(tabGroups)
      .values({
        id: group.id,
        windowId,
        name: group.name,
        mode: group.mode,
        profileId: PROFILE_ID,
        position:
          existing.findIndex((item) => item.id === group.id) < 0
            ? existing.length
            : existing.findIndex((item) => item.id === group.id),
      })
      .onConflictDoUpdate({
        target: tabGroups.id,
        set: { name: group.name, mode: group.mode },
      })
      .run();
    database
      .delete(tabGroupMembers)
      .where(eq(tabGroupMembers.groupId, group.id))
      .run();
    database
      .insert(tabGroupMembers)
      .values(
        group.tabIds.map((tabId, position) => ({
          groupId: group.id,
          tabId,
          position,
        })),
      )
      .run();
  })();
  return loadTabGroups(windowId);
}

function deleteTabGroup(id: string, windowId = WINDOW_ID) {
  const { database, sqlite } = getDatabase();
  if (!loadTabGroups(windowId).some((group) => group.id === id))
    return loadTabGroups(windowId);
  sqlite.transaction(() => {
    database
      .delete(tabGroupMembers)
      .where(eq(tabGroupMembers.groupId, id))
      .run();
    database
      .delete(tabGroups)
      .where(and(eq(tabGroups.id, id), eq(tabGroups.profileId, PROFILE_ID)))
      .run();
  })();
  return loadTabGroups(windowId);
}

function removeTabFromGroups(tabId: string, windowId = WINDOW_ID) {
  for (const group of loadTabGroups(windowId).filter((item) =>
    item.tabIds.includes(tabId),
  )) {
    const tabIds = group.tabIds.filter((id) => id !== tabId);
    if (!tabIds.length || (group.mode !== "normal" && tabIds.length < 2))
      deleteTabGroup(group.id, windowId);
    else saveTabGroup({ ...group, tabIds }, windowId);
  }
}

function addRecentlyClosedTab(tab: PersistedTab, windowId = WINDOW_ID) {
  removeTabFromGroups(tab.id, windowId);
  const { database } = getDatabase();
  database
    .insert(recentlyClosed)
    .values({
      id: crypto.randomUUID(),
      profileId: PROFILE_ID,
      tabJson: JSON.stringify(tab),
      windowId,
      closedAt: Date.now(),
    })
    .run();
  const overflow = database
    .select({ id: recentlyClosed.id })
    .from(recentlyClosed)
    .where(
      and(
        eq(recentlyClosed.profileId, PROFILE_ID),
        eq(recentlyClosed.windowId, windowId),
      ),
    )
    .orderBy(desc(recentlyClosed.closedAt))
    .all()
    .slice(25);
  for (const row of overflow)
    database.delete(recentlyClosed).where(eq(recentlyClosed.id, row.id)).run();
}

function popRecentlyClosedTab(windowId = WINDOW_ID) {
  const { database } = getDatabase();
  const row = database
    .select()
    .from(recentlyClosed)
    .where(
      and(
        eq(recentlyClosed.profileId, PROFILE_ID),
        eq(recentlyClosed.windowId, windowId),
      ),
    )
    .orderBy(desc(recentlyClosed.closedAt))
    .get();
  if (!row) return null;
  database.delete(recentlyClosed).where(eq(recentlyClosed.id, row.id)).run();
  return parseJson<PersistedTab | null>(row.tabJson, null);
}

function loadWindowState(windowId = WINDOW_ID): PersistedWindowState | null {
  const { database } = getDatabase();
  const row = database
    .select()
    .from(windows)
    .where(eq(windows.id, windowId))
    .get();
  return row
    ? {
        height: row.height,
        isMaximized: row.isMaximized,
        width: row.width,
        x: row.x,
        y: row.y,
      }
    : null;
}

function saveWindowState(state: PersistedWindowState, windowId = WINDOW_ID) {
  const { database } = getDatabase();
  database
    .insert(windows)
    .values({ id: windowId, ...state })
    .onConflictDoUpdate({ target: windows.id, set: state })
    .run();
}

function closeDatabase() {
  sharedBaselines.clear();
  sqlite?.close();
  sqlite = null;
  database = null;
}

function loadDownloads(): DownloadRecord[] {
  return getDatabase()
    .database.select()
    .from(downloads)
    .where(eq(downloads.profileId, PROFILE_ID))
    .orderBy(desc(downloads.startedAt))
    .all();
}

function saveDownload(record: DownloadRecord) {
  getDatabase()
    .database.insert(downloads)
    .values({ ...record, profileId: PROFILE_ID })
    .onConflictDoUpdate({ target: downloads.id, set: record })
    .run();
}

function deleteDownload(id: string) {
  getDatabase()
    .database.delete(downloads)
    .where(and(eq(downloads.id, id), eq(downloads.profileId, PROFILE_ID)))
    .run();
}

function loadDownloadPreferences(directory: string): DownloadPreferences {
  const row = getDatabase()
    .database.select()
    .from(settings)
    .where(
      and(eq(settings.profileId, PROFILE_ID), eq(settings.key, "downloads")),
    )
    .get();
  const saved = parseJson<Partial<DownloadPreferences>>(row?.value, {});
  return {
    directory:
      typeof saved.directory === "string" && saved.directory
        ? saved.directory
        : directory,
    askWhereToSave:
      typeof saved.askWhereToSave === "boolean" ? saved.askWhereToSave : true,
  };
}

function saveDownloadPreferences(value: DownloadPreferences) {
  getDatabase()
    .database.insert(settings)
    .values({
      profileId: PROFILE_ID,
      key: "downloads",
      value: JSON.stringify(value),
    })
    .onConflictDoUpdate({
      target: [settings.profileId, settings.key],
      set: { value: JSON.stringify(value) },
    })
    .run();
}

export {
  loadDownloads,
  saveDownload,
  deleteDownload,
  loadDownloadPreferences,
  saveDownloadPreferences,
  loadTabGroups,
  saveTabGroup,
  deleteTabGroup,
  addRecentlyClosedTab,
  closeDatabase,
  initializeDatabase,
  loadBrowserSnapshot,
  loadWindowState,
  popRecentlyClosedTab,
  saveBrowserSnapshot,
  saveWindowState,
};
