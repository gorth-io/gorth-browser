import { contextBridge, ipcRenderer } from "electron";
import { shieldsApi } from "@/preload/api/shields";
contextBridge.exposeInMainWorld("fixture", {
  shields: shieldsApi,
  onOpen: (callback: (url: string) => void) => {
    ipcRenderer.on("tabs:open-requested", (_event, url: string) =>
      callback(url),
    );
  },
});
