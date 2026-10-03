import { ipcRenderer } from "electron";
import type { AuthAction, AuthResult, AuthSnapshot } from "@/lib/auth/types";
export const authApi = {
  onChanged: (callback: (snapshot: AuthSnapshot) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      snapshot: AuthSnapshot,
    ) => callback(snapshot);
    ipcRenderer.on("auth:changed", listener);
    return () => ipcRenderer.removeListener("auth:changed", listener);
  },
  snapshot: (): Promise<AuthResult> => ipcRenderer.invoke("auth:snapshot"),
  command: (action: AuthAction): Promise<AuthResult> =>
    ipcRenderer.invoke("auth:command", action),
};
