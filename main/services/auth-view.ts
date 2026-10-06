import { BrowserWindow, WebContentsView, ipcMain, session } from "electron";
import {
  ssoClientUrl,
  ssoServerUrl,
  ssoRedirectUri,
} from "@/lib/utils/environment";
import type { AuthViewBounds, AuthViewState } from "@/lib/auth/view-types";

// SSO cookies are transient; durable tokens live only in the encrypted vault.
// Avoid a second Keychain-backed cookie store just to display the login form.
const partition = "gorth-sso";
function publicAuthUrl(value: string) {
  const url = new URL(value);
  const redirect = url.searchParams.get("redirect");
  url.search = "";
  url.hash = "";
  if (redirect === "gorth://auth") url.searchParams.set("redirect", redirect);
  return url.href;
}
interface AuthViewEntry {
  tabId?: string;
  detachTab?: () => void;
  cancel: () => void;
  view: WebContentsView;
  state: AuthViewState;
  close: (completed?: boolean) => void;
}
const entries = new Map<BrowserWindow, AuthViewEntry>();
const results = new WeakMap<BrowserWindow, AuthViewState>();
let attachTab:
  | ((window: BrowserWindow, id: string, view: WebContentsView) => () => void)
  | undefined;

export function registerAuthTabHost(host: NonNullable<typeof attachTab>) {
  attachTab = host;
}

export function isAuthTab(window: BrowserWindow, id: string) {
  return entries.get(window)?.tabId === id;
}

export function cancelAuthTab(window: BrowserWindow, id: string) {
  const entry = entries.get(window);
  if (entry?.tabId === id) entry.cancel();
}

export function attachAuthTab(window: BrowserWindow, id: string) {
  const entry = entries.get(window);
  if (!entry || !attachTab || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) return false;
  if (entry.tabId) return entry.tabId === id;
  entry.tabId = id;
  entry.detachTab = attachTab(window, id, entry.view);
  return true;
}
const hidden: AuthViewState = {
  visible: false,
  mode: "login",
  loading: false,
  verifying: false,
  error: "",
};

export function allowedAuthNavigation(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      return false;
    if (
      url.username ||
      url.password ||
      !["http:", "https:"].includes(url.protocol)
    )
      return false;
    const callback = new URL(ssoRedirectUri);
    if (url.origin === callback.origin)
      return url.pathname === callback.pathname && !url.hash;
    return [ssoClientUrl, ssoServerUrl]
      .filter(Boolean)
      .some((origin) => url.origin === new URL(origin).origin);
  } catch {
    return false;
  }
}

export function closeAuthView(window: BrowserWindow, completed = false) {
  entries.get(window)?.close(completed);
}

export async function clearAuthBrowserSession() {
  await session.fromPartition(partition).clearStorageData();
}

export async function openAuthView(
  window: BrowserWindow,
  url: string,
  receiveCallback: (url: string) => boolean,
  controller: AbortController,
  mode: "login" | "register",
) {
  controller.signal.throwIfAborted();
  if (window.isDestroyed()) throw new Error("Cửa sổ xác thực đã đóng.");
  if (!allowedAuthNavigation(url))
    throw new Error("Địa chỉ SSO không được phép.");
  closeAuthView(window);
  const isolated = session.fromPartition(partition);
  isolated.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  isolated.setPermissionCheckHandler(() => false);
  const blockDownload = (event: Electron.Event) => event.preventDefault();
  isolated.on("will-download", blockDownload);
  const view = new WebContentsView({
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
    },
  });
  const state: AuthViewState = {
    url: publicAuthUrl(url),
    visible: true,
    mode,
    loading: true,
    verifying: false,
    error: "",
  };
  const notify = () => {
    if (
      entries.get(window)?.view === view &&
      !window.isDestroyed() &&
      !window.webContents.isDestroyed()
    )
      window.webContents.send("auth:view-changed", { ...state });
  };
  const close = (completed = false) => {
    if (entries.get(window)?.view !== view) return;
    const entry = entries.get(window)!;
    entries.delete(window);
    entry.detachTab?.();
    results.set(window, { ...hidden, mode, completed });
    controller.signal.removeEventListener("abort", abortClosed);
    window.removeListener("closed", parentClosed);
    isolated.removeListener("will-download", blockDownload);
    if (!window.isDestroyed()) window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed())
      view.webContents.close({ waitForBeforeUnload: false });
    if (!window.isDestroyed())
      window.webContents.send("auth:view-changed", {
        ...hidden,
        mode,
        completed,
      });
  };
  const parentClosed = () => {
    controller.abort();
    close();
  };
  const abortClosed = () => close();
  entries.set(window, { view, state, close, cancel: () => controller.abort() });
  results.delete(window);
  controller.signal.addEventListener("abort", abortClosed, { once: true });
  window.once("closed", parentClosed);
  window.contentView.addChildView(view);
  const resize = () => {
    if (window.isDestroyed()) return;
    const [width, height] = window.getContentSize();
    view.setBounds({ x: 0, y: 112, width, height: Math.max(0, height - 112) });
  };
  resize();
  const navigate = (target: string): boolean => {
    if (!allowedAuthNavigation(target)) {
      state.error = "Chỉ cho phép xác thực trên Gorth SSO trong cửa sổ này.";
      state.loading = false;
      notify();
      return false;
    }
    const destination = new URL(target);
    const callback = new URL(ssoRedirectUri);
    if (
      destination.origin === callback.origin &&
      destination.pathname === callback.pathname
    ) {
      if (receiveCallback(target)) {
        state.verifying = true;
        state.loading = true;
        view.setVisible(false);
      } else {
        state.error = "Phản hồi xác thực không hợp lệ. Hãy hủy và thử lại.";
        state.loading = false;
      }
      notify();
      return false;
    }
    state.error = "";
    return true;
  };
  const guard = (event: Electron.Event, target: string) => {
    if (!navigate(target)) event.preventDefault();
  };
  view.webContents.on("will-navigate", guard);
  view.webContents.on("will-redirect", guard);
  view.webContents.on("did-navigate", (_event, target: string) => {
    if (!allowedAuthNavigation(target)) return;
    // Never send OAuth query parameters to the renderer or persisted tabs.
    state.url = publicAuthUrl(target);
    notify();
  });
  view.webContents.on("will-attach-webview", (event) => event.preventDefault());
  // Always deny new windows. Gorth links remain in this same embedded view.
  view.webContents.setWindowOpenHandler(({ url: target }) => {
    if (navigate(target)) {
      void view.webContents.loadURL(target).catch(() => {
        state.error = "Không tải được trang xác thực.";
        state.loading = false;
        notify();
      });
    }
    return { action: "deny" };
  });
  view.webContents.on("did-start-loading", () => {
    state.loading = true;
    notify();
  });
  view.webContents.on("did-stop-loading", () => {
    if (!state.verifying) state.loading = false;
    notify();
  });
  view.webContents.on(
    "did-fail-load",
    (_event, code, _description, _url, mainFrame) => {
      if (!mainFrame || code === -3 || state.verifying) return;
      state.loading = false;
      state.error =
        "Không kết nối được trang SSO. Kiểm tra kết nối rồi tải lại.";
      notify();
    },
  );
  view.webContents.on("render-process-gone", () => {
    state.loading = false;
    state.error = "Trang xác thực đã dừng. Hãy tải lại hoặc hủy.";
    notify();
  });
  notify();
  // Loading the SSO UI must not block the main-process authorization promise.
  void view.webContents.loadURL(url).catch(() => {
    if (!entries.has(window) || state.verifying || controller.signal.aborted)
      return;
    state.loading = false;
    state.error = "Không tải được trang SSO. Hãy tải lại hoặc hủy.";
    notify();
  });
}

export function registerAuthViewIpc(
  trusted: (event: Electron.IpcMainInvokeEvent) => BrowserWindow,
) {
  ipcMain.handle("auth:view-tab", (event, id: unknown) => {
    const window = trusted(event);
    return typeof id === "string" && attachAuthTab(window, id);
  });
  ipcMain.handle("auth:view-visible", (event, visible: unknown) => {
    const entry = entries.get(trusted(event));
    if (!entry || typeof visible !== "boolean") return;
    entry.view.setVisible(visible && !entry.state.verifying);
  });
  ipcMain.handle("auth:view-state", (event) => {
    const window = trusted(event);
    return entries.get(window)?.state ?? results.get(window) ?? hidden;
  });
  ipcMain.handle("auth:view-bounds", (event, value: unknown) => {
    const window = trusted(event);
    const entry = entries.get(window);
    if (!entry) return;
    const bounds = value as AuthViewBounds | null;
    if (
      !bounds ||
      !["x", "y", "width", "height"].every(
        (key) =>
          Number.isFinite(bounds[key as keyof AuthViewBounds]) &&
          Number.isInteger(bounds[key as keyof AuthViewBounds]),
      )
    )
      return;
    const [width, height] = window.getContentSize();
    if (
      bounds.x < 0 ||
      bounds.y < 56 ||
      bounds.width < 1 ||
      bounds.height < 1 ||
      bounds.x + bounds.width > width + 1 ||
      bounds.y + bounds.height > height + 1
    )
      return;
    entry.view.setBounds(bounds);
    if (!entry.state.verifying) {
      // Re-add at the top so ordinary browser tab layouts cannot cover auth.
      window.contentView.addChildView(entry.view);
      entry.view.setVisible(true);
    }
  });
  ipcMain.handle("auth:view-reload", (event) => {
    const entry = entries.get(trusted(event));
    if (!entry || entry.state.verifying) return;
    entry.state.error = "";
    entry.view.webContents.reload();
  });
}
