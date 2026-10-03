import { destroyWebview } from "@/main/windows/webview";
import { ipcMain } from "electron";
import { parseInternalPage } from "@/lib/browser/internal-pages";
import {
  type BrowserLayout,
  getWindowFromSender,
  getBrowserState,
  sendTabUpdate,
  showInternalPage,
  showErrorPage,
  setWebFullScreen,
  updateViewBounds,
  createTabView,
  getTabRecord,
  isAllowedNavigationUrl,
} from "@/main/windows/capital";

export function registerBrowserIpc() {
  ipcMain.on("tabs:set-layout", (event, layout: BrowserLayout) => {
    const window = getWindowFromSender(event.sender);

    if (!window) {
      return;
    }

    const state = getBrowserState(window);
    state.layout = {
      verticalTabsWidth: Number.isFinite(layout.verticalTabsWidth)
        ? Math.max(0, Math.round(layout.verticalTabsWidth))
        : 0,
      top: Math.max(0, Math.round(layout.top)),
      sidebarWidth: Math.max(0, Math.round(layout.sidebarWidth)),
      sidebarSide: layout.sidebarSide === "right" ? "right" : "left",
    };
    updateViewBounds(window);
  });
  ipcMain.handle(
    "find-in-page:find",
    async (
      event,
      tabId: string,
      text: string,
      forward: boolean,
      findNext: boolean,
    ) => {
      const record = getTabRecord(event.sender, tabId)?.record;
      if (!record || !text || record.view.webContents.isDestroyed())
        return null;
      const query = JSON.stringify(text);
      return record.view.webContents
        .executeJavaScript(
          `(() => {
      const query = ${query};
      const forward = ${Boolean(forward)};
      const findNext = ${Boolean(findNext)};
      const state = window.__gorthFindState || { query: "", index: 0 };
      const ranges = [];
      if (!document.body) return { activeMatchOrdinal: 0, matches: 0 };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || !node.textContent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const normalizedQuery = query.toLocaleLowerCase();
      let node;
      while ((node = walker.nextNode()) && ranges.length < 10000) {
        const value = node.textContent.toLocaleLowerCase();
        let offset = 0;
        while ((offset = value.indexOf(normalizedQuery, offset)) !== -1 && ranges.length < 10000) {
          const range = document.createRange();
          range.setStart(node, offset);
          range.setEnd(node, offset + query.length);
          ranges.push(range);
          offset += Math.max(1, query.length);
        }
      }
      let index = state.query === query ? state.index : 0;
      if (findNext && ranges.length) index = (index + (forward ? 1 : -1) + ranges.length) % ranges.length;
      index = Math.min(index, Math.max(0, ranges.length - 1));
      window.__gorthFindState = { query, index };
      if (CSS.highlights && window.Highlight) {
        if (!document.getElementById("gorth-find-style")) {
          const style = document.createElement("style");
          style.id = "gorth-find-style";
          style.textContent = "::highlight(gorth-find){background:#fde047;color:#111827}::highlight(gorth-find-active){background:#fb923c;color:#111827}";
          document.head.appendChild(style);
        }
        CSS.highlights.set("gorth-find", new Highlight(...ranges));
        CSS.highlights.set("gorth-find-active", new Highlight(...(ranges[index] ? [ranges[index]] : [])));
      }
      const active = ranges[index];
      if (active) {
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(active);
        active.startContainer.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return { activeMatchOrdinal: ranges.length ? index + 1 : 0, matches: ranges.length };
    })()`,
        )
        .catch(() => null);
    },
  );
  ipcMain.on("find-in-page:stop", (event, tabId: string) => {
    const contents = getTabRecord(event.sender, tabId)?.record?.view
      .webContents;
    if (!contents || contents.isDestroyed()) return;
    void contents
      .executeJavaScript(
        `(() => {
    CSS.highlights?.delete("gorth-find");
    CSS.highlights?.delete("gorth-find-active");
    getSelection()?.removeAllRanges();
    delete window.__gorthFindState;
    document.getElementById("gorth-find-style")?.remove();
  })()`,
      )
      .catch(() => {
        // Navigation or tab closure can destroy the document before cleanup runs.
      });
  });
  ipcMain.on("tabs:activate", (event, tabId: string) => {
    const window = getWindowFromSender(event.sender);

    if (!window) {
      return;
    }

    const state = getBrowserState(window);
    state.activeTabId = tabId;

    if (state.splitTabId === tabId) {
      state.splitTabId = null;
    }

    updateViewBounds(window);
  });
  ipcMain.handle("tabs:navigate", async (event, tabId: string, url: string) => {
    const window = getWindowFromSender(event.sender);
    const internalPage = parseInternalPage(url);

    if (!window) {
      return false;
    }

    if (internalPage) {
      showInternalPage(window, tabId, internalPage);
      return true;
    }

    if (!isAllowedNavigationUrl(url)) return false;

    const state = getBrowserState(window);
    const record = createTabView(window, tabId);
    state.internalPages.delete(tabId);
    state.activeTabId = tabId;
    updateViewBounds(window);

    try {
      await record.view.webContents.loadURL(url);
      return true;
    } catch (error) {
      if (!state.internalPages.has(tabId)) {
        showErrorPage(
          window,
          tabId,
          url,
          -2,
          error instanceof Error ? error.message : "Unable to load page",
        );
      }
      return false;
    }
  });
  ipcMain.on("tabs:home", (event, tabId: string) => {
    const window = getWindowFromSender(event.sender);

    if (!window) {
      return;
    }

    showInternalPage(window, tabId, "new-tab");
  });
  ipcMain.on("tabs:back", (event, tabId: string) => {
    const result = getTabRecord(event.sender, tabId);
    const window = getWindowFromSender(event.sender);

    if (window && getBrowserState(window).internalPages.has(tabId)) {
      showInternalPage(window, tabId, "new-tab");
      return;
    }

    const history = result?.record?.view.webContents.navigationHistory;

    if (history?.canGoBack()) {
      history.goBack();
    } else if (result) {
      showInternalPage(result.window, tabId, "new-tab");
    }
  });
  ipcMain.on("tabs:forward", (event, tabId: string) => {
    const history = getTabRecord(event.sender, tabId)?.record?.view.webContents
      .navigationHistory;

    if (history?.canGoForward()) {
      history.goForward();
    }
  });
  ipcMain.on("tabs:reload", (event, tabId: string) => {
    const window = getWindowFromSender(event.sender);
    if (window && getBrowserState(window).internalPages.has(tabId)) return;
    getTabRecord(event.sender, tabId)?.record?.view.webContents.reload();
  });
  ipcMain.on("tabs:force-reload", (event, tabId: string) => {
    const window = getWindowFromSender(event.sender);
    if (window && getBrowserState(window).internalPages.has(tabId)) return;
    getTabRecord(
      event.sender,
      tabId,
    )?.record?.view.webContents.reloadIgnoringCache();
  });
  ipcMain.on("tabs:stop", (event, tabId: string) => {
    getTabRecord(event.sender, tabId)?.record?.view.webContents.stop();
  });
  ipcMain.on("tabs:set-muted", (event, tabId: string, muted: boolean) => {
    const window = getWindowFromSender(event.sender);
    if (!window) return;

    getBrowserState(window)
      .views.get(tabId)
      ?.view.webContents.setAudioMuted(Boolean(muted));
    sendTabUpdate(window, { id: tabId, isMuted: Boolean(muted) });
  });
  ipcMain.on("tabs:set-split", (event, tabId: string | null) => {
    const window = getWindowFromSender(event.sender);

    if (!window) {
      return;
    }

    const state = getBrowserState(window);
    state.splitTabId = tabId === state.activeTabId ? null : tabId;
    updateViewBounds(window);
  });
  ipcMain.on("tabs:close", (event, tabId: string) => {
    const window = getWindowFromSender(event.sender);

    if (!window) {
      return;
    }

    const state = getBrowserState(window);
    const record = state.views.get(tabId);

    if (state.webFullScreenTabId === tabId) {
      setWebFullScreen(window, tabId, false);
    }

    if (record) {
      destroyWebview(window, record);
      state.views.delete(tabId);
    }

    state.internalPages.delete(tabId);

    if (state.splitTabId === tabId) {
      state.splitTabId = null;
    }

    updateViewBounds(window);
  });
}
