import { ipcRenderer } from "electron";
import type { ArchiveEntry } from "@/lib/browser/lifecycle";
import type { PersistedTab } from "@/lib/browser/persistence";
export const lifecycleApi = {
  sleep: (id: string) =>
    ipcRenderer.invoke("tabs:sleep", id) as Promise<boolean>,
  archive: (id: string) =>
    ipcRenderer.invoke("tabs:archive", id) as Promise<boolean>,
  list: () => ipcRenderer.invoke("archive:list") as Promise<ArchiveEntry[]>,
  restore: (id: string) =>
    ipcRenderer.invoke("archive:restore", id) as Promise<PersistedTab | null>,
  delete: (id: string) =>
    ipcRenderer.invoke("archive:delete", id) as Promise<void>,
  onArchived: (callback: (id: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) =>
      callback(id);
    ipcRenderer.on("tabs:archived", listener);
    return () => {
      ipcRenderer.removeListener("tabs:archived", listener);
    };
  },
};
