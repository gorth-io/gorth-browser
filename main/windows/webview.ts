import { BrowserWindow, WebContentsView } from "electron";

export interface WebviewLayout {
  verticalTabsWidth: number;
  sidebarSide: "left" | "right";
  top: number;
  sidebarWidth: number;
}

export interface WebviewRecord {
  view: WebContentsView;
}

export interface WebviewLayoutState {
  activeTabId: string | null;
  internalTabIds: { has(tabId: string): boolean };
  layout: WebviewLayout;
  splitTabId: string | null;
  views: ReadonlyMap<string, WebviewRecord>;
  webFullScreenTabId: string | null;
}

export function createWebview(window: BrowserWindow): WebviewRecord {
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  view.setBackgroundColor("#ffffff");
  view.setVisible(false);
  window.contentView.addChildView(view);

  return { view };
}

export function updateWebviewBounds(
  window: BrowserWindow,
  state: WebviewLayoutState,
) {
  const [windowWidth, windowHeight] = window.getContentSize();

  if (state.webFullScreenTabId) {
    for (const [tabId, record] of state.views) {
      const visible = tabId === state.webFullScreenTabId;
      record.view.setVisible(visible);
      if (visible) {
        record.view.setBounds({
          x: 0,
          y: 0,
          width: windowWidth,
          height: windowHeight,
        });
      }
    }
    return;
  }

  const x = Math.min(
    windowWidth,
    state.layout.verticalTabsWidth +
      (state.layout.sidebarSide === "left" ? state.layout.sidebarWidth : 0),
  );
  const y = Math.min(state.layout.top, windowHeight);
  const width = Math.max(
    0,
    windowWidth - state.layout.verticalTabsWidth - state.layout.sidebarWidth,
  );
  const height = Math.max(0, windowHeight - y);

  for (const record of state.views.values()) record.view.setVisible(false);

  const visibleRecords = [state.activeTabId, state.splitTabId]
    .filter((tabId): tabId is string => Boolean(tabId))
    .filter((tabId, index, tabIds) => tabIds.indexOf(tabId) === index)
    .filter((tabId) => !state.internalTabIds.has(tabId))
    .map((tabId) => state.views.get(tabId))
    .filter((record): record is WebviewRecord => Boolean(record));

  if (visibleRecords.length === 0 || width === 0 || height === 0) return;

  if (visibleRecords.length === 1) {
    visibleRecords[0].view.setBounds({ x, y, width, height });
    visibleRecords[0].view.setVisible(true);
    return;
  }

  const dividerWidth = 1;
  const firstWidth = Math.floor((width - dividerWidth) / 2);
  const secondWidth = Math.max(0, width - firstWidth - dividerWidth);
  visibleRecords[0].view.setBounds({ x, y, width: firstWidth, height });
  visibleRecords[1].view.setBounds({
    x: x + firstWidth + dividerWidth,
    y,
    width: secondWidth,
    height,
  });
  visibleRecords[0].view.setVisible(true);
  visibleRecords[1].view.setVisible(true);
}

export function destroyWebview(window: BrowserWindow, record: WebviewRecord) {
  window.contentView.removeChildView(record.view);
  if (!record.view.webContents.isDestroyed()) {
    record.view.webContents.close({ waitForBeforeUnload: false });
  }
}
