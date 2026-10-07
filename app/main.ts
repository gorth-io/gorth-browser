import path from "node:path";
import {
  startDesktopServer,
  stopDesktopServer,
} from "@/services/desktop-server";
import { registerContextMenuIpc } from "@/main/ipc/context-menu";
import { registerBrowserIpc } from "@/main/ipc/browser";
import { registerWindowIpc } from "@/main/ipc/window";
import { registerDatabaseIpc } from "@/main/ipc/database";
import { registerRpcIpc } from "@/main/ipc/rpc";
import { configureDataDirectory } from "@/services/data-directory";
import { app, BrowserWindow, protocol, session, dialog } from "electron";
import { registerDownloadIpc } from "@/main/ipc/downloads";
import {
  installDownloadManager,
  shutdownDownloadManager,
} from "@/main/services/downloads";
import started from "electron-squirrel-startup";
import {
  closeDatabase,
  initializeDatabase,
  loadBrowserSnapshot,
  getRestoredWindowIds,
  readBrowserSetting,
} from "@/services/browser-database";
import {
  initializeContentBlocker,
  stopContentBlocker,
} from "@/main/services/content-blocker";
import { registerTabLifecycleIpc } from "@/main/ipc/tab-lifecycle";
import {
  registerAuthIpc,
  cancelAuth,
  getAuthenticatedUserId,
} from "@/lib/auth/service";
import {
  APP_ID,
  APP_NAME,
  getRuntimeAppIconPath,
  createWindow,
} from "@/main/windows/capital";
import { installApplicationMenu } from "@/main/ipc/application-menu";
import { registerShortcutsIpc } from "@/main/ipc/shortcuts";
import { sendAppAction } from "@/main/ipc/native-menu";

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
const ownsDataDirectory = app.requestSingleInstanceLock();
if (!ownsDataDirectory) app.quit();
app.on("second-instance", () => {
  const window = BrowserWindow.getAllWindows().find(
    (candidate) => candidate.webContents.getURL() !== "about:blank",
  );
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
});
// Chromium feature switches must be selected before app readiness.
if (ownsDataDirectory) {
  initializeDatabase(app.getPath("userData"));
  if (
    !readBrowserSetting(
      "smoothScrolling",
      loadBrowserSnapshot().preferences.flags.smoothScrolling,
    )
  )
    app.commandLine.appendSwitch("disable-features", "SmoothScrolling");
}

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
registerRpcIpc();
registerDownloadIpc();
registerTabLifecycleIpc();

app
  .whenReady()
  .then(async () => {
    if (!ownsDataDirectory) return;
    await startDesktopServer(
      !!MAIN_WINDOW_VITE_DEV_SERVER_URL,
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`),
      getAuthenticatedUserId,
    );
    registerAuthIpc();
    installDownloadManager(session.defaultSession);
    await initializeContentBlocker();
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
    registerShortcutsIpc(installApplicationMenu, (id) => {
      if (id === "new-window") createWindow();
      else sendAppAction(id);
    });
    installApplicationMenu();
    for (const id of getRestoredWindowIds()) createWindow(id);
  })
  .catch(() => {
    dialog.showErrorBox(
      "Gorth Browser",
      "Không khởi động được desktop server hoặc dữ liệu ứng dụng. Kiểm tra port ứng dụng rồi khởi động lại.",
    );
    app.quit();
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

app.on("will-quit", () => {
  shutdownDownloadManager();
  stopContentBlocker();
  closeDatabase();
});

app.on("before-quit", stopDesktopServer);
