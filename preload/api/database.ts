import { ipcRenderer } from "electron";
import type { BrowserSnapshot, PersistedTab } from "@/lib/browser/persistence";
export const persistenceApi = {
  load: () =>
    ipcRenderer.invoke("persistence:load") as Promise<BrowserSnapshot>,
  save: (snapshot: BrowserSnapshot) =>
    ipcRenderer.invoke("persistence:save", snapshot) as Promise<void>,
  flush: (snapshot: BrowserSnapshot) =>
    ipcRenderer.sendSync("persistence:flush", snapshot) as boolean,
  closeTab: (tab: PersistedTab) =>
    ipcRenderer.invoke("persistence:close-tab", tab) as Promise<void>,
  reopenClosedTab: () =>
    ipcRenderer.invoke(
      "persistence:reopen-closed-tab",
    ) as Promise<PersistedTab | null>,
};
