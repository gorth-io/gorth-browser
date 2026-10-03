import { registerContextMenuIpc } from "@/main/ipc/context-menu";
import { registerBrowserIpc } from "@/main/ipc/browser";
import { registerWindowIpc } from "@/main/ipc/window";
import { registerDatabaseIpc } from "@/main/ipc/database";
import { configureDataDirectory } from "@/services/data-directory";
import { app, BrowserWindow, protocol } from "electron";
import started from "electron-squirrel-startup";
import { closeDatabase, initializeDatabase } from "@/database/client";
import { registerAuthIpc, cancelAuth } from "@/lib/auth/service";
import {
  APP_ID,
  APP_NAME,
  getRuntimeAppIconPath,
  createWindow,
} from "@/main/windows/capital";
import { installApplicationMenu } from "@/main/ipc/application-menu";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "gorth",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: false,
      corsEnabled: false,
      codeCache: true,
    },
  },
]);

if (started) {
  app.quit();
}

app.setName(APP_NAME);

configureDataDirectory();

app.setAppUserModelId(APP_ID);

app.setAboutPanelOptions({
  applicationName: APP_NAME,
  applicationVersion: app.getVersion(),
  version: app.getVersion(),
});

registerContextMenuIpc();
registerBrowserIpc();
registerWindowIpc();
registerDatabaseIpc();

app.whenReady().then(async () => {
  registerAuthIpc();
  initializeDatabase(app.getPath("userData"));
  if (process.platform === "darwin") {
    try {
      await app.dock?.setIcon(getRuntimeAppIconPath());
    } catch (error) {
      console.warn("Unable to set the macOS Dock icon.", error);
    }
  }

  protocol.handle(
    "gorth",
    () =>
      new Response("Gorth internal page not found.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
  );
  installApplicationMenu();
  createWindow();
});

app.on("before-quit", cancelAuth);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("will-quit", closeDatabase);
