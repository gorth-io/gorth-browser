import { ipcRenderer } from "electron";
import type {
  BrowserSnapshot,
  PersistedTab,
  PersistedTabGroup,
} from "@/lib/browser/persistence";
export const persistenceApi = {
  saveGroup: (group: PersistedTabGroup) =>
    ipcRenderer.invoke("tab-groups:save", group) as Promise<
      PersistedTabGroup[]
    >,
  deleteGroup: (id: string) =>
    ipcRenderer.invoke("tab-groups:delete", id) as Promise<PersistedTabGroup[]>,
  listGroups: () =>
    ipcRenderer.invoke("tab-groups:list") as Promise<PersistedTabGroup[]>,
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
