import {
  BrowserWindow,
  clipboard,
  ipcMain,
  type ContextMenuParams,
  type WebContents,
} from "electron";
import type {
  AddressBarContextMenuCommand,
  AddressBarContextMenuState,
  BrowserMenuCommand,
  BrowserMenuState,
  PageContextMenuCommand,
  PortalMenuAnchor,
  PortalMenuState,
  PortalMenuTabItem,
  PortalMenuTheme,
  TabContextMenuCommand,
  TitlebarContextMenuCommand,
  TitlebarContextMenuState,
} from "@/lib/browser/browser-menu";
import {
  getWindowFromSender,
  getBrowserState,
  isAllowedNavigationUrl,
} from "@/main/windows/capital";
import { saveImageAs } from "@/main/services/downloads";

interface MenuRequest {
  id: number;
  state: PortalMenuState;
  resolve: (value: string | null) => void;
  focusTarget: WebContents;
}

const menuRequests = new Map<number, MenuRequest>();

let nextMenuRequestId = 0;

const addressBarContextMenuCommands = new Set<AddressBarContextMenuCommand>([
  "undo",
  "redo",
  "cut",
  "copy",
  "paste",
  "select-all",
]);

const browserMenuCommands = new Set<BrowserMenuCommand>([
  "new-tab",
  "home",
  "bookmark",
  "bookmarks",
  "history",
  "downloads",
  "toggle-sidebar",
  "toggle-split",
  "settings",
]);

const tabContextMenuCommands = new Set<TabContextMenuCommand>([
  "sleep-tab",
  "archive-tab",
  "toggle-pin-tab",
  "reload-tab",
  "toggle-mute-tab",
  "close-tab",
  "close-other-tabs",
]);

const pageContextMenuCommands = new Set<PageContextMenuCommand>([
  "back",
  "forward",
  "reload",
  "open-link-new-tab",
  "copy-link-address",
  "open-image-new-tab",
  "copy-image",
  "save-image-as",
  "copy-image-address",
  "copy-selection",
  "undo",
  "redo",
  "cut",
  "copy",
  "paste",
  "select-all",
  "open-devtools",
  "inspect-element",
]);

const titlebarContextMenuCommands = new Set<TitlebarContextMenuCommand>([
  "new-tab",
  "reload-tab",
  "toggle-mute-tab",
  "close-tab",
]);

export function dismissPortalMenuForParent(parent: BrowserWindow) {
  const request = menuRequests.get(parent.id);
  menuRequests.delete(parent.id);
  if (!parent.webContents.isDestroyed())
    parent.webContents.send("menu-portal:request", null);
  request?.resolve(null);
}

function openPortalMenu(
  parent: BrowserWindow,
  state: PortalMenuState,
  anchor: PortalMenuAnchor,
  focusTarget: WebContents = parent.webContents,
) {
  const previous = menuRequests.get(parent.id);
  dismissPortalMenuForParent(parent);
  if (
    previous?.state.kind === state.kind &&
    ["browser-menu", "tab-list", "site-info"].includes(state.kind)
  )
    return Promise.resolve(null);
  const id = ++nextMenuRequestId;
  return new Promise<string | null>((resolve) => {
    menuRequests.set(parent.id, { id, state, resolve, focusTarget });
    parent.webContents.send("menu-portal:request", { id, state, anchor });
  });
}

function isPortalMenuSelectionValid(state: PortalMenuState, value: string) {
  switch (state.kind) {
    case "site-info":
      return value === "settings";
    case "address-bar-context":
      return addressBarContextMenuCommands.has(
        value as AddressBarContextMenuCommand,
      );
    case "browser-menu":
      return browserMenuCommands.has(value as BrowserMenuCommand);
    case "tab-list":
      return state.tabs.some((tab) => tab.id === value);
    case "tab-context":
      return tabContextMenuCommands.has(value as TabContextMenuCommand);
    case "page-context":
      return pageContextMenuCommands.has(value as PageContextMenuCommand);
    case "titlebar-context":
      return titlebarContextMenuCommands.has(
        value as TitlebarContextMenuCommand,
      );
  }
}

function runAddressBarCommand(
  target: WebContents,
  command: AddressBarContextMenuCommand,
) {
  const actions: Record<AddressBarContextMenuCommand, () => void> = {
    undo: () => target.undo(),
    redo: () => target.redo(),
    cut: () => target.cut(),
    copy: () => target.copy(),
    paste: () => target.paste(),
    "select-all": () => target.selectAll(),
  };

  target.focus();
  actions[command]();
}

export async function showPageContextMenu(
  parent: BrowserWindow,
  target: WebContents,
  anchor: PortalMenuAnchor,
  theme: PortalMenuTheme,
  inspectPoint: { x: number; y: number },
  parameters?: ContextMenuParams,
) {
  const history = target.navigationHistory;
  const editFlags = parameters?.editFlags;
  const linkUrl = isAllowedNavigationUrl(parameters?.linkURL ?? "")
    ? (parameters?.linkURL ?? "")
    : "";
  const imageUrl = parameters?.hasImageContents ? parameters.srcURL : "";
  const selectionText = parameters?.selectionText.trim() ?? "";
  const command = (await openPortalMenu(
    parent,
    {
      canCopy: Boolean(editFlags?.canCopy),
      canCut: Boolean(editFlags?.canCut),
      canGoBack: history.canGoBack(),
      canGoForward: history.canGoForward(),
      canPaste: Boolean(editFlags?.canPaste),
      canRedo: Boolean(editFlags?.canRedo),
      canReload: Boolean(target.getURL()),
      canSelectAll: Boolean(editFlags?.canSelectAll),
      canUndo: Boolean(editFlags?.canUndo),
      imageUrl,
      isEditable: Boolean(parameters?.isEditable),
      kind: "page-context",
      linkUrl,
      selectionText,
      theme,
    },
    anchor,
    target,
  )) as PageContextMenuCommand | null;

  if (!command || target.isDestroyed()) return;

  switch (command) {
    case "back":
      if (history.canGoBack()) history.goBack();
      break;
    case "forward":
      if (history.canGoForward()) history.goForward();
      break;
    case "reload":
      target.reload();
      break;
    case "open-link-new-tab":
      if (linkUrl) parent.webContents.send("tabs:open-requested", linkUrl);
      break;
    case "copy-link-address":
      if (linkUrl) clipboard.writeText(linkUrl);
      break;
    case "open-image-new-tab":
      if (isAllowedNavigationUrl(imageUrl)) {
        parent.webContents.send("tabs:open-requested", imageUrl);
      }
      break;
    case "copy-image":
      target.copyImageAt(inspectPoint.x, inspectPoint.y);
      break;
    case "save-image-as":
      if (imageUrl) saveImageAs(target, imageUrl);
      break;
    case "copy-image-address":
      if (imageUrl) clipboard.writeText(imageUrl);
      break;
    case "copy-selection":
      target.copy();
      break;
    case "undo":
      target.undo();
      break;
    case "redo":
      target.redo();
      break;
    case "cut":
      target.cut();
      break;
    case "copy":
      target.copy();
      break;
    case "paste":
      target.paste();
      break;
    case "select-all":
      target.selectAll();
      break;
    case "open-devtools":
      target.openDevTools({ mode: "detach" });
      break;
    case "inspect-element":
      target.inspectElement(inspectPoint.x, inspectPoint.y);
      break;
  }
}

export function registerContextMenuIpc() {
  ipcMain.handle(
    "address-bar-context-menu:open",
    async (
      event,
      menu: AddressBarContextMenuState,
      anchor: PortalMenuAnchor,
      theme: PortalMenuTheme,
    ) => {
      const window = getWindowFromSender(event.sender);
      if (!window) return null;

      const command = (await openPortalMenu(
        window,
        {
          canCopy: Boolean(menu.canCopy),
          canCut: Boolean(menu.canCut),
          canSelectAll: Boolean(menu.canSelectAll),
          kind: "address-bar-context",
          theme: theme === "dark" ? "dark" : "light",
        },
        anchor,
        event.sender,
      )) as AddressBarContextMenuCommand | null;

      if (command && !event.sender.isDestroyed()) {
        runAddressBarCommand(event.sender, command);
      }

      return command;
    },
  );
  ipcMain.handle("clipboard:write-text", (event, value: string) => {
    if (!getWindowFromSender(event.sender) || typeof value !== "string") return;
    clipboard.writeText(value);
  });
  ipcMain.handle(
    "site-info:open",
    async (
      event,
      tabId: string,
      anchor: PortalMenuAnchor,
      theme: PortalMenuTheme,
    ) => {
      const parent = getWindowFromSender(event.sender);
      if (!parent) return null;
      const browser = getBrowserState(parent);
      if (browser.internalPages.has(tabId)) return null;
      const contents = browser.views.get(tabId)?.view.webContents;
      if (!contents || contents.isDestroyed()) return null;
      const address = contents.getURL();
      if (!isAllowedNavigationUrl(address)) return null;
      const url = new URL(address);
      let cookieCount: number | null = null;
      try {
        cookieCount = (await contents.session.cookies.get({ url: address }))
          .length;
      } catch {
        /* Cookie information may be unavailable during navigation. */
      }
      if (
        parent.isDestroyed() ||
        contents.isDestroyed() ||
        contents.getURL() !== address
      )
        return null;
      return openPortalMenu(
        parent,
        {
          kind: "site-info",
          hostname: url.hostname,
          https: url.protocol === "https:",
          cookieCount,
          theme: theme === "dark" ? "dark" : "light",
        },
        anchor,
        event.sender,
      );
    },
  );
  ipcMain.handle(
    "browser-menu:open",
    (
      event,
      menu: BrowserMenuState,
      anchor: PortalMenuAnchor,
      theme: PortalMenuTheme,
    ) => {
      const window = getWindowFromSender(event.sender);
      if (!window) return null;

      return openPortalMenu(
        window,
        {
          kind: "browser-menu",
          menu,
          theme: theme === "dark" ? "dark" : "light",
        },
        anchor,
        event.sender,
      );
    },
  );
  ipcMain.handle(
    "tab-list-menu:open",
    (
      event,
      activeTabId: string,
      tabs: PortalMenuTabItem[],
      anchor: PortalMenuAnchor,
      theme: PortalMenuTheme,
    ) => {
      const window = getWindowFromSender(event.sender);
      if (!window) return null;

      return openPortalMenu(
        window,
        {
          activeTabId,
          kind: "tab-list",
          tabs,
          theme: theme === "dark" ? "dark" : "light",
        },
        anchor,
        event.sender,
      );
    },
  );
  ipcMain.handle(
    "tab-context-menu:open",
    (
      event,
      title: string,
      isMuted: boolean,
      isPinned: boolean,
      canReload: boolean,
      canCloseOtherTabs: boolean,
      anchor: PortalMenuAnchor,
      theme: PortalMenuTheme,
      canSleep = false,
    ) => {
      const window = getWindowFromSender(event.sender);
      if (!window) return null;

      return openPortalMenu(
        window,
        {
          canCloseOtherTabs,
          canReload,
          isMuted,
          isPinned,
          kind: "tab-context",
          canSleep: Boolean(canSleep && canReload && !isPinned),
          theme: theme === "dark" ? "dark" : "light",
          title,
        },
        anchor,
        event.sender,
      );
    },
  );
  ipcMain.handle(
    "page-context-menu:open",
    async (event, anchor: PortalMenuAnchor, theme: PortalMenuTheme) => {
      const window = getWindowFromSender(event.sender);
      if (!window) return;

      await showPageContextMenu(
        window,
        event.sender,
        anchor,
        theme === "dark" ? "dark" : "light",
        { x: anchor.x, y: anchor.y },
      );
    },
  );
  ipcMain.handle(
    "titlebar-context-menu:open",
    (
      event,
      menu: TitlebarContextMenuState,
      anchor: PortalMenuAnchor,
      theme: PortalMenuTheme,
    ) => {
      const window = getWindowFromSender(event.sender);
      if (!window) return null;

      return openPortalMenu(
        window,
        {
          canClose: Boolean(menu.canClose),
          canReload: Boolean(menu.canReload),
          isMuted: Boolean(menu.isMuted),
          kind: "titlebar-context",
          theme: theme === "dark" ? "dark" : "light",
        },
        anchor,
        event.sender,
      );
    },
  );
  ipcMain.on(
    "menu-portal:result",
    (event, id: number, value: string | null) => {
      const parent = getWindowFromSender(event.sender);
      if (!parent || event.sender !== parent.webContents) return;
      const request = menuRequests.get(parent.id);
      if (!request || request.id !== id) return;
      if (value !== null && !isPortalMenuSelectionValid(request.state, value))
        return;
      menuRequests.delete(parent.id);
      if (value !== null && !request.focusTarget.isDestroyed())
        request.focusTarget.focus();
      request.resolve(value);
    },
  );
}
