import type { BrowserInternalPage } from "@/lib/browser/internal-pages";

interface BrowserMenuState {
  canBookmark: boolean;
  canShowSidebar: boolean;
  canSplit: boolean;
  isSidebarOpen: boolean;
  isSplit: boolean;
}

interface PortalMenuAnchor {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface PortalMenuTabItem {
  internalPage: BrowserInternalPage | null;
  faviconUrl: string;
  id: string;
  isLoading: boolean;
  isMuted: boolean;
  title: string;
}

type PortalMenuTheme = "dark" | "light";

interface AddressBarContextMenuState {
  canCopy: boolean;
  canCut: boolean;
  canSelectAll: boolean;
}

type AddressBarContextMenuCommand =
  "undo" | "redo" | "cut" | "copy" | "paste" | "select-all";

interface AddressBarContextPortalState extends AddressBarContextMenuState {
  kind: "address-bar-context";
  theme: PortalMenuTheme;
}

interface BrowserMenuPortalState {
  kind: "browser-menu";
  menu: BrowserMenuState;
  theme: PortalMenuTheme;
}

interface TabListPortalState {
  activeTabId: string;
  kind: "tab-list";
  tabs: PortalMenuTabItem[];
  theme: PortalMenuTheme;
}

type TabContextMenuCommand =
  | "sleep-tab"
  | "archive-tab"
  | "reload-tab"
  | "toggle-mute-tab"
  | "toggle-pin-tab"
  | "close-tab"
  | "close-other-tabs";

interface TabContextPortalState {
  canSleep: boolean;
  isPinned: boolean;
  canCloseOtherTabs: boolean;
  canReload: boolean;
  isMuted: boolean;
  kind: "tab-context";
  theme: PortalMenuTheme;
  title: string;
}

type PageContextMenuCommand =
  | "back"
  | "forward"
  | "reload"
  | "open-link-new-tab"
  | "copy-link-address"
  | "open-image-new-tab"
  | "copy-image"
  | "save-image-as"
  | "copy-image-address"
  | "copy-selection"
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "select-all"
  | "open-devtools"
  | "inspect-element";

interface PageContextPortalState {
  canCopy: boolean;
  canCut: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  canPaste: boolean;
  canRedo: boolean;
  canReload: boolean;
  canSelectAll: boolean;
  canUndo: boolean;
  imageUrl: string;
  isEditable: boolean;
  kind: "page-context";
  linkUrl: string;
  selectionText: string;
  theme: PortalMenuTheme;
}

interface TitlebarContextMenuState {
  canClose: boolean;
  canReload: boolean;
  isMuted: boolean;
}

type TitlebarContextMenuCommand =
  "new-tab" | "reload-tab" | "toggle-mute-tab" | "close-tab";

interface TitlebarContextPortalState extends TitlebarContextMenuState {
  kind: "titlebar-context";
  theme: PortalMenuTheme;
}

type PortalMenuState =
  | {
      kind: "site-info";
      hostname: string;
      https: boolean;
      cookieCount: number | null;
      theme: PortalMenuTheme;
    }
  | BrowserMenuPortalState
  | TabListPortalState
  | TabContextPortalState
  | PageContextPortalState
  | AddressBarContextPortalState
  | TitlebarContextPortalState;

type BrowserMenuCommand =
  | "new-tab"
  | "home"
  | "bookmark"
  | "bookmarks"
  | "history"
  | "downloads"
  | "toggle-sidebar"
  | "toggle-split"
  | "settings";

function getPortalMenuAnchor(element: HTMLElement): PortalMenuAnchor {
  const bounds = element.getBoundingClientRect();

  return {
    height: bounds.height,
    width: bounds.width,
    x: bounds.x,
    y: bounds.y,
  };
}

function getPortalMenuTheme(): PortalMenuTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export { getPortalMenuAnchor, getPortalMenuTheme };
export type {
  AddressBarContextMenuCommand,
  AddressBarContextMenuState,
  AddressBarContextPortalState,
  BrowserMenuCommand,
  BrowserMenuPortalState,
  BrowserMenuState,
  PageContextMenuCommand,
  PageContextPortalState,
  PortalMenuAnchor,
  PortalMenuState,
  PortalMenuTabItem,
  PortalMenuTheme,
  TabContextMenuCommand,
  TabContextPortalState,
  TabListPortalState,
  TitlebarContextMenuCommand,
  TitlebarContextMenuState,
  TitlebarContextPortalState,
};
