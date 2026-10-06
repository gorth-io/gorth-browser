import type { BrowserWindow } from "electron";
import { archiveTab, writeBrowserSetting } from "@/services/browser-database";
import type { BrowserSnapshot, PersistedTab } from "@/lib/browser/persistence";
import { shouldSleepTab } from "@/lib/browser/lifecycle";
import {
  getBrowserState,
  createTabView,
  sendTabUpdate,
  updateViewBounds,
  showInternalPage,
  isAllowedNavigationUrl,
} from "@/main/windows/capital";
import { destroyWebview } from "@/main/windows/webview";
import { hasActiveTabDownload } from "@/main/services/downloads";

export function synchronizeTabSession(
  window: BrowserWindow,
  snapshot: BrowserSnapshot,
) {
  const state = getBrowserState(window);
  const wakeAll =
    state.preferences.flags.memorySaver &&
    !snapshot.preferences.flags.memorySaver;
  if (
    state.preferences.flags.smoothScrolling !==
    snapshot.preferences.flags.smoothScrolling
  )
    writeBrowserSetting(
      "smoothScrolling",
      snapshot.preferences.flags.smoothScrolling,
    );
  state.preferences = snapshot.preferences;
  state.groupedTabIds = new Set(
    snapshot.groups.flatMap((group) => group.tabIds),
  );
  snapshot.tabs = snapshot.tabs
    .filter((tab) => !state.archivedTabIds.has(tab.id))
    .map((tab) => {
      const runtime = state.tabMetadata.get(tab.id);
      const next = {
        ...tab,
        isSleeping: runtime?.isSleeping ?? tab.isSleeping ?? false,
        lastActiveAt: runtime?.lastActiveAt ?? tab.lastActiveAt ?? Date.now(),
        navigation: runtime?.navigation ?? tab.navigation,
      };
      state.tabMetadata.set(tab.id, next);
      return next;
    });
  // Keep lifecycle snapshots fresh even when navigation finishes between saves.
  for (const tab of snapshot.tabs) {
    if (!tab.internalPage && state.views.has(tab.id)) {
      const captured = captureTabNavigation(window, tab.id);
      if (captured) tab.navigation = captured.navigation;
    }
  }
  if (wakeAll)
    for (const tab of snapshot.tabs)
      if (tab.isSleeping) void wakeTab(window, tab.id);
}

export function captureTabNavigation(
  window: BrowserWindow,
  tabId: string,
): PersistedTab | undefined {
  const state = getBrowserState(window);
  const tab = state.tabMetadata.get(tabId);
  // Authorization queries contain one-use state/PKCE data, not browsing history.
  if (state.views.get(tabId)?.transientAuth && tab) {
    return {
      ...tab,
      url: "gorth://auth",
      internalPage: "auth",
      navigation: undefined,
    };
  }
  const contents = state.views.get(tabId)?.view.webContents;
  if (!tab || !contents || contents.isDestroyed()) return tab;
  const entries = contents.navigationHistory
    .getAllEntries()
    .map(({ url, title }) => ({ url, title }));
  const next = {
    ...tab,
    url: contents.getURL() || tab.url,
    title: contents.getTitle() || tab.title,
    isMuted: contents.isAudioMuted(),
    navigation: entries.length
      ? { entries, activeIndex: contents.navigationHistory.getActiveIndex() }
      : tab.navigation,
  };
  state.tabMetadata.set(tabId, next);
  return next;
}

export async function wakeTab(window: BrowserWindow, tabId: string) {
  const state = getBrowserState(window);
  const tab = state.tabMetadata.get(tabId);
  if (!tab || tab.internalPage || !isAllowedNavigationUrl(tab.url)) return;
  if (state.views.has(tabId)) {
    tab.lastActiveAt = Date.now();
    return;
  }
  const record = createTabView(window, tabId);
  tab.isSleeping = false;
  tab.lastActiveAt = Date.now();
  sendTabUpdate(window, { id: tabId, isSleeping: false, isLoading: true });
  record.view.webContents.setAudioMuted(tab.isMuted);
  updateViewBounds(window);
  try {
    const navigation = tab.navigation;
    if (
      navigation?.entries.length &&
      navigation.entries.every((entry) => isAllowedNavigationUrl(entry.url))
    ) {
      await record.view.webContents.navigationHistory.restore(navigation);
    } else await record.view.webContents.loadURL(tab.url);
  } catch (error) {
    if (!record.view.webContents.isDestroyed())
      console.warn("Unable to restore tab navigation.", error);
  }
}

export function restoreTabSession(
  window: BrowserWindow,
  snapshot: BrowserSnapshot,
) {
  const state = getBrowserState(window);
  synchronizeTabSession(window, snapshot);
  state.activeTabId = snapshot.activeTabId;
  state.splitTabId = snapshot.splitTabId;
  for (const tab of snapshot.tabs) {
    if (tab.internalPage === "error" && isAllowedNavigationUrl(tab.url))
      tab.internalPage = null;
    if (tab.internalPage) {
      state.internalPages.set(tab.id, tab.internalPage);
      if (tab.id === snapshot.activeTabId)
        showInternalPage(window, tab.id, tab.internalPage);
    } else if (
      tab.id === snapshot.activeTabId ||
      tab.id === snapshot.splitTabId ||
      tab.isPinned ||
      state.groupedTabIds.has(tab.id) ||
      !snapshot.preferences.flags.memorySaver
    ) {
      tab.isSleeping = false;
      void wakeTab(window, tab.id);
    } else {
      tab.isSleeping = true;
    }
    state.tabMetadata.set(tab.id, tab);
  }
  return snapshot;
}

async function tabIsProtected(window: BrowserWindow, tabId: string) {
  const state = getBrowserState(window);
  const tab = state.tabMetadata.get(tabId);
  if (
    !tab ||
    state.views.get(tabId)?.transientAuth ||
    tab.internalPage ||
    tab.isPinned ||
    state.groupedTabIds.has(tabId) ||
    state.activeTabId === tabId ||
    state.splitTabId === tabId ||
    state.webFullScreenTabId === tabId
  )
    return true;
  const contents = state.views.get(tabId)?.view.webContents;
  if (!contents) return false;
  if (
    contents.isDestroyed() ||
    contents.isLoading() ||
    contents.isCurrentlyAudible() ||
    contents.isBeingCaptured() ||
    hasActiveTabDownload(contents.id)
  )
    return true;
  try {
    return await contents.executeJavaScript(`(() => Boolean(document.pictureInPictureElement || document.pointerLockElement ||
      [...document.querySelectorAll('video,audio')].some(el => !el.paused && !el.ended) ||
      document.querySelector('[contenteditable="true"]') ||
      [...document.querySelectorAll('input,textarea,select')].some(el => el.value !== el.defaultValue && (el.tagName !== 'SELECT' || [...el.options].some(option => option.selected !== option.defaultSelected)) || ('checked' in el && el.checked !== el.defaultChecked))))()`);
  } catch {
    return true; // Never discard a document whose safety cannot be checked.
  }
}

export async function sleepTab(window: BrowserWindow, tabId: string) {
  const state = getBrowserState(window);
  if (await tabIsProtected(window, tabId)) return false;
  const tab = captureTabNavigation(window, tabId);
  const record = state.views.get(tabId);
  // The active/split tab may have changed while checking the document.
  if (
    !tab ||
    !record ||
    state.activeTabId === tabId ||
    state.splitTabId === tabId
  )
    return false;
  tab.isSleeping = true;
  state.views.delete(tabId);
  const destroyed = new Promise<void>((resolve) =>
    record.view.webContents.once("destroyed", () => resolve()),
  );
  destroyWebview(window, record);
  await destroyed;
  sendTabUpdate(window, {
    id: tabId,
    isSleeping: true,
    isLoading: false,
    navigation: tab.navigation,
  });
  return true;
}

export async function archiveBrowserTab(window: BrowserWindow, tabId: string) {
  const state = getBrowserState(window);
  if (state.views.get(tabId)?.transientAuth) return false;
  if (await tabIsProtected(window, tabId)) return false;
  const tab = captureTabNavigation(window, tabId);
  if (!tab || state.activeTabId === tabId || state.splitTabId === tabId)
    return false;
  archiveTab(tab, state.sessionId);
  state.archivedTabIds.add(tabId);
  const record = state.views.get(tabId);
  state.views.delete(tabId);
  if (record) destroyWebview(window, record);
  state.tabMetadata.delete(tabId);
  window.webContents.send("tabs:archived", tabId);
  return true;
}

export function trackTabLifecycle(window: BrowserWindow) {
  let checking = false;
  const timer = setInterval(async () => {
    if (checking || window.isDestroyed()) return;
    checking = true;
    try {
      const state = getBrowserState(window);
      for (const [id, tab] of state.tabMetadata) {
        if (window.isDestroyed()) break;
        const now = Date.now();
        const lastActiveAt = tab.lastActiveAt ?? now;
        const preferences = {
          ...state.preferences,
          memorySaver: state.preferences.flags.memorySaver,
        };
        if (
          preferences.archiveAfterDays > 0 &&
          now - lastActiveAt >= preferences.archiveAfterDays * 86_400_000
        ) {
          await archiveBrowserTab(window, id);
        } else if (
          !tab.isSleeping &&
          shouldSleepTab({
            active: state.activeTabId === id || state.splitTabId === id,
            pinned: tab.isPinned,
            grouped: state.groupedTabIds.has(id),
            internal: Boolean(tab.internalPage),
            busy: false,
            lastActiveAt,
            now,
            preferences,
          })
        )
          await sleepTab(window, id);
      }
    } catch (error) {
      console.warn("Unable to update inactive tabs.", error);
    } finally {
      checking = false;
    }
  }, 30_000);
  timer.unref();
  window.once("closed", () => clearInterval(timer));
}
