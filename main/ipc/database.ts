import { ipcMain } from "electron";
import { z } from "zod";
import {
  addRecentlyClosedTab,
  loadBrowserSnapshot,
  popRecentlyClosedTab,
  saveBrowserSnapshot,
  saveTabGroup,
  deleteTabGroup,
  loadTabGroups,
} from "@/services/browser-database";
import type { BrowserSnapshot, PersistedTab } from "@/lib/browser/persistence";
import { getWindowFromSender, getBrowserState } from "@/main/windows/capital";
import {
  restoreTabSession,
  synchronizeTabSession,
  captureTabNavigation,
} from "@/main/services/tab-lifecycle";
import {
  browserSnapshotSchema,
  persistedTabSchema,
  tabGroupSchema,
} from "@/lib/browser/session-schema";

export function registerDatabaseIpc() {
  const requireAppSender = (sender: Electron.WebContents) => {
    const window = getWindowFromSender(sender);
    if (!window || window.webContents !== sender)
      throw new Error("Untrusted group request.");
    return getBrowserState(window).sessionId;
  };
  ipcMain.handle("tab-groups:save", (event, input: unknown) => {
    return saveTabGroup(
      tabGroupSchema.parse(input),
      requireAppSender(event.sender),
    );
  });
  ipcMain.handle("tab-groups:delete", (event, input: unknown) => {
    return deleteTabGroup(
      z.string().min(1).max(128).parse(input),
      requireAppSender(event.sender),
    );
  });
  ipcMain.handle("tab-groups:list", (event) => {
    return loadTabGroups(requireAppSender(event.sender));
  });
  ipcMain.handle("persistence:load", (event) => {
    const windowId = requireAppSender(event.sender);
    return restoreTabSession(
      getWindowFromSender(event.sender)!,
      loadBrowserSnapshot(windowId),
    );
  });
  ipcMain.handle("persistence:save", (event, snapshot: BrowserSnapshot) => {
    snapshot = browserSnapshotSchema.parse(snapshot);
    const windowId = requireAppSender(event.sender);
    const window = getWindowFromSender(event.sender)!;
    synchronizeTabSession(window, snapshot);
    saveBrowserSnapshot(snapshot, windowId);
  });
  ipcMain.on("persistence:flush", (event, snapshot: BrowserSnapshot) => {
    try {
      const window = getWindowFromSender(event.sender);
      if (!window || window.webContents !== event.sender) {
        event.returnValue = false;
        return;
      }
      snapshot = browserSnapshotSchema.parse(snapshot);
      synchronizeTabSession(window, snapshot);
      saveBrowserSnapshot(snapshot, requireAppSender(event.sender));
      event.returnValue = true;
    } catch (error) {
      console.error(
        "Unable to save the browser session before closing.",
        error,
      );
      event.returnValue = false;
    }
  });
  ipcMain.handle("persistence:close-tab", (event, tab: PersistedTab) => {
    tab = persistedTabSchema.parse(tab);
    const windowId = requireAppSender(event.sender);
    const runtime = captureTabNavigation(
      getWindowFromSender(event.sender)!,
      tab.id,
    );
    addRecentlyClosedTab(
      { ...tab, navigation: runtime?.navigation ?? tab.navigation },
      windowId,
    );
  });
  ipcMain.handle("persistence:reopen-closed-tab", (event) =>
    popRecentlyClosedTab(requireAppSender(event.sender)),
  );
}
