import { ipcRenderer } from "electron";
import type {
  DownloadInfo,
  DownloadPreferences,
  DownloadNotification,
} from "@/lib/browser/downloads";

export const downloadsApi = {
  onNotification: (callback: (notification: DownloadNotification) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      notification: DownloadNotification,
    ) => callback(notification);
    ipcRenderer.on("downloads:notification", listener);
    return () => ipcRenderer.removeListener("downloads:notification", listener);
  },
  list: () => ipcRenderer.invoke("downloads:list") as Promise<DownloadInfo[]>,
  pause: (id: string) =>
    ipcRenderer.invoke("downloads:pause", id) as Promise<void>,
  resume: (id: string) =>
    ipcRenderer.invoke("downloads:resume", id) as Promise<void>,
  cancel: (id: string) =>
    ipcRenderer.invoke("downloads:cancel", id) as Promise<void>,
  retry: (id: string) =>
    ipcRenderer.invoke("downloads:retry", id) as Promise<void>,
  open: (id: string) =>
    ipcRenderer.invoke("downloads:open", id) as Promise<void>,
  reveal: (id: string) =>
    ipcRenderer.invoke("downloads:reveal", id) as Promise<void>,
  remove: (id: string) =>
    ipcRenderer.invoke("downloads:remove", id) as Promise<void>,
  clear: () => ipcRenderer.invoke("downloads:clear") as Promise<void>,
  preferences: () =>
    ipcRenderer.invoke("downloads:preferences") as Promise<DownloadPreferences>,
  chooseDirectory: () =>
    ipcRenderer.invoke(
      "downloads:choose-directory",
    ) as Promise<DownloadPreferences>,
  setAskWhereToSave: (ask: boolean) =>
    ipcRenderer.invoke(
      "downloads:set-ask",
      ask,
    ) as Promise<DownloadPreferences>,
  onChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("downloads:changed", listener);
    return () => ipcRenderer.removeListener("downloads:changed", listener);
  },
  onError: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) =>
      callback(message);
    ipcRenderer.on("downloads:error", listener);
    return () => ipcRenderer.removeListener("downloads:error", listener);
  },
};
