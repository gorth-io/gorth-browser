import { ipcMain, type WebContents } from "electron";
import { z } from "zod";
import { getWindowFromSender } from "@/main/windows/capital";
import {
  getDownloads,
  controlDownload,
  retryDownload,
  openDownload,
  removeDownload,
  clearDownloadHistory,
  getDownloadPreferences,
  chooseDownloadDirectory,
  setAskWhereToSave,
} from "@/main/services/downloads";

function requireBrowserWindow(sender: WebContents) {
  const window = getWindowFromSender(sender);
  if (!window || window.webContents !== sender)
    throw new Error("Untrusted download request.");
  return window;
}

export function registerDownloadIpc() {
  const idSchema = z.uuid();
  ipcMain.handle("downloads:list", (event) => {
    requireBrowserWindow(event.sender);
    return getDownloads();
  });
  for (const action of ["pause", "resume", "cancel"] as const) {
    ipcMain.handle(`downloads:${action}`, (event, id: unknown) => {
      requireBrowserWindow(event.sender);
      controlDownload(idSchema.parse(id), action);
    });
  }
  ipcMain.handle("downloads:retry", (event, id: unknown) =>
    retryDownload(idSchema.parse(id), requireBrowserWindow(event.sender)),
  );
  ipcMain.handle("downloads:open", (event, id: unknown) =>
    openDownload(idSchema.parse(id), requireBrowserWindow(event.sender), false),
  );
  ipcMain.handle("downloads:reveal", (event, id: unknown) =>
    openDownload(idSchema.parse(id), requireBrowserWindow(event.sender), true),
  );
  ipcMain.handle("downloads:remove", (event, id: unknown) => {
    requireBrowserWindow(event.sender);
    removeDownload(idSchema.parse(id));
  });
  ipcMain.handle("downloads:clear", (event) => {
    requireBrowserWindow(event.sender);
    clearDownloadHistory();
  });
  ipcMain.handle("downloads:preferences", (event) => {
    requireBrowserWindow(event.sender);
    return getDownloadPreferences();
  });
  ipcMain.handle("downloads:choose-directory", (event) =>
    chooseDownloadDirectory(requireBrowserWindow(event.sender)),
  );
  ipcMain.handle("downloads:set-ask", (event, ask: unknown) => {
    requireBrowserWindow(event.sender);
    return setAskWhereToSave(z.boolean().parse(ask));
  });
}
