import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import {
  initializeDatabase,
  closeDatabase,
  loadBrowserSnapshot,
  saveBrowserSnapshot,
  saveTabGroup,
  deleteTabGroup,
  loadTabGroups,
  addRecentlyClosedTab,
} from "@/services/browser-database";
import {
  defaultBrowserPreferences,
  type PersistedTab,
} from "@/lib/browser/persistence";
import {
  updateWebviewBounds,
  type WebviewLayoutState,
} from "@/main/windows/webview";
import type { BrowserWindow } from "electron";

test("Tab groups: legacy migration, immediate CRUD, session save, restart and closed members", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "gorth-tab-groups-"));
  const filename = path.join(directory, "gorth-browser.db");
  const legacy = new Database(filename);
  legacy.exec(
    "CREATE TABLE tab_groups (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, mode TEXT NOT NULL, position INTEGER NOT NULL)",
  );
  legacy.close();
  try {
    initializeDatabase(directory);
    const tabs: PersistedTab[] = ["a", "b", "c", "d", "e"].map((id) => ({
      id,
      title: id,
      url: `https://${id}.example`,
      faviconUrl: "",
      isMuted: false,
      isPinned: false,
      internalPage: null,
    }));
    const snapshot = {
      activeTabId: "a",
      tabs,
      groups: [],
      splitTabId: null,
      bookmarks: [],
      history: [],
      preferences: defaultBrowserPreferences,
    };
    saveBrowserSnapshot(snapshot);
    saveTabGroup({ id: "normal", name: "Work", mode: "normal", tabIds: ["a"] });
    saveTabGroup({
      id: "split",
      name: "Compare",
      mode: "split",
      tabIds: ["b", "c"],
    });
    saveTabGroup({
      id: "glance",
      name: "Preview",
      mode: "glance",
      tabIds: ["d", "e"],
    });
    const check = new Database(filename, { readonly: true });
    assert.equal(
      check.prepare("SELECT count(*) AS n FROM tab_groups").get()?.n,
      3,
    );
    check.close();
    assert.throws(() =>
      saveTabGroup({
        id: "conflict",
        name: "Duplicate",
        mode: "normal",
        tabIds: ["a"],
      }),
    );
    assert.throws(() =>
      saveTabGroup({
        id: "missing",
        name: "Missing",
        mode: "normal",
        tabIds: ["missing"],
      }),
    );
    saveBrowserSnapshot(snapshot); // A stale session snapshot must not erase named groups.
    closeDatabase();
    initializeDatabase(directory);
    assert.equal(loadBrowserSnapshot().groups.length, 3);
    saveTabGroup({
      id: "normal",
      name: "Renamed",
      mode: "normal",
      tabIds: ["a"],
    });
    assert.equal(loadTabGroups()[0].name, "Renamed");
    deleteTabGroup("normal");
    const deleted = new Database(filename, { readonly: true });
    assert.equal(
      deleted
        .prepare(
          "SELECT count(*) AS n FROM tab_group_members WHERE group_id = 'normal'",
        )
        .get()?.n,
      0,
    );
    deleted.close();
    addRecentlyClosedTab(tabs[1]);
    assert.deepEqual(
      loadTabGroups().map((group) => group.id),
      ["glance"],
    );
    deleteTabGroup("glance");
    saveBrowserSnapshot(snapshot);
    closeDatabase();
    initializeDatabase(directory);
    assert.deepEqual(loadTabGroups(), []);
  } finally {
    closeDatabase();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Split and glance native layouts keep chrome portals above web tabs", () => {
  const makeView = () => ({
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    visible: false,
    radius: 0,
    setBounds(bounds: { x: number; y: number; width: number; height: number }) {
      this.bounds = bounds;
    },
    setVisible(visible: boolean) {
      this.visible = visible;
    },
    setBorderRadius(radius: number) {
      this.radius = radius;
    },
  });
  const front = makeView();
  const back = makeView();
  const chrome = {};
  const portal = {};
  const children = [chrome, front, back, portal];
  const window = {
    getContentSize: () => [1280, 720],
    contentView: {
      children,
      addChildView(view: object, index: number) {
        children.splice(children.indexOf(view), 1);
        children.splice(index, 0, view);
      },
    },
  } as unknown as BrowserWindow;
  const state = {
    activeTabId: "a",
    splitTabId: "b",
    companionMode: "split",
    internalTabIds: new Set(),
    webFullScreenTabId: null,
    layout: {
      top: 112,
      sidebarWidth: 0,
      verticalTabsWidth: 0,
      sidebarSide: "left",
    },
    views: new Map([
      ["a", { view: front }],
      ["b", { view: back }],
    ]),
  } as unknown as WebviewLayoutState;
  updateWebviewBounds(window, state);
  assert.deepEqual(front.bounds, { x: 0, y: 112, width: 639, height: 608 });
  assert.deepEqual(back.bounds, { x: 640, y: 112, width: 640, height: 608 });
  state.companionMode = "glance";
  updateWebviewBounds(window, state);
  assert.equal(front.bounds.width, 1088);
  assert.equal(front.bounds.x, 96);
  assert.equal(front.radius, 12);
  assert.equal(children[0], chrome);
  assert.equal(children[2], front);
  assert.equal(children[3], portal);
  state.splitTabId = null;
  updateWebviewBounds(window, state);
  assert.equal(back.visible, false);
  assert.equal(front.bounds.width, 1280);
  assert.equal(front.radius, 0);
});
