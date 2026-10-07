import { appUrl } from "@/lib/utils/environment";
import { installPortal } from "@/main/windows/portal";
import {
  createWebview,
  updateWebviewBounds,
  type WebviewLayout,
  type WebviewRecord,
} from "@/main/windows/webview";
import { app, BrowserWindow, nativeTheme, type WebContents } from "electron";
import path from "node:path";
import { parseHttpUrl } from "@/lib/utils/schema";
import { saveWindowState, setWindowOpen } from "@/services/browser-database";
import {
  getInternalPageTitle,
  getInternalPageUrl,
  parseInternalPage,
  type BrowserInternalPage,
} from "@/lib/browser/internal-pages";
import {
  dismissPortalMenuForParent,
  showPageContextMenu,
} from "@/main/ipc/context-menu";
import { getRestoredWindowOptions } from "@/main/windows/state";
import {
  defaultBrowserPreferences,
  type BrowserPreferences,
  type PersistedTab,
} from "@/lib/browser/persistence";
import {
  captureTabNavigation,
  trackTabLifecycle,
} from "@/main/services/tab-lifecycle";
import { registerBlockerContents } from "@/main/services/content-blocker";
import { canRecoverQuicFailure } from "@/main/services/navigation";

export type BrowserLayout = WebviewLayout;

type TabViewRecord = WebviewRecord;

interface BrowserState {
  preferences: BrowserPreferences;
  tabMetadata: Map<string, PersistedTab>;
  groupedTabIds: Set<string>;
  archivedTabIds: Set<string>;
  sessionId: string;
  companionMode: "split" | "glance";
  activeTabId: string | null;
  internalPages: Map<string, BrowserInternalPage>;
  layout: BrowserLayout;
  splitTabId: string | null;
  views: Map<string, TabViewRecord>;
  webFullScreenTabId: string | null;
  wasFullScreenBeforeWeb: boolean;
}

interface TabUpdate {
  isSleeping?: boolean;
  navigation?: PersistedTab["navigation"];
  errorCode?: number;
  errorDescription?: string;
  errorUrl?: string;
  id: string;
  title?: string;
  url?: string;
  faviconUrl?: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  isLoading?: boolean;
  isMuted?: boolean;
  isHome?: boolean;
  internalPage?: BrowserInternalPage | null;
}

const browserStates = new Map<number, BrowserState>();

export function getBrowserWindows(): BrowserWindow[] {
  return [...browserStates.keys()]
    .map((id) => BrowserWindow.fromId(id))
    .filter((window): window is BrowserWindow =>
      Boolean(window && !window.isDestroyed()),
    );
}

export const APP_ID = "com.gorth.browser";

export const APP_NAME = "Gorth Browser";

export function getWindowFromSender(sender: WebContents) {
  const window = BrowserWindow.fromWebContents(sender);
  return window && window.webContents === sender && browserStates.has(window.id)
    ? window
    : null;
}

export function getRuntimeAppIconPath() {
  const filename = process.platform === "win32" ? "favicon.ico" : "favicon.png";

  return path.join(app.getAppPath(), "assets", filename);
}

export function getBrowserState(window: BrowserWindow) {
  let state = browserStates.get(window.id);

  if (!state) {
    state = {
      preferences: defaultBrowserPreferences,
      tabMetadata: new Map(),
      groupedTabIds: new Set(),
      archivedTabIds: new Set(),
      sessionId: crypto.randomUUID(),
      companionMode: "split",
      activeTabId: null,
      internalPages: new Map(),
      splitTabId: null,
      layout: {
        top: 112,
        sidebarWidth: 0,
        sidebarSide: "left",
        verticalTabsWidth: 0,
      },
      views: new Map(),
      webFullScreenTabId: null,
      wasFullScreenBeforeWeb: false,
    };
    browserStates.set(window.id, state);
  }

  return state;
}

export function sendTabUpdate(window: BrowserWindow, update: TabUpdate) {
  if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
    window.webContents.send("tabs:updated", update);
  }
}

function sendNavigationState(
  window: BrowserWindow,
  tabId: string,
  record: TabViewRecord,
) {
  const state = getBrowserState(window);
  if (state.internalPages.has(tabId)) return;

  const { navigationHistory } = record.view.webContents;

  sendTabUpdate(window, {
    id: tabId,
    url: record.view.webContents.getURL(),
    canGoBack: true,
    canGoForward: navigationHistory.canGoForward(),
    isHome: false,
    internalPage: null,
  });
}

export function showInternalPage(
  window: BrowserWindow,
  tabId: string,
  page: BrowserInternalPage,
) {
  const state = getBrowserState(window);
  const previous = state.tabMetadata.get(state.activeTabId ?? "");
  if (previous) previous.lastActiveAt = Date.now();
  state.activeTabId = tabId;
  const metadata = state.tabMetadata.get(tabId);
  if (metadata) {
    metadata.internalPage = page;
    metadata.isSleeping = false;
    metadata.lastActiveAt = Date.now();
  }
  state.internalPages.set(tabId, page);
  state.views.get(tabId)?.view.webContents.setAudioMuted(false);
  sendTabUpdate(window, {
    id: tabId,
    title: getInternalPageTitle(page),
    url: getInternalPageUrl(page),
    faviconUrl: "",
    canGoBack: page !== "new-tab",
    canGoForward: false,
    isLoading: false,
    isMuted: false,
    isHome: page === "new-tab",
    internalPage: page,
  });
  updateViewBounds(window);
}

export function showErrorPage(
  window: BrowserWindow,
  tabId: string,
  errorUrl: string,
  errorCode: number,
  errorDescription: string,
) {
  const state = getBrowserState(window);
  state.internalPages.set(tabId, "error");
  sendTabUpdate(window, {
    id: tabId,
    title: "Page unavailable",
    url: errorUrl,
    faviconUrl: "",
    canGoBack: true,
    canGoForward: false,
    isLoading: false,
    isHome: false,
    internalPage: "error",
    errorCode,
    errorDescription,
    errorUrl,
  });
  updateViewBounds(window);
}

export function setWebFullScreen(
  window: BrowserWindow,
  tabId: string,
  enabled: boolean,
) {
  const state = getBrowserState(window);
  if (enabled) {
    state.webFullScreenTabId = tabId;
    state.wasFullScreenBeforeWeb = window.isFullScreen();
    if (!window.isFullScreen()) window.setFullScreen(true);
  } else if (state.webFullScreenTabId === tabId) {
    state.webFullScreenTabId = null;
    if (!state.wasFullScreenBeforeWeb && window.isFullScreen())
      window.setFullScreen(false);
  }
  if (!window.webContents.isDestroyed()) {
    window.webContents.send("window:web-full-screen-changed", enabled);
  }
  updateViewBounds(window);
}

export function updateViewBounds(window: BrowserWindow) {
  const state = getBrowserState(window);
  updateWebviewBounds(window, {
    companionMode: state.companionMode,
    activeTabId: state.activeTabId,
    internalTabIds: state.internalPages,
    layout: state.layout,
    splitTabId: state.splitTabId,
    views: state.views,
    webFullScreenTabId: state.webFullScreenTabId,
  });
}

export function createTabView(window: BrowserWindow, tabId: string) {
  const state = getBrowserState(window);
  const existingRecord = state.views.get(tabId);

  if (existingRecord) {
    return existingRecord;
  }

  const record = createWebview(window);
  const { view } = record;
  registerBlockerContents(view.webContents);
  state.views.set(tabId, record);

  view.webContents.on("did-start-loading", () => {
    if (getBrowserState(window).internalPages.has(tabId)) return;
    sendTabUpdate(window, { id: tabId, isLoading: true });
  });
  view.webContents.on("did-stop-loading", () => {
    if (getBrowserState(window).internalPages.has(tabId)) return;
    sendTabUpdate(window, { id: tabId, isLoading: false });
    sendNavigationState(window, tabId, record);
    captureTabNavigation(window, tabId);
  });
  view.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      if (canRecoverQuicFailure(view.webContents, errorCode)) return;
      showErrorPage(
        window,
        tabId,
        validatedURL || view.webContents.getURL(),
        errorCode,
        errorDescription,
      );
    },
  );
  view.webContents.on("did-navigate", () => {
    sendNavigationState(window, tabId, record);
  });
  view.webContents.on("did-navigate-in-page", () => {
    sendNavigationState(window, tabId, record);
  });
  view.webContents.on("will-navigate", (event, url) => {
    const internalPage = parseInternalPage(url);
    if (!internalPage) return;

    event.preventDefault();
    showInternalPage(window, tabId, internalPage);
  });
  view.webContents.on("page-title-updated", (_event, title) => {
    if (getBrowserState(window).internalPages.has(tabId)) return;
    sendTabUpdate(window, { id: tabId, title });
  });
  view.webContents.on("page-favicon-updated", (_event, favicons) => {
    if (getBrowserState(window).internalPages.has(tabId)) return;
    const faviconUrl = favicons[0];

    if (faviconUrl) {
      sendTabUpdate(window, { id: tabId, faviconUrl });
    }
  });
  view.webContents.on("found-in-page", (_event, result) => {
    if (!window.webContents.isDestroyed()) {
      window.webContents.send("find-in-page:result", {
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
      });
    }
  });
  view.webContents.on("enter-html-full-screen", () => {
    setWebFullScreen(window, tabId, true);
  });
  view.webContents.on("leave-html-full-screen", () => {
    setWebFullScreen(window, tabId, false);
  });
  view.webContents.on("context-menu", (event, params) => {
    event.preventDefault();
    const bounds = view.getBounds();

    void showPageContextMenu(
      window,
      view.webContents,
      {
        height: 0,
        width: 0,
        x: bounds.x + params.x,
        y: bounds.y + params.y,
      },
      nativeTheme.shouldUseDarkColors ? "dark" : "light",
      { x: params.x, y: params.y },
      params,
    );
  });
  view.webContents.setWindowOpenHandler(({ url }) => {
    const internalPage = parseInternalPage(url);
    if (
      (internalPage || isAllowedNavigationUrl(url)) &&
      !window.webContents.isDestroyed()
    )
      window.webContents.send("tabs:open-requested", url);
    return { action: "deny" };
  });

  return record;
}

export function getTabRecord(sender: WebContents, tabId: string) {
  const window = getWindowFromSender(sender);

  if (!window) {
    return null;
  }

  return {
    record: getBrowserState(window).views.get(tabId),
    window,
  };
}

export function isAllowedNavigationUrl(value: string) {
  try {
    parseHttpUrl(value);
    return true;
  } catch {
    return false;
  }
}

let quitting = false;
app.on("before-quit", () => {
  quitting = true;
});

export const createWindow = (sessionId: string = crypto.randomUUID()) => {
  const restored = getRestoredWindowOptions(sessionId);
  const mainWindow = new BrowserWindow({
    show: false,
    title: APP_NAME,
    icon: getRuntimeAppIconPath(),
    width: restored.width,
    height: restored.height,
    ...(restored.x === undefined ? {} : { x: restored.x, y: restored.y }),
    minWidth: 1280,
    minHeight: 720,
    frame: true,
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 21, y: 21 } }
      : {
          titleBarOverlay: {
            color: "#00000000",
            symbolColor: "#a1a1aa",
            height: 56,
          },
        }),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#171717" : "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on("will-navigate", (event, destination) => {
    try {
      const renderer = new URL(appUrl || MAIN_WINDOW_VITE_DEV_SERVER_URL);
      if (new URL(destination).origin !== renderer.origin)
        event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  installPortal(mainWindow);
  mainWindow.webContents.on(
    "did-start-navigation",
    (_event, _url, inPlace, isMainFrame) => {
      if (isMainFrame && !inPlace) dismissPortalMenuForParent(mainWindow);
    },
  );
  browserStates.set(mainWindow.id, {
    preferences: defaultBrowserPreferences,
    tabMetadata: new Map(),
    groupedTabIds: new Set(),
    archivedTabIds: new Set(),
    sessionId,
    companionMode: "split",
    activeTabId: null,
    internalPages: new Map(),
    splitTabId: null,
    layout: {
      top: 112,
      sidebarWidth: 0,
      sidebarSide: "left",
      verticalTabsWidth: 0,
    },
    views: new Map(),
    webFullScreenTabId: null,
    wasFullScreenBeforeWeb: false,
  });
  trackTabLifecycle(mainWindow);

  const notifyFullScreenChanged = () => {
    if (!mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send(
        "window:full-screen-changed",
        mainWindow.isFullScreen(),
      );
    }
  };

  let saveWindowTimer: ReturnType<typeof setTimeout> | null = null;
  const persistWindow = () => {
    if (mainWindow.isDestroyed() || mainWindow.isFullScreen()) return;
    if (saveWindowTimer) clearTimeout(saveWindowTimer);
    saveWindowTimer = setTimeout(() => {
      const bounds = mainWindow.getNormalBounds();
      saveWindowState(
        { ...bounds, isMaximized: mainWindow.isMaximized() },
        sessionId,
      );
    }, 250);
  };
  mainWindow.on("resize", () => {
    dismissPortalMenuForParent(mainWindow);
    updateViewBounds(mainWindow);
    persistWindow();
  });
  mainWindow.on("move", persistWindow);
  mainWindow.on("maximize", persistWindow);
  mainWindow.on("unmaximize", persistWindow);
  mainWindow.on("close", () => {
    dismissPortalMenuForParent(mainWindow);
    if (saveWindowTimer) clearTimeout(saveWindowTimer);
    const bounds = mainWindow.getNormalBounds();
    saveWindowState(
      { ...bounds, isMaximized: mainWindow.isMaximized() },
      sessionId,
    );
    setWindowOpen(sessionId, quitting || getBrowserWindows().length === 1);
  });
  mainWindow.on("enter-full-screen", notifyFullScreenChanged);
  mainWindow.on("leave-full-screen", notifyFullScreenChanged);
  mainWindow.on("closed", () => {
    for (const record of getBrowserState(mainWindow).views.values()) {
      if (!record.view.webContents.isDestroyed())
        record.view.webContents.close({ waitForBeforeUnload: false });
    }
    browserStates.delete(mainWindow.id);
  });
  mainWindow.once("ready-to-show", () => {
    saveWindowState(
      { ...mainWindow.getNormalBounds(), isMaximized: restored.shouldMaximize },
      sessionId,
    );
    setWindowOpen(sessionId, true);
    if (restored.shouldMaximize) mainWindow.maximize();
    mainWindow.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL || appUrl) {
    void mainWindow.loadURL(
      new URL("assets/index.html", appUrl || MAIN_WINDOW_VITE_DEV_SERVER_URL)
        .href,
    );
  } else {
    void mainWindow.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/assets/index.html`,
      ),
    );
  }
};
