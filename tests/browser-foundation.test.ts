import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  initializeDatabase,
  closeDatabase,
  loadBrowserSnapshot,
  saveBrowserSnapshot,
  saveTabGroup,
  loadTabGroups,
  addRecentlyClosedTab,
  popRecentlyClosedTab,
  saveWindowState,
  loadWindowState,
  getRestoredWindowIds,
  setWindowOpen,
  archiveTab,
  listArchivedTabs,
  restoreArchivedTab,
} from "@/services/browser-database";
import {
  defaultBrowserPreferences,
  type PersistedTab,
} from "@/lib/browser/persistence";
import { shouldSleepTab } from "@/lib/browser/lifecycle";
import { isSiteExcluded, normalizeSite } from "@/lib/browser/shields";
import {
  parseInternalPage,
  getInternalPageUrl,
} from "@/lib/browser/internal-pages";

test("Auth completion and profile destinations are real internal pages", () => {
  assert.equal(parseInternalPage("gorth://auth"), "auth");
  assert.equal(
    parseInternalPage("gorth://settings/profile"),
    "settings/profile",
  );
  assert.equal(
    getInternalPageUrl("settings/profile"),
    "gorth://settings/profile",
  );
});

test("Independent multiwindow sessions, shared-data deltas, recently closed, groups and archive survive restart", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "gorth-foundation-"));
  const makeTab = (id: string): PersistedTab => ({
    id,
    title: id,
    url: `https://${id}.example`,
    faviconUrl: "",
    isMuted: false,
    isPinned: false,
    internalPage: null,
  });
  try {
    initializeDatabase(directory);
    const a = loadBrowserSnapshot("main");
    const b = loadBrowserSnapshot("second");
    a.tabs = [makeTab("a"), makeTab("b")];
    a.activeTabId = "a";
    a.bookmarks = [{ id: "bookmark-a", title: "A", url: "https://a.example" }];
    b.tabs = [makeTab("c")];
    b.activeTabId = "c";
    b.bookmarks = [{ id: "bookmark-c", title: "C", url: "https://c.example" }];
    a.history = [
      {
        id: "visit-a",
        tabId: "a",
        title: "A",
        url: "https://a.example",
        visitedAt: 1,
      },
    ];
    b.history = [
      {
        id: "visit-c",
        tabId: "c",
        title: "C",
        url: "https://c.example",
        visitedAt: 2,
      },
    ];
    saveBrowserSnapshot(a, "main");
    saveBrowserSnapshot(b, "second");
    saveBrowserSnapshot(a, "main");
    saveTabGroup(
      { id: "g", name: "Work", mode: "normal", tabIds: ["a", "b"] },
      "main",
    );
    assert.equal(loadTabGroups("second").length, 0);
    assert.throws(() =>
      saveTabGroup(
        {
          id: "g",
          name: "Cannot steal a group",
          mode: "normal",
          tabIds: ["c"],
        },
        "second",
      ),
    );
    assert.equal(loadTabGroups("main").length, 1);
    const shared = loadBrowserSnapshot("third");
    assert.equal(shared.bookmarks.length, 2);
    assert.equal(shared.history.length, 2);
    assert.equal(shared.tabs.length, 0);
    a.bookmarks = [];
    a.history = [];
    saveBrowserSnapshot(a, "main");
    assert.deepEqual(
      loadBrowserSnapshot("third").bookmarks.map((row) => row.id),
      ["bookmark-c"],
    );
    assert.deepEqual(
      loadBrowserSnapshot("third").history.map((row) => row.id),
      ["visit-c"],
    );
    addRecentlyClosedTab(b.tabs[0], "second");
    assert.equal(popRecentlyClosedTab("main"), null);
    assert.equal(popRecentlyClosedTab("second")?.id, "c");
    saveWindowState(
      { x: 20, y: 20, width: 1280, height: 720, isMaximized: false },
      "main",
    );
    saveWindowState(
      { x: 40, y: 40, width: 1920, height: 1080, isMaximized: true },
      "second",
    );
    assert.equal(loadWindowState("main")?.width, 1280);
    assert.equal(loadWindowState("second")?.width, 1920);
    assert.deepEqual(getRestoredWindowIds().sort(), ["main", "second"]);
    setWindowOpen("second", false);
    assert.deepEqual(getRestoredWindowIds(), ["main"]);
    archiveTab(a.tabs[1], "main");
    saveBrowserSnapshot(a, "main"); // Stale window snapshots must not revive archives.
    assert.deepEqual(
      loadBrowserSnapshot("main").tabs.map((tab) => tab.id),
      ["a"],
    );
    closeDatabase();
    initializeDatabase(directory);
    assert.equal(listArchivedTabs().length, 1);
    const restored = restoreArchivedTab("b", "second");
    assert.notEqual(restored?.id, "b");
    assert.equal(restored?.url, "https://b.example");
    assert.equal(listArchivedTabs().length, 0);
    assert.equal(loadBrowserSnapshot("second").tabs.length, 2);
    assert.equal(loadBrowserSnapshot("main").tabs.length, 1);
  } finally {
    closeDatabase();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Memory saver eligibility is explicit and exceptions match hostnames, not URL substrings", () => {
  const input = {
    active: false,
    pinned: false,
    grouped: false,
    internal: false,
    busy: false,
    lastActiveAt: 1,
    now: 1_000_000,
    preferences: {
      memorySaver: true,
      sleepAfterMinutes: 15,
      archiveAfterDays: 0,
    },
  };
  assert.equal(shouldSleepTab(input), true);
  for (const key of [
    "active",
    "pinned",
    "grouped",
    "internal",
    "busy",
  ] as const)
    assert.equal(shouldSleepTab({ ...input, [key]: true }), false);
  assert.equal(
    shouldSleepTab({
      ...input,
      preferences: { ...input.preferences, memorySaver: false },
    }),
    false,
  );
  assert.equal(normalizeSite("https://www.example.com/path"), "example.com");
  assert.equal(
    isSiteExcluded("https://sub.example.com/path", ["example.com"]),
    true,
  );
  assert.equal(
    isSiteExcluded("https://evil-example.com", ["example.com"]),
    false,
  );
  assert.equal(
    isSiteExcluded("https://example.com.evil.test", ["example.com"]),
    false,
  );
  assert.throws(() => normalizeSite("file:///etc/passwd"));
  assert.deepEqual(defaultBrowserPreferences.flags, {
    memorySaver: true,
    smoothScrolling: true,
  });
});
