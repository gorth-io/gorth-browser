import type { BrowserInternalPage } from "@/lib/browser/internal-pages";

interface PersistedTab {
  id: string;
  title: string;
  url: string;
  faviconUrl: string;
  isMuted: boolean;
  isPinned: boolean;
  internalPage: BrowserInternalPage | null;
}

interface PersistedBookmark {
  id: string;
  title: string;
  url: string;
}

interface PersistedHistoryItem {
  id: string;
  tabId: string;
  title: string;
  url: string;
  visitedAt: number;
}

interface BrowserPreferences {
  flags: Record<string, boolean>;
  sidebarSide: "left" | "right";
  showTitlebarLogo: boolean;
  theme: "dark" | "light" | "system";
  verticalCollapsed: boolean;
  verticalTabs: boolean;
}

interface BrowserSnapshot {
  activeTabId: string | null;
  bookmarks: PersistedBookmark[];
  history: PersistedHistoryItem[];
  preferences: BrowserPreferences;
  splitTabId: string | null;
  tabs: PersistedTab[];
}

interface PersistedWindowState {
  height: number;
  isMaximized: boolean;
  width: number;
  x: number | null;
  y: number | null;
}

const defaultBrowserPreferences: BrowserPreferences = {
  flags: { memorySaver: true, smoothScrolling: true },
  sidebarSide: "left",
  showTitlebarLogo: true,
  theme: "system",
  verticalCollapsed: false,
  verticalTabs: false,
};

export { defaultBrowserPreferences };
export type {
  BrowserPreferences,
  BrowserSnapshot,
  PersistedBookmark,
  PersistedHistoryItem,
  PersistedTab,
  PersistedWindowState,
};
