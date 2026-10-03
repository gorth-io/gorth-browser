import { ipcMain } from "electron";
import {
  addRecentlyClosedTab,
  loadBrowserSnapshot,
  popRecentlyClosedTab,
  saveBrowserSnapshot,
} from "@/database/client";
import type { BrowserSnapshot, PersistedTab } from "@/lib/browser/persistence";
import { getWindowFromSender } from "@/main/windows/capital";

export function registerDatabaseIpc() {
  ipcMain.handle("persistence:load", () => loadBrowserSnapshot());
  ipcMain.handle("persistence:save", (_event, snapshot: BrowserSnapshot) => {
    saveBrowserSnapshot(snapshot);
  });
  ipcMain.on("persistence:flush", (event, snapshot: BrowserSnapshot) => {
    try {
      const window = getWindowFromSender(event.sender);
      if (!window || window.webContents !== event.sender) {
        event.returnValue = false;
        return;
      }
      saveBrowserSnapshot(snapshot);
      event.returnValue = true;
    } catch (error) {
      console.error(
        "Unable to save the browser session before closing.",
        error,
      );
      event.returnValue = false;
    }
  });
  ipcMain.handle("persistence:close-tab", (_event, tab: PersistedTab) => {
    addRecentlyClosedTab(tab);
  });
  ipcMain.handle("persistence:reopen-closed-tab", () => popRecentlyClosedTab());
}
