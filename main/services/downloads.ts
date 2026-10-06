import {
  app,
  dialog,
  shell,
  type BrowserWindow,
  type DownloadItem,
  type Session,
  type WebContents,
} from "electron";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  loadDownloads,
  saveDownload,
  deleteDownload,
  loadDownloadPreferences,
  saveDownloadPreferences,
} from "@/services/browser-database";
import type { DownloadRecord, DownloadInfo } from "@/lib/browser/downloads";
import { parseHttpUrl } from "@/lib/utils/schema";
import { getBrowserWindows } from "@/main/windows/capital";
import { getAvailableDownloadPath, getSafeDownloadName } from "./download-path";

interface ActiveDownload {
  contentsId: number;
  item: DownloadItem;
  record: DownloadRecord;
  timer?: ReturnType<typeof setTimeout>;
  lastSavedAt: number;
  persist: () => void;
  cleanup: () => void;
}

const activeDownloads = new Map<string, ActiveDownload>();
export function hasActiveTabDownload(contentsId: number) {
  return [...activeDownloads.values()].some(
    (entry) => entry.contentsId === contentsId,
  );
}
const reservedPaths = new Set<string>();
const imageSaveRequests = new WeakMap<
  WebContents,
  Map<string, ReturnType<typeof setTimeout>>
>();

export function saveImageAs(target: WebContents, address: string) {
  const url = new URL(address);
  if (
    target.isDestroyed() ||
    !["https:", "http:", "data:", "blob:"].includes(url.protocol)
  )
    return;
  const requests =
    imageSaveRequests.get(target) ??
    new Map<string, ReturnType<typeof setTimeout>>();
  clearTimeout(requests.get(address));
  requests.set(
    address,
    setTimeout(() => requests.delete(address), 60_000),
  );
  imageSaveRequests.set(target, requests);
  try {
    target.downloadURL(address);
  } catch (error) {
    clearTimeout(requests.get(address));
    requests.delete(address);
    reportDownloadError(error);
  }
}
let uninstall: (() => void) | undefined;
let lastErrorAt = 0;

function reportDownloadError(error: unknown) {
  if (Date.now() - lastErrorAt < 5000) return;
  lastErrorAt = Date.now();
  console.error("Unable to manage download.", error);
  for (const window of getBrowserWindows()) {
    if (!window.webContents.isDestroyed())
      window.webContents.send(
        "downloads:error",
        "Unable to save the download information. Check your download location and available disk space.",
      );
  }
}

function notifyDownloadsChanged() {
  const running = [...activeDownloads.values()];
  const totalBytes = running.reduce(
    (sum, entry) => sum + entry.record.totalBytes,
    0,
  );
  const receivedBytes = running.reduce(
    (sum, entry) => sum + entry.record.receivedBytes,
    0,
  );
  for (const window of getBrowserWindows()) {
    if (!window.webContents.isDestroyed())
      window.webContents.send("downloads:changed");
    if (!running.length) window.setProgressBar(-1);
    else
      window.setProgressBar(
        totalBytes ? Math.min(1, receivedBytes / totalBytes) : 0.5,
        {
          mode: running.every((entry) => entry.record.state === "paused")
            ? "paused"
            : running.some((entry) => !entry.record.totalBytes)
              ? "indeterminate"
              : "normal",
        },
      );
  }
}

function notifyDownloadState(
  kind: "started" | "completed" | "interrupted",
  filename: string,
) {
  for (const window of getBrowserWindows()) {
    if (!window.webContents.isDestroyed())
      window.webContents.send("downloads:notification", { kind, filename });
  }
}

export function getDownloads(): DownloadInfo[] {
  return loadDownloads().map((record) => {
    const entry = activeDownloads.get(record.id);
    return {
      ...record,
      ...entry?.record,
      isActive: Boolean(entry),
      canResume: Boolean(
        entry && (entry.item.isPaused() || entry.item.canResume()),
      ),
      bytesPerSecond:
        entry && !entry.item.isPaused()
          ? entry.item.getCurrentBytesPerSecond()
          : 0,
    };
  });
}

export function getDownloadPreferences() {
  return loadDownloadPreferences(app.getPath("downloads"));
}

export function installDownloadManager(session: Session) {
  if (uninstall) return;
  const captureDownload = (
    _event: Electron.Event,
    item: DownloadItem,
    contents: WebContents,
  ) => {
    const preferences = getDownloadPreferences();
    const filename = getSafeDownloadName(item.getFilename());
    let reservedPath: string | undefined;
    const requests = imageSaveRequests.get(contents);
    const requestedUrl = item.getURLChain().find((url) => requests?.has(url));
    if (requestedUrl) {
      clearTimeout(requests?.get(requestedUrl));
      requests?.delete(requestedUrl);
    }
    if (preferences.askWhereToSave || requestedUrl) {
      item.setSaveDialogOptions({
        defaultPath: path.join(preferences.directory, filename),
      });
    } else {
      reservedPath = getAvailableDownloadPath(
        preferences.directory,
        filename,
        reservedPaths,
      );
      reservedPaths.add(reservedPath);
      item.setSavePath(reservedPath);
    }
    const now = Date.now();
    const record: DownloadRecord = {
      id: crypto.randomUUID(),
      filename,
      url: item.getURL(),
      mimeType: item.getMimeType(),
      savePath: item.getSavePath(),
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      state: "progressing",
      startedAt: now,
      updatedAt: now,
    };
    const capture = () => {
      record.savePath = item.getSavePath();
      record.filename = record.savePath
        ? path.basename(record.savePath)
        : filename;
      record.receivedBytes = item.getReceivedBytes();
      record.totalBytes = item.getTotalBytes();
      record.state = item.isPaused() ? "paused" : item.getState();
      record.updatedAt = Date.now();
    };
    const persist = () => {
      clearTimeout(entry.timer);
      entry.timer = undefined;
      try {
        capture();
        saveDownload(record);
      } catch (error) {
        reportDownloadError(error);
      }
      entry.lastSavedAt = Date.now();
      notifyDownloadsChanged();
    };
    const updated = () => {
      const remaining = 250 - (Date.now() - entry.lastSavedAt);
      if (remaining <= 0) persist();
      else if (!entry.timer) entry.timer = setTimeout(persist, remaining);
    };
    const done = (
      _event: Electron.Event,
      state: "completed" | "cancelled" | "interrupted",
    ) => {
      try {
        capture();
      } catch (error) {
        reportDownloadError(error);
      } finally {
        entry.cleanup();
        activeDownloads.delete(record.id);
      }
      record.state = state;
      try {
        saveDownload(record);
      } catch (error) {
        reportDownloadError(error);
      }
      notifyDownloadsChanged();
      if (state !== "cancelled") notifyDownloadState(state, record.filename);
    };
    const entry: ActiveDownload = {
      contentsId: contents.id,
      item,
      record,
      lastSavedAt: now,
      persist,
      cleanup: () => {
        clearTimeout(entry.timer);
        item.off("updated", updated);
        item.off("done", done);
        if (reservedPath) reservedPaths.delete(reservedPath);
      },
    };
    activeDownloads.set(record.id, entry);
    item.on("updated", updated);
    item.once("done", done);
    saveDownload(record);
    notifyDownloadsChanged();
    notifyDownloadState("started", record.filename);
  };
  const onWillDownload = (
    event: Electron.Event,
    item: DownloadItem,
    contents: WebContents,
  ) => {
    try {
      captureDownload(event, item, contents);
    } catch (error) {
      for (const [id, entry] of activeDownloads)
        if (entry.item === item) {
          entry.cleanup();
          activeDownloads.delete(id);
        }
      event.preventDefault();
      console.error("Unable to start download.", error);
      for (const window of getBrowserWindows())
        window.webContents.send(
          "downloads:error",
          "Unable to start the download. Check your download location and available disk space.",
        );
    }
  };
  session.on("will-download", onWillDownload);
  uninstall = () => session.off("will-download", onWillDownload);
}

export function shutdownDownloadManager() {
  uninstall?.();
  uninstall = undefined;
  for (const entry of activeDownloads.values()) {
    entry.persist();
    entry.cleanup();
    try {
      saveDownload({ ...entry.record, state: "interrupted" });
    } catch (error) {
      reportDownloadError(error);
    }
  }
  activeDownloads.clear();
}

export function controlDownload(
  id: string,
  action: "pause" | "resume" | "cancel",
) {
  const entry = activeDownloads.get(id);
  if (!entry) throw new Error("This download is no longer active.");
  if (action === "pause") {
    if (entry.item.getState() !== "progressing")
      throw new Error("This download cannot be paused.");
    entry.item.pause();
    entry.persist();
  } else if (action === "resume") {
    if (!entry.item.isPaused() && !entry.item.canResume())
      throw new Error("This download cannot resume. Retry it instead.");
    entry.item.resume();
    entry.persist();
  } else entry.item.cancel();
}

function requireDownload(id: string) {
  const record = loadDownloads().find((download) => download.id === id);
  if (!record) throw new Error("Download not found.");
  return record;
}

export function retryDownload(id: string, window: BrowserWindow) {
  if (activeDownloads.has(id))
    throw new Error("Cancel the current download before retrying.");
  const record = requireDownload(id);
  const url = parseHttpUrl(record.url);
  if (url.username || url.password)
    throw new Error("Credential-bearing download URLs cannot be retried.");
  window.webContents.downloadURL(url.href);
}

export async function openDownload(
  id: string,
  window: BrowserWindow,
  reveal: boolean,
) {
  const record = requireDownload(id);
  if (record.state !== "completed" || !record.savePath)
    throw new Error("This download has not completed.");
  const info = await stat(record.savePath).catch(() => null);
  if (!info?.isFile()) throw new Error("This file was moved or deleted.");
  if (reveal) {
    shell.showItemInFolder(record.savePath);
    return;
  }
  if (
    /\.(exe|msi|msix|bat|cmd|ps1|sh|command|desktop|app|pkg|dmg|jar|com|scr|lnk|vbs|js|reg|url|hta)$/i.test(
      record.filename,
    )
  ) {
    const choice = await dialog.showMessageBox(window, {
      type: "warning",
      title: "Open downloaded file?",
      message: "Only open this file if you trust its source.",
      detail: record.filename,
      buttons: ["Cancel", "Open file"],
      defaultId: 0,
      cancelId: 0,
    });
    if (choice.response !== 1) return;
  }
  const error = await shell.openPath(record.savePath);
  if (error) throw new Error(error);
}

export function removeDownload(id: string) {
  if (activeDownloads.has(id))
    throw new Error("Cancel the download before removing it.");
  deleteDownload(id);
  notifyDownloadsChanged();
}

export function clearDownloadHistory() {
  for (const record of loadDownloads())
    if (!activeDownloads.has(record.id)) deleteDownload(record.id);
  notifyDownloadsChanged();
}

export async function chooseDownloadDirectory(window: BrowserWindow) {
  const preferences = getDownloadPreferences();
  const result = await dialog.showOpenDialog(window, {
    title: "Download location",
    defaultPath: preferences.directory,
    properties: ["openDirectory", "createDirectory"],
  });
  if (!result.canceled && result.filePaths[0]) {
    saveDownloadPreferences({
      ...preferences,
      directory: path.resolve(result.filePaths[0]),
    });
    notifyDownloadsChanged();
  }
  return getDownloadPreferences();
}

export function setAskWhereToSave(askWhereToSave: boolean) {
  saveDownloadPreferences({ ...getDownloadPreferences(), askWhereToSave });
  notifyDownloadsChanged();
  return getDownloadPreferences();
}
