import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import {
  BrowserSidebar,
  type BrowserBookmark,
  type BrowserSidebarSide,
} from "@/components/element/browser-sidebar";
import type { BrowserTabItem } from "@/components/element/browser-tabs";
import { FindInPage } from "@/components/element/find-in-page";
import { LoadingScreen } from "@/components/element/loading-screen";
import { NewTabPage } from "@/pages/new-tab";
import { SpecialPage, type BrowserHistoryItem } from "@/pages";
import { AddressBar } from "@/layouts/address-bar";
import { Titlebar } from "@/layouts/titlebar";
import { VerticalTabs } from "@/layouts/vertical-tabs";
import { getPortalMenuTheme } from "@/lib/browser/browser-menu";
import {
  getInternalPageTitle,
  getInternalPageUrl,
  parseInternalPage,
  type BrowserInternalPage,
} from "@/lib/browser/internal-pages";
import {
  defaultBrowserPreferences,
  type BrowserSnapshot,
  type PersistedTab,
} from "@/lib/browser/persistence";
import { applyTheme, subscribeToSystemTheme, type Theme } from "@/lib/theme";

const BROWSER_CHROME_HEIGHT = 112;
const SIDEBAR_WIDTH = 256;

function createNewTab(id: string, title = "Home"): BrowserTabItem {
  return {
    isPinned: false,
    id,
    title,
    url: "",
    faviconUrl: "",
    canGoBack: false,
    canGoForward: false,
    isLoading: false,
    isMuted: false,
    isHome: true,
    internalPage: "new-tab",
  };
}

function createInternalTab(
  id: string,
  page: Exclude<BrowserInternalPage, "new-tab">,
): BrowserTabItem {
  return {
    isPinned: false,
    id,
    title: getInternalPageTitle(page),
    url: getInternalPageUrl(page),
    faviconUrl: "",
    canGoBack: false,
    canGoForward: false,
    isLoading: false,
    isMuted: false,
    isHome: false,
    internalPage: page,
  };
}

function getWebDestination(value: string) {
  const query = value.trim();

  if (/^https?:\/\//i.test(query)) return query;
  if (/^[\w-]+(?:\.[\w-]+)+(?:[/?#].*)?$/i.test(query)) {
    return `https://${query}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function toPersistedTab(tab: BrowserTabItem): PersistedTab {
  const { id, title, url, faviconUrl, isMuted, isPinned, internalPage } = tab;
  return {
    id,
    title,
    url,
    faviconUrl,
    isMuted,
    isPinned,
    internalPage,
  };
}

export default function Application() {
  const [verticalTabs, setVerticalTabs] = useState(
    defaultBrowserPreferences.verticalTabs,
  );
  const [verticalCollapsed, setVerticalCollapsed] = useState(
    defaultBrowserPreferences.verticalCollapsed,
  );
  const [tabs, setTabs] = useState<BrowserTabItem[]>([createNewTab("home")]);
  const [activeTabId, setActiveTabId] = useState("home");
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([]);
  const [history, setHistory] = useState<BrowserHistoryItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarSide, setSidebarSide] = useState<BrowserSidebarSide>(
    defaultBrowserPreferences.sidebarSide,
  );
  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [showTitlebarLogo, setShowTitlebarLogo] = useState(
    defaultBrowserPreferences.showTitlebarLogo,
  );
  const [flags, setFlags] = useState(defaultBrowserPreferences.flags);
  const [theme, setTheme] = useState<Theme>(defaultBrowserPreferences.theme);
  const [isHydrated, setIsHydrated] = useState(false);
  const [startupError, setStartupError] = useState("");
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [isWebFullScreen, setIsWebFullScreen] = useState(false);
  const lastVisitedUrlByTab = useRef(new Map<string, string>());

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const splitCandidate = useMemo(
    () =>
      tabs.find(
        (tab) =>
          tab.id !== activeTabId &&
          tab.internalPage === null &&
          Boolean(tab.url),
      ),
    [activeTabId, tabs],
  );
  const isBookmarked = bookmarks.some(
    (bookmark) => bookmark.url === activeTab.url,
  );
  const isSidebarVisible = isSidebarOpen;
  const canSplit =
    activeTab.internalPage === null && Boolean(activeTab.url && splitCandidate);

  const openWebTab = useCallback((value: string) => {
    const destination = getWebDestination(value);
    const id = crypto.randomUUID();

    setTabs((currentTabs) => [
      ...currentTabs,
      {
        ...createNewTab(id),
        title: "Loading…",
        url: destination,
        isHome: false,
        isLoading: true,
        internalPage: null,
      },
    ]);
    setActiveTabId(id);
    void window.electronAPI.tabs.navigate(id, destination);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void window.electronAPI.persistence
      .load()
      .then((snapshot) => {
        if (cancelled) return;
        const restoredTabs: BrowserTabItem[] = snapshot.tabs.length
          ? snapshot.tabs.map((tab) => ({
              ...tab,
              canGoBack: tab.internalPage !== "new-tab",
              canGoForward: false,
              isHome: tab.internalPage === "new-tab",
              isLoading:
                tab.internalPage === null || tab.internalPage === "error",
              internalPage:
                tab.internalPage === "error" ? null : tab.internalPage,
            }))
          : [createNewTab("home")];
        const restoredActiveId = restoredTabs.some(
          (tab) => tab.id === snapshot.activeTabId,
        )
          ? (snapshot.activeTabId as string)
          : restoredTabs[0].id;
        setTabs(restoredTabs);
        setActiveTabId(restoredActiveId);
        setSplitTabId(snapshot.splitTabId);
        setBookmarks(snapshot.bookmarks);
        setHistory(snapshot.history);
        setVerticalTabs(snapshot.preferences.verticalTabs);
        setVerticalCollapsed(snapshot.preferences.verticalCollapsed);
        setSidebarSide(snapshot.preferences.sidebarSide);
        setShowTitlebarLogo(snapshot.preferences.showTitlebarLogo);
        setFlags(snapshot.preferences.flags);
        setTheme(snapshot.preferences.theme);
        applyTheme(snapshot.preferences.theme);
        lastVisitedUrlByTab.current = new Map(
          restoredTabs
            .filter((tab) => tab.internalPage === null && tab.url)
            .map((tab) => [tab.id, tab.url]),
        );
        for (const tab of restoredTabs) {
          if (tab.internalPage === "new-tab") {
            window.electronAPI.tabs.home(tab.id);
          } else if (tab.internalPage) {
            void window.electronAPI.tabs.navigate(
              tab.id,
              getInternalPageUrl(tab.internalPage),
            );
          } else if (tab.url) {
            void window.electronAPI.tabs.navigate(tab.id, tab.url);
          }
          if (tab.isMuted) window.electronAPI.tabs.setMuted(tab.id, true);
        }
        window.electronAPI.tabs.activate(restoredActiveId);
        window.electronAPI.tabs.setSplit(snapshot.splitTabId);
        setIsHydrated(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Unable to restore browser session.", error);
        setStartupError(
          "Unable to restore your browser session. Please try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.electronAPI.tabs.activate(activeTabId);
  }, [activeTabId, isHydrated]);

  useLayoutEffect(() => {
    window.electronAPI.tabs.setLayout({
      top: isHydrated
        ? (verticalTabs ? 56 : BROWSER_CHROME_HEIGHT) + (isFindOpen ? 48 : 0)
        : window.innerHeight,
      verticalTabsWidth: verticalTabs ? (verticalCollapsed ? 56 : 200) : 0,
      sidebarWidth: isSidebarVisible ? SIDEBAR_WIDTH : 0,
      sidebarSide,
    });
  }, [
    isHydrated,
    isFindOpen,
    isSidebarVisible,
    sidebarSide,
    verticalTabs,
    verticalCollapsed,
  ]);

  useLayoutEffect(() => {
    if (!isHydrated) return;
    applyTheme(theme);
    return subscribeToSystemTheme(() => applyTheme(theme));
  }, [theme, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    const snapshot: BrowserSnapshot = {
      activeTabId,
      splitTabId,
      tabs: tabs.map(
        ({ id, title, url, faviconUrl, isMuted, isPinned, internalPage }) => ({
          id,
          title,
          url,
          faviconUrl,
          isMuted,
          isPinned,
          internalPage,
        }),
      ),
      bookmarks,
      history,
      preferences: {
        flags,
        sidebarSide,
        showTitlebarLogo,
        theme,
        verticalCollapsed,
        verticalTabs,
      },
    };
    const timer = setTimeout(() => {
      void window.electronAPI.persistence.save(snapshot);
    }, 250);
    const flushSession = (event: BeforeUnloadEvent) => {
      clearTimeout(timer);
      if (!window.electronAPI.persistence.flush(snapshot)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", flushSession);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeunload", flushSession);
    };
  }, [
    activeTabId,
    bookmarks,
    flags,
    history,
    isHydrated,
    showTitlebarLogo,
    sidebarSide,
    splitTabId,
    tabs,
    theme,
    verticalCollapsed,
    verticalTabs,
  ]);

  useEffect(
    () =>
      window.electronAPI.windowState.onWebFullScreenChanged(setIsWebFullScreen),
    [],
  );

  useEffect(
    () =>
      window.electronAPI.tabs.onUpdated((update) => {
        setTabs((currentTabs) =>
          currentTabs.map((tab) =>
            tab.id === update.id ? { ...tab, ...update } : tab,
          ),
        );
      }),
    [],
  );

  useEffect(
    () => window.electronAPI.tabs.onOpenRequested(openWebTab),
    [openWebTab],
  );

  useEffect(() => {
    for (const tab of tabs) {
      if (tab.internalPage !== null || !tab.url) continue;

      const previousUrl = lastVisitedUrlByTab.current.get(tab.id);
      if (previousUrl !== tab.url) {
        lastVisitedUrlByTab.current.set(tab.id, tab.url);
        setHistory((currentHistory) => [
          {
            id: crypto.randomUUID(),
            tabId: tab.id,
            title: tab.title,
            url: tab.url,
            visitedAt: Date.now(),
          },
          ...currentHistory,
        ]);
      } else {
        setHistory((currentHistory) =>
          currentHistory.map((item, index) =>
            index === 0 && item.tabId === tab.id && item.url === tab.url
              ? { ...item, title: tab.title }
              : item,
          ),
        );
      }
    }
  }, [tabs]);

  const activateTab = (tabId: string) => {
    if (splitTabId === tabId) setSplitTabId(null);
    setActiveTabId(tabId);
  };

  const createTab = () => {
    const id = crypto.randomUUID();
    setTabs((currentTabs) => [
      ...currentTabs,
      createNewTab(id, `New tab ${currentTabs.length + 1}`),
    ]);
    setActiveTabId(id);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return;

    const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
    const nextTabs = tabs.filter((tab) => tab.id !== tabId);
    const nextActiveTab = nextTabs[Math.min(closingIndex, nextTabs.length - 1)];

    void window.electronAPI.persistence.closeTab(
      toPersistedTab(tabs[closingIndex]),
    );

    window.electronAPI.tabs.close(tabId);
    lastVisitedUrlByTab.current.delete(tabId);
    setTabs(nextTabs);

    if (splitTabId === tabId) {
      setSplitTabId(null);
      window.electronAPI.tabs.setSplit(null);
    }

    if (activeTabId === tabId) setActiveTabId(nextActiveTab.id);
  };

  const closeOtherTabs = (tabId: string) => {
    const tabToKeep = tabs.find((tab) => tab.id === tabId);
    if (!tabToKeep) return;

    for (const tab of tabs) {
      if (tab.id === tabId) continue;
      void window.electronAPI.persistence.closeTab(toPersistedTab(tab));
      window.electronAPI.tabs.close(tab.id);
      lastVisitedUrlByTab.current.delete(tab.id);
    }

    setTabs([tabToKeep]);
    setActiveTabId(tabId);
    setSplitTabId(null);
    window.electronAPI.tabs.setSplit(null);
  };

  const reopenClosedTab = async () => {
    const closed = await window.electronAPI.persistence.reopenClosedTab();
    if (!closed) return;
    const id = tabs.some((tab) => tab.id === closed.id)
      ? crypto.randomUUID()
      : closed.id;
    const restored: BrowserTabItem = {
      ...closed,
      id,
      canGoBack: closed.internalPage !== "new-tab",
      canGoForward: false,
      isHome: closed.internalPage === "new-tab",
      isLoading: closed.internalPage === null,
    };
    setTabs((current) => [...current, restored]);
    setActiveTabId(id);
    if (closed.internalPage === "new-tab") window.electronAPI.tabs.home(id);
    else if (closed.internalPage)
      void window.electronAPI.tabs.navigate(
        id,
        getInternalPageUrl(closed.internalPage),
      );
    else if (closed.url) void window.electronAPI.tabs.navigate(id, closed.url);
    if (closed.isMuted) window.electronAPI.tabs.setMuted(id, true);
  };

  const toggleTabMuted = (tabId: string) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const nextMuted = !tab.isMuted;
    setTabs((currentTabs) =>
      currentTabs.map((item) =>
        item.id === tabId ? { ...item, isMuted: nextMuted } : item,
      ),
    );
    window.electronAPI.tabs.setMuted(tabId, nextMuted);
  };

  const toggleTabPinned = (tabId: string) => {
    setTabs((current) =>
      current
        .map((tab) =>
          tab.id === tabId ? { ...tab, isPinned: !tab.isPinned } : tab,
        )
        .sort((a, b) => Number(b.isPinned) - Number(a.isPinned)),
    );
  };

  const goHome = () => {
    setSplitTabId(null);
    window.electronAPI.tabs.setSplit(null);
    window.electronAPI.tabs.home(activeTabId);
    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === activeTabId
          ? { ...createNewTab(tab.id), isPinned: tab.isPinned }
          : tab,
      ),
    );
  };

  const openInternalPage = (page: Exclude<BrowserInternalPage, "new-tab">) => {
    const isSettings = page === "settings" || page.startsWith("settings/");
    const existingTab =
      tabs.find((tab) => tab.internalPage === page) ??
      (isSettings
        ? tabs.find(
            (tab) =>
              tab.internalPage === "settings" ||
              tab.internalPage?.startsWith("settings/"),
          )
        : undefined);

    setSplitTabId(null);
    window.electronAPI.tabs.setSplit(null);

    if (existingTab) {
      if (
        isSettings &&
        page !== "settings" &&
        existingTab.internalPage !== page
      ) {
        setTabs((current) =>
          current.map((tab) =>
            tab.id === existingTab.id
              ? {
                  ...tab,
                  ...createInternalTab(tab.id, page),
                  isPinned: tab.isPinned,
                }
              : tab,
          ),
        );
        void window.electronAPI.tabs.navigate(
          existingTab.id,
          getInternalPageUrl(page),
        );
      }
      setActiveTabId(existingTab.id);
      window.electronAPI.tabs.activate(existingTab.id);
      return;
    }

    const id = crypto.randomUUID();
    const tab = createInternalTab(id, page);
    setTabs((currentTabs) => [...currentTabs, tab]);
    setActiveTabId(id);
    void window.electronAPI.tabs.navigate(id, tab.url);
  };

  const navigate = (value: string) => {
    const internalPage = parseInternalPage(value);

    if (internalPage === "new-tab") {
      goHome();
      return;
    }

    if (internalPage) {
      openInternalPage(internalPage);
      return;
    }

    const destination = getWebDestination(value);

    setSplitTabId(null);
    window.electronAPI.tabs.setSplit(null);
    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              title: "Loading…",
              url: destination,
              isHome: false,
              isLoading: true,
              internalPage: null,
            }
          : tab,
      ),
    );
    void window.electronAPI.tabs.navigate(activeTabId, destination);
  };

  const goBack = () => {
    if (activeTab.internalPage && activeTab.internalPage !== "new-tab") {
      goHome();
      return;
    }
    window.electronAPI.tabs.back(activeTabId);
  };

  const toggleBookmark = () => {
    if (!activeTab.url || activeTab.internalPage !== null) return;

    setBookmarks((currentBookmarks) => {
      const exists = currentBookmarks.some(
        (bookmark) => bookmark.url === activeTab.url,
      );
      if (exists) {
        return currentBookmarks.filter(
          (bookmark) => bookmark.url !== activeTab.url,
        );
      }
      return [
        ...currentBookmarks,
        {
          id: crypto.randomUUID(),
          title: activeTab.title || activeTab.url,
          url: activeTab.url,
        },
      ];
    });
  };

  const toggleSplit = () => {
    if (splitTabId) {
      setSplitTabId(null);
      window.electronAPI.tabs.setSplit(null);
    } else if (splitCandidate && activeTab.internalPage === null) {
      setSplitTabId(splitCandidate.id);
      window.electronAPI.tabs.setSplit(splitCandidate.id);
    }
  };

  const openPageContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    void window.electronAPI.pageMenu.open(
      {
        height: 0,
        width: 0,
        x: event.clientX,
        y: event.clientY,
      },
      getPortalMenuTheme(),
    );
  };

  useEffect(() => {
    setIsFindOpen(false);
    window.electronAPI.findInPage.stop(activeTabId);
  }, [activeTabId]);

  useEffect(
    () =>
      window.electronAPI.appActions.onAction((action) => {
        const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
        const actions: Record<string, () => void> = {
          "new-tab": createTab,
          "close-tab": () => closeTab(activeTabId),
          "reopen-closed-tab": () => void reopenClosedTab(),
          "find-in-page": () => setIsFindOpen(true),
          "reload-tab": () => window.electronAPI.tabs.reload(activeTabId),
          "force-reload-tab": () =>
            window.electronAPI.tabs.forceReload(activeTabId),
          "next-tab": () =>
            activateTab(tabs[(activeIndex + 1) % tabs.length].id),
          "previous-tab": () =>
            activateTab(tabs[(activeIndex - 1 + tabs.length) % tabs.length].id),
          settings: () => openInternalPage("settings"),
        };
        actions[action]?.();
      }),
    [activeTabId, tabs],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (!command) return;
      const key = event.key.toLowerCase();
      if (key === "f") {
        event.preventDefault();
        setIsFindOpen(true);
      } else if (key === "t" && event.shiftKey) {
        event.preventDefault();
        void reopenClosedTab();
      } else if (key === "t") {
        event.preventDefault();
        createTab();
      } else if (key === "w") {
        event.preventDefault();
        closeTab(activeTabId);
      } else if (key === "r") {
        event.preventDefault();
        if (event.shiftKey) window.electronAPI.tabs.forceReload(activeTabId);
        else window.electronAPI.tabs.reload(activeTabId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTabId, tabs]);

  if (!isHydrated) return <LoadingScreen error={startupError} />;

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-background text-foreground"
      onContextMenu={openPageContextMenu}
    >
      {!isWebFullScreen && !verticalTabs && (
        <Titlebar
          activeTabId={activeTabId}
          showLogo={showTitlebarLogo}
          tabs={tabs}
          onActivateTab={activateTab}
          onCloseTab={closeTab}
          onCloseOtherTabs={closeOtherTabs}
          onCreateTab={createTab}
          onReloadTab={(tabId) => window.electronAPI.tabs.reload(tabId)}
          onToggleMuteTab={toggleTabMuted}
          onTogglePinTab={toggleTabPinned}
        />
      )}
      {!isWebFullScreen && (
        <AddressBar
          verticalTabs={verticalTabs}
          verticalCollapsed={verticalCollapsed}
          onToggleVerticalSidebar={() =>
            setVerticalCollapsed((collapsed) => !collapsed)
          }
          activeTab={activeTab}
          canSplit={canSplit}
          isBookmarked={isBookmarked}
          isSidebarOpen={isSidebarVisible}
          isSplit={Boolean(splitTabId)}
          onBack={goBack}
          onBookmark={toggleBookmark}
          onCreateTab={createTab}
          onForward={() => window.electronAPI.tabs.forward(activeTabId)}
          onHome={() => navigate("https://www.google.com")}
          onNavigate={navigate}
          onOpenInternal={openInternalPage}
          onReload={() => window.electronAPI.tabs.reload(activeTabId)}
          onStop={() => window.electronAPI.tabs.stop(activeTabId)}
          onToggleSidebar={() => setIsSidebarOpen((isOpen) => !isOpen)}
          onToggleSplit={toggleSplit}
        />
      )}
      {!isWebFullScreen && isFindOpen && (
        <FindInPage tabId={activeTabId} onClose={() => setIsFindOpen(false)} />
      )}

      {!isWebFullScreen && (
        <div className="relative flex min-h-0 flex-1">
          {verticalTabs && (
            <VerticalTabs
              activeTabId={activeTabId}
              tabs={tabs}
              collapsed={verticalCollapsed}
              onActivate={activateTab}
              onClose={closeTab}
              onCloseOtherTabs={closeOtherTabs}
              onCreateTab={createTab}
              onReload={(id) => window.electronAPI.tabs.reload(id)}
              onToggleMute={toggleTabMuted}
              onTogglePin={toggleTabPinned}
            />
          )}
          {isSidebarVisible && sidebarSide === "left" && (
            <BrowserSidebar
              bookmarks={bookmarks}
              onClose={() => setIsSidebarOpen(false)}
              onNavigate={navigate}
            />
          )}
          <main className="relative min-w-0 flex-1 overflow-auto">
            {activeTab.internalPage === "new-tab" && (
              <NewTabPage
                onNavigate={navigate}
                theme={theme}
                onThemeChange={setTheme}
              />
            )}
            {activeTab.internalPage && activeTab.internalPage !== "new-tab" && (
              <SpecialPage
                bookmarks={bookmarks}
                history={history}
                page={activeTab.internalPage}
                onClearHistory={() => setHistory([])}
                onNavigate={navigate}
                onOpenInNewTab={openWebTab}
                onOpenInternal={openInternalPage}
                onRemoveHistoryItem={(id) =>
                  setHistory((currentHistory) =>
                    currentHistory.filter((item) => item.id !== id),
                  )
                }
                onRemoveBookmark={(id) =>
                  setBookmarks((currentBookmarks) =>
                    currentBookmarks.filter((bookmark) => bookmark.id !== id),
                  )
                }
                onSidebarSideChange={setSidebarSide}
                onShowTitlebarLogoChange={setShowTitlebarLogo}
                sidebarSide={sidebarSide}
                showTitlebarLogo={showTitlebarLogo}
                verticalTabs={verticalTabs}
                onVerticalTabsChange={setVerticalTabs}
                flags={flags}
                onFlagsChange={setFlags}
                theme={theme}
                onThemeChange={setTheme}
                errorCode={activeTab.errorCode}
                errorDescription={activeTab.errorDescription}
                errorUrl={activeTab.errorUrl}
                onRetry={() => navigate(activeTab.errorUrl || activeTab.url)}
              />
            )}
          </main>
          {isSidebarVisible && sidebarSide === "right" && (
            <BrowserSidebar
              bookmarks={bookmarks}
              onClose={() => setIsSidebarOpen(false)}
              onNavigate={navigate}
            />
          )}
        </div>
      )}
    </div>
  );
}
