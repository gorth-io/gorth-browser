import Database from "better-sqlite3";
import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";

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
} from "@/database/schema";

import {
  defaultBrowserPreferences,
  type BrowserPreferences,
  type BrowserSnapshot,
  type PersistedTab,
  type PersistedWindowState,
} from "@/lib/browser/persistence";
import { parseInternalPage } from "@/lib/browser/internal-pages";

const PROFILE_ID = "default";
const WINDOW_ID = "main";
let sqlite: Database.Database | null = null;
let database: ReturnType<typeof drizzle> | null = null;

function initializeDatabase(userDataPath: string) {
  sqlite = new Database(path.join(userDataPath, "gorth-browser.sqlite"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (profile_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(profile_id, key));
    CREATE TABLE IF NOT EXISTS tabs (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, position INTEGER NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, favicon_url TEXT NOT NULL, is_muted INTEGER NOT NULL, is_pinned INTEGER NOT NULL, internal_page TEXT, is_active INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tab_groups (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, mode TEXT NOT NULL, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tab_group_members (group_id TEXT NOT NULL, tab_id TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY(group_id, tab_id));
    CREATE TABLE IF NOT EXISTS bookmarks (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, tab_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, visited_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS history_visited_at_idx ON history(visited_at DESC);
    CREATE TABLE IF NOT EXISTS recently_closed (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, tab_json TEXT NOT NULL, closed_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS recently_closed_at_idx ON recently_closed(closed_at DESC);
    CREATE TABLE IF NOT EXISTS windows (id TEXT PRIMARY KEY, x INTEGER, y INTEGER, width INTEGER NOT NULL, height INTEGER NOT NULL, is_maximized INTEGER NOT NULL);
  `);
  database = drizzle({ client: sqlite });
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

function parseJson<Value>(value: string | undefined, fallback: Value): Value {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as Value;
  } catch {
    return fallback;
  }
}

function loadBrowserSnapshot(): BrowserSnapshot {
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
    ...parseJson<Partial<BrowserPreferences>>(savedSettings.preferences, {}),
    flags: {
      ...defaultBrowserPreferences.flags,
      ...parseJson<Partial<BrowserPreferences>>(savedSettings.preferences, {})
        .flags,
    },
  };
  const savedTabs = database
    .select()
    .from(tabs)
    .where(eq(tabs.profileId, PROFILE_ID))
    .orderBy(asc(tabs.position))
    .all();
  const splitGroup = database
    .select()
    .from(tabGroups)
    .where(
      and(eq(tabGroups.profileId, PROFILE_ID), eq(tabGroups.mode, "split")),
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
  return {
    activeTabId:
      savedTabs.find((tab) => tab.isActive)?.id ?? savedTabs[0]?.id ?? null,
    splitTabId: splitMembers[1]?.tabId ?? null,
    tabs: savedTabs.map((tab) => ({
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
}

function saveBrowserSnapshot(snapshot: BrowserSnapshot) {
  const { database, sqlite } = getDatabase();
  sqlite.transaction(() => {
    database.delete(tabs).where(eq(tabs.profileId, PROFILE_ID)).run();
    database.delete(tabGroupMembers).run();
    database.delete(tabGroups).where(eq(tabGroups.profileId, PROFILE_ID)).run();
    database.delete(bookmarks).where(eq(bookmarks.profileId, PROFILE_ID)).run();
    database.delete(history).where(eq(history.profileId, PROFILE_ID)).run();
    database
      .insert(settings)
      .values({
        profileId: PROFILE_ID,
        key: "preferences",
        value: JSON.stringify(snapshot.preferences),
      })
      .onConflictDoUpdate({
        target: [settings.profileId, settings.key],
        set: { value: JSON.stringify(snapshot.preferences) },
      })
      .run();
    if (snapshot.tabs.length)
      database
        .insert(tabs)
        .values(
          snapshot.tabs.map((tab, position) => ({
            ...tab,
            profileId: PROFILE_ID,
            position,
            internalPage: tab.internalPage,
            isActive: tab.id === snapshot.activeTabId,
          })),
        )
        .run();
    if (snapshot.bookmarks.length)
      database
        .insert(bookmarks)
        .values(
          snapshot.bookmarks.map((bookmark, position) => ({
            ...bookmark,
            profileId: PROFILE_ID,
            position,
          })),
        )
        .run();
    if (snapshot.history.length)
      database
        .insert(history)
        .values(
          snapshot.history
            .slice(0, 2000)
            .map((item) => ({ ...item, profileId: PROFILE_ID })),
        )
        .run();
    if (
      snapshot.splitTabId &&
      snapshot.activeTabId &&
      snapshot.splitTabId !== snapshot.activeTabId
    ) {
      const groupId = "active-split";
      database
        .insert(tabGroups)
        .values({
          id: groupId,
          profileId: PROFILE_ID,
          mode: "split",
          position: 0,
        })
        .run();
      database
        .insert(tabGroupMembers)
        .values([
          { groupId, tabId: snapshot.activeTabId, position: 0 },
          { groupId, tabId: snapshot.splitTabId, position: 1 },
        ])
        .run();
    }
  })();
}

function addRecentlyClosedTab(tab: PersistedTab) {
  const { database } = getDatabase();
  database
    .insert(recentlyClosed)
    .values({
      id: crypto.randomUUID(),
      profileId: PROFILE_ID,
      tabJson: JSON.stringify(tab),
      closedAt: Date.now(),
    })
    .run();
  const overflow = database
    .select({ id: recentlyClosed.id })
    .from(recentlyClosed)
    .where(eq(recentlyClosed.profileId, PROFILE_ID))
    .orderBy(desc(recentlyClosed.closedAt))
    .all()
    .slice(25);
  for (const row of overflow)
    database.delete(recentlyClosed).where(eq(recentlyClosed.id, row.id)).run();
}

function popRecentlyClosedTab() {
  const { database } = getDatabase();
  const row = database
    .select()
    .from(recentlyClosed)
    .where(eq(recentlyClosed.profileId, PROFILE_ID))
    .orderBy(desc(recentlyClosed.closedAt))
    .get();
  if (!row) return null;
  database.delete(recentlyClosed).where(eq(recentlyClosed.id, row.id)).run();
  return parseJson<PersistedTab | null>(row.tabJson, null);
}

function loadWindowState(): PersistedWindowState | null {
  const { database } = getDatabase();
  const row = database
    .select()
    .from(windows)
    .where(eq(windows.id, WINDOW_ID))
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

function saveWindowState(state: PersistedWindowState) {
  const { database } = getDatabase();
  database
    .insert(windows)
    .values({ id: WINDOW_ID, ...state })
    .onConflictDoUpdate({ target: windows.id, set: state })
    .run();
}

function closeDatabase() {
  sqlite?.close();
  sqlite = null;
  database = null;
}

export {
  addRecentlyClosedTab,
  closeDatabase,
  initializeDatabase,
  loadBrowserSnapshot,
  loadWindowState,
  popRecentlyClosedTab,
  saveBrowserSnapshot,
  saveWindowState,
};
