import type { BrowserInternalPage } from "@/lib/browser/internal-pages";
export interface BrowserLayout {
  verticalTabsWidth: number;
  sidebarSide: "left" | "right";
  top: number;
  sidebarWidth: number;
}
export interface BrowserTabState {
  errorCode?: number;
  errorDescription?: string;
  errorUrl?: string;
  id: string;
  title: string;
  url: string;
  faviconUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  isMuted: boolean;
  isHome: boolean;
  internalPage: BrowserInternalPage | null;
}
export interface ElectronApi {
  auth: typeof import("@/preload/api/auth").authApi;
  portal: typeof import("@/preload/api/portal").portalApi;
  menuPortal: typeof import("@/preload/api/portal").menuPortalApi;
  persistence: typeof import("@/preload/api/database").persistenceApi;
  appActions: typeof import("@/preload/api/browser").appActionsApi;
  findInPage: typeof import("@/preload/api/browser").findInPageApi;
  siteInfo: typeof import("@/preload/api/browser").siteInfoApi;
  clipboard: typeof import("@/preload/api/browser").clipboardApi;
  addressBarMenu: typeof import("@/preload/api/browser").addressBarMenuApi;
  tabs: typeof import("@/preload/api/browser").tabsApi;
  browserMenu: typeof import("@/preload/api/browser").browserMenuApi;
  pageMenu: typeof import("@/preload/api/browser").pageMenuApi;
  titlebarMenu: typeof import("@/preload/api/browser").titlebarMenuApi;
  windowState: typeof import("@/preload/api/window").windowStateApi;
}
declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}
