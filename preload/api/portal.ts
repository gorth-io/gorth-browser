import { ipcRenderer } from "electron";
import type {
  PortalMenuAnchor,
  PortalMenuState,
} from "@/lib/browser/browser-menu";
export const portalApi = {
  update: (
    id: string,
    bounds: { x: number; y: number; width: number; height: number } | null,
  ) => ipcRenderer.send("portal:update", id, bounds),
  onBlur: (callback: (id: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) =>
      callback(id);
    ipcRenderer.on("portal:blur", listener);
    return () => {
      ipcRenderer.removeListener("portal:blur", listener);
    };
  },
};
export const menuPortalApi = {
  onRequest: (
    callback: (
      request: {
        id: number;
        state: PortalMenuState;
        anchor: PortalMenuAnchor;
      } | null,
    ) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      request: {
        id: number;
        state: PortalMenuState;
        anchor: PortalMenuAnchor;
      } | null,
    ) => callback(request);
    ipcRenderer.on("menu-portal:request", listener);
    return () => {
      ipcRenderer.removeListener("menu-portal:request", listener);
    };
  },
  result: (id: number, value: string | null) =>
    ipcRenderer.send("menu-portal:result", id, value),
};
