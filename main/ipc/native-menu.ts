import { BrowserWindow } from "electron";

export function sendAppAction(action: string) {
  const window = BrowserWindow.getFocusedWindow();
  if (window && !window.webContents.isDestroyed()) {
    window.webContents.send("app:action", action);
  }
}
