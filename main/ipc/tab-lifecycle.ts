import { ipcMain } from "electron";
import { z } from "zod";
import { getBrowserState, getWindowFromSender } from "@/main/windows/capital";
import {
  archiveBrowserTab,
  sleepTab,
  wakeTab,
} from "@/main/services/tab-lifecycle";
import {
  listArchivedTabs,
  takeArchivedTab,
  restoreArchivedTab,
} from "@/services/browser-database";

export function registerTabLifecycleIpc() {
  const requireWindow = (event: Electron.IpcMainInvokeEvent) => {
    const window = getWindowFromSender(event.sender);
    if (
      !window ||
      window.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new Error("Untrusted tab lifecycle request.");
    return window;
  };
  const idSchema = z.string().min(1).max(128);
  ipcMain.handle("tabs:sleep", (event, id: unknown) =>
    sleepTab(requireWindow(event), idSchema.parse(id)),
  );
  ipcMain.handle("tabs:archive", (event, id: unknown) =>
    archiveBrowserTab(requireWindow(event), idSchema.parse(id)),
  );
  ipcMain.handle("archive:list", (event) => {
    requireWindow(event);
    return listArchivedTabs();
  });
  ipcMain.handle("archive:restore", (event, id: unknown) => {
    const window = requireWindow(event);
    const state = getBrowserState(window);
    const tab = restoreArchivedTab(idSchema.parse(id), state.sessionId);
    if (!tab) return null;
    state.tabMetadata.set(tab.id, tab);
    state.activeTabId = tab.id;
    void wakeTab(window, tab.id);
    return tab;
  });
  ipcMain.handle("archive:delete", (event, id: unknown) => {
    requireWindow(event);
    takeArchivedTab(idSchema.parse(id), true);
  });
}
