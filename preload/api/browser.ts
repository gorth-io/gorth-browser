import { ipcRenderer } from "electron";
import type {
  AddressBarContextMenuCommand,
  AddressBarContextMenuState,
  BrowserMenuCommand,
  BrowserMenuState,
  PortalMenuAnchor,
  PortalMenuTabItem,
  PortalMenuTheme,
  TitlebarContextMenuCommand,
  TitlebarContextMenuState,
} from "@/lib/browser/browser-menu";
import type { BrowserLayout, BrowserTabState } from "@/preload/interface";
export const appActionsApi = {
  onAction: (callback: (action: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string) =>
      callback(action);
    ipcRenderer.on("app:action", listener);
    return () => {
      ipcRenderer.removeListener("app:action", listener);
    };
  },
};
export const findInPageApi = {
  find: (tabId: string, text: string, forward: boolean, findNext: boolean) =>
    ipcRenderer.invoke(
      "find-in-page:find",
      tabId,
      text,
      forward,
      findNext,
    ) as Promise<{
      activeMatchOrdinal: number;
      matches: number;
    } | null>,
  stop: (tabId: string) => ipcRenderer.send("find-in-page:stop", tabId),
  onResult: (
    callback: (result: { activeMatchOrdinal: number; matches: number }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      result: { activeMatchOrdinal: number; matches: number },
    ) => callback(result);
    ipcRenderer.on("find-in-page:result", listener);
    return () => {
      ipcRenderer.removeListener("find-in-page:result", listener);
    };
  },
};
export const siteInfoApi = {
  open: (tabId: string, anchor: PortalMenuAnchor, theme: PortalMenuTheme) =>
    ipcRenderer.invoke("site-info:open", tabId, anchor, theme) as Promise<
      "settings" | null
    >,
};
export const clipboardApi = {
  writeText: (value: string) =>
    ipcRenderer.invoke("clipboard:write-text", value) as Promise<void>,
};
export const addressBarMenuApi = {
  open: (
    state: AddressBarContextMenuState,
    anchor: PortalMenuAnchor,
    theme: PortalMenuTheme,
  ) =>
    ipcRenderer.invoke(
      "address-bar-context-menu:open",
      state,
      anchor,
      theme,
    ) as Promise<AddressBarContextMenuCommand | null>,
};
export const tabsApi = {
  setLayout: (layout: BrowserLayout) =>
    ipcRenderer.send("tabs:set-layout", layout),
  activate: (tabId: string) => ipcRenderer.send("tabs:activate", tabId),
  navigate: (tabId: string, url: string) =>
    ipcRenderer.invoke("tabs:navigate", tabId, url) as Promise<boolean>,
  home: (tabId: string) => ipcRenderer.send("tabs:home", tabId),
  back: (tabId: string) => ipcRenderer.send("tabs:back", tabId),
  forward: (tabId: string) => ipcRenderer.send("tabs:forward", tabId),
  reload: (tabId: string) => ipcRenderer.send("tabs:reload", tabId),
  forceReload: (tabId: string) => ipcRenderer.send("tabs:force-reload", tabId),
  stop: (tabId: string) => ipcRenderer.send("tabs:stop", tabId),
  setMuted: (tabId: string, muted: boolean) =>
    ipcRenderer.send("tabs:set-muted", tabId, muted),
  setSplit: (tabId: string | null) => ipcRenderer.send("tabs:set-split", tabId),
  close: (tabId: string) => ipcRenderer.send("tabs:close", tabId),
  openContextMenu: (
    title: string,
    isMuted: boolean,
    isPinned: boolean,
    canReload: boolean,
    canCloseOtherTabs: boolean,
    anchor: PortalMenuAnchor,
    theme: PortalMenuTheme,
  ) =>
    ipcRenderer.invoke(
      "tab-context-menu:open",
      title,
      isMuted,
      isPinned,
      canReload,
      canCloseOtherTabs,
      anchor,
      theme,
    ) as Promise<string | null>,
  openListMenu: (
    activeTabId: string,
    tabs: PortalMenuTabItem[],
    anchor: PortalMenuAnchor,
    theme: PortalMenuTheme,
  ) =>
    ipcRenderer.invoke(
      "tab-list-menu:open",
      activeTabId,
      tabs,
      anchor,
      theme,
    ) as Promise<string | null>,
  onUpdated: (
    callback: (tab: Partial<BrowserTabState> & { id: string }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      tab: Partial<BrowserTabState> & { id: string },
    ) => callback(tab);

    ipcRenderer.on("tabs:updated", listener);

    return () => {
      ipcRenderer.removeListener("tabs:updated", listener);
    };
  },
  onOpenRequested: (callback: (url: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) =>
      callback(url);

    ipcRenderer.on("tabs:open-requested", listener);

    return () => {
      ipcRenderer.removeListener("tabs:open-requested", listener);
    };
  },
};
export const browserMenuApi = {
  open: (
    state: BrowserMenuState,
    anchor: PortalMenuAnchor,
    theme: PortalMenuTheme,
  ) =>
    ipcRenderer.invoke(
      "browser-menu:open",
      state,
      anchor,
      theme,
    ) as Promise<BrowserMenuCommand | null>,
};
export const pageMenuApi = {
  open: (anchor: PortalMenuAnchor, theme: PortalMenuTheme) =>
    ipcRenderer.invoke(
      "page-context-menu:open",
      anchor,
      theme,
    ) as Promise<void>,
};
export const titlebarMenuApi = {
  open: (
    state: TitlebarContextMenuState,
    anchor: PortalMenuAnchor,
    theme: PortalMenuTheme,
  ) =>
    ipcRenderer.invoke(
      "titlebar-context-menu:open",
      state,
      anchor,
      theme,
    ) as Promise<TitlebarContextMenuCommand | null>,
};
