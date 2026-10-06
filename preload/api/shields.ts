import { ipcRenderer } from "electron";
import type { ShieldPreferences, ShieldStatus } from "@/lib/browser/shields";
export const shieldsApi = {
  status: () => ipcRenderer.invoke("shields:status") as Promise<ShieldStatus>,
  update: () => ipcRenderer.invoke("shields:update") as Promise<ShieldStatus>,
  save: (preferences: ShieldPreferences) =>
    ipcRenderer.invoke(
      "shields:preferences",
      preferences,
    ) as Promise<ShieldStatus>,
  onChanged: (callback: (status: ShieldStatus) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: ShieldStatus,
    ) => callback(status);
    ipcRenderer.on("shields:changed", listener);
    return () => {
      ipcRenderer.removeListener("shields:changed", listener);
    };
  },
};
