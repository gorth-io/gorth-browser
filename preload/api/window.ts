import { ipcRenderer } from "electron";
export const windowStateApi = {
  isMacOS: process.platform === "darwin",
  getIsFullScreen: () =>
    ipcRenderer.invoke("window:is-full-screen") as Promise<boolean>,
  onFullScreenChanged: (callback: (isFullScreen: boolean) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      isFullScreen: boolean,
    ) => callback(isFullScreen);

    ipcRenderer.on("window:full-screen-changed", listener);

    return () => {
      ipcRenderer.removeListener("window:full-screen-changed", listener);
    };
  },
  onWebFullScreenChanged: (callback: (isFullScreen: boolean) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      isFullScreen: boolean,
    ) => callback(isFullScreen);
    ipcRenderer.on("window:web-full-screen-changed", listener);
    return () => {
      ipcRenderer.removeListener("window:web-full-screen-changed", listener);
    };
  },
};
