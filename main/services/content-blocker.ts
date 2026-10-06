import {
  ElectronBlocker,
  fromElectronDetails,
  Request,
} from "@ghostery/adblocker-electron";
import {
  app,
  ipcMain,
  session,
  type WebContents,
  type IpcMainInvokeEvent,
} from "electron";
import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { readBrowserSetting, writeBrowserSetting } from "@/services/browser-database";
import {
  defaultShieldPreferences,
  isSiteExcluded,
  normalizeSite,
  type ShieldPreferences,
  type ShieldStatus,
} from "@/lib/browser/shields";
import { getBrowserWindows, getWindowFromSender } from "@/main/windows/capital";

const websiteContents = new Map<number, WebContents>();
let preferences = defaultShieldPreferences;
let engine: ElectronBlocker | undefined;
let customEngine: ElectronBlocker | undefined;
const status: Omit<ShieldStatus, "preferences"> = {
  ready: false,
  updating: false,
  updatedAt: null,
  blockedRequests: 0,
  error: null,
};
let updatePromise: Promise<void> | undefined;
let updateTimer: ReturnType<typeof setInterval> | undefined;
let notificationTimer: ReturnType<typeof setTimeout> | undefined;
let stopping = false;
const updateAbort = new AbortController();
const cachePath = () =>
  path.join(app.getPath("userData"), "shields-engine.bin");

export function registerBlockerContents(contents: WebContents) {
  websiteContents.set(contents.id, contents);
  contents.once("destroyed", () => websiteContents.delete(contents.id));
}

function permitted(contents: WebContents | undefined) {
  return Boolean(
    preferences.enabled &&
    contents &&
    !contents.isDestroyed() &&
    websiteContents.get(contents.id) === contents &&
    !isSiteExcluded(contents.getURL(), preferences.disabledSites),
  );
}

function requireApplication(event: IpcMainInvokeEvent) {
  const window = getWindowFromSender(event.sender);
  if (
    !window ||
    window.webContents !== event.sender ||
    event.senderFrame !== event.sender.mainFrame
  )
    throw new Error("Untrusted shields request.");
}

export function getShieldStatus(): ShieldStatus {
  return { ...status, preferences };
}

function notifyStatus() {
  for (const window of getBrowserWindows())
    if (!window.webContents.isDestroyed())
      window.webContents.send("shields:changed", getShieldStatus());
}

const cosmeticMessageSchema = z.object({
  classes: z.array(z.string().max(8192)).max(10000),
  hrefs: z.array(z.string().max(8192)).max(10000),
  ids: z.array(z.string().max(8192)).max(10000),
  lifecycle: z.enum(["start", "dom-update"]),
});

async function injectCosmetics(
  blocker: ElectronBlocker,
  event: IpcMainInvokeEvent,
  url: string,
  message: z.infer<typeof cosmeticMessageSchema> | undefined,
) {
  const frame = event.senderFrame;
  if (!frame || frame.isDestroyed()) return;
  const request = Request.fromRawDetails({ url, type: "mainFrame" });
  const initial = message === undefined;
  const result = blocker.getCosmeticsFilters({
    url,
    hostname: request.hostname,
    domain: request.domain,
    classes: message?.classes,
    hrefs: message?.hrefs,
    ids: message?.ids,
    getBaseRules: initial,
    getInjectionRules: initial,
    getExtendedRules: false,
    getRulesFromHostname: initial,
    getRulesFromDOM: !initial,
    callerContext: {
      frameId: event.frameId,
      processId: event.processId,
      lifecycle: message?.lifecycle,
    },
  });
  if (!result.active) return;
  try {
    if (result.styles)
      await event.sender.insertCSS(result.styles, { cssOrigin: "user" });
    for (const script of result.scripts) {
      if (frame.isDestroyed() || frame.url !== url || !permitted(event.sender))
        break;
      // Await rejections too: upstream's helper catches synchronous errors only.
      try {
        await frame.executeJavaScript(script, true);
      } catch {
        if (!frame.isDestroyed())
          console.warn("A Shields cosmetic script could not be applied.");
      }
    }
  } catch {
    // A document can be navigated away/closed while a cosmetic request is pending.
    if (!event.sender.isDestroyed() && frame.url === url)
      console.warn("Shields cosmetic styles could not be applied.");
  }
}

function attachEngine(next: ElectronBlocker) {
  if (engine?.isBlockingEnabled(session.defaultSession))
    engine.disableBlockingInSession(session.defaultSession);
  engine = next;
  next.enableBlockingInSession(session.defaultSession);
  // Electron supports only one handler per webRequest event. This service owns
  // both filters and site exceptions, rather than registering competing listeners.
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["<all_urls>"] },
    (details, callback) => {
      const contents = details.webContentsId
        ? websiteContents.get(details.webContentsId)
        : undefined;
      const sourceUrl =
        details.resourceType === "mainFrame"
          ? details.url
          : contents?.getURL() || details.referrer;
      if (
        !preferences.enabled ||
        !contents ||
        isSiteExcluded(sourceUrl, preferences.disabledSites) ||
        details.resourceType === "mainFrame"
      )
        return callback({});
      const request = fromElectronDetails({ ...details, referrer: sourceUrl });
      const custom = customEngine?.match(request);
      // Explicit custom exceptions also override the built-in lists.
      const result = custom?.exception
        ? custom
        : custom?.match
          ? custom
          : next.match(request);
      if (result.match || result.redirect) {
        status.blockedRequests++;
        if (!notificationTimer)
          notificationTimer = setTimeout(() => {
            notificationTimer = undefined;
            notifyStatus();
          }, 500);
      }
      if (result.redirect) callback({ redirectURL: result.redirect.dataUrl });
      else if (result.rewrite?.url)
        callback({ redirectURL: result.rewrite.url });
      else callback({ cancel: result.match });
    },
  );
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["<all_urls>"] },
    (details, callback) => {
      if (
        !permitted(
          details.webContentsId
            ? websiteContents.get(details.webContentsId)
            : undefined,
        )
      )
        callback({});
      else next.onHeadersReceived(details, callback);
    },
  );
  // The library registers global cosmetic IPC. Restrict it to actual website
  // views and their actual frame URL; never inject into chrome, SSO or portals.
  ipcMain.removeHandler("@ghostery/adblocker/inject-cosmetic-filters");
  ipcMain.handle(
    "@ghostery/adblocker/inject-cosmetic-filters",
    async (event, url: unknown, message: unknown) => {
      if (
        !permitted(event.sender) ||
        typeof url !== "string" ||
        event.senderFrame?.url !== url
      )
        return;
      if (
        message !== undefined &&
        (!message ||
          typeof message !== "object" ||
          JSON.stringify(message).length > 100_000)
      )
        return;
      const parsed =
        message === undefined
          ? undefined
          : cosmeticMessageSchema.safeParse(message);
      if (parsed && !parsed.success) return;
      await injectCosmetics(next, event, url, parsed?.data);
      if (customEngine)
        await injectCosmetics(customEngine, event, url, parsed?.data);
    },
  );
  ipcMain.removeHandler("@ghostery/adblocker/is-mutation-observer-enabled");
  ipcMain.handle("@ghostery/adblocker/is-mutation-observer-enabled", (event) =>
    permitted(event.sender),
  );
  status.ready = true;
}

export function updateShieldLists() {
  if (stopping) return Promise.resolve();
  if (updatePromise) return updatePromise;
  status.updating = true;
  notifyStatus();
  updatePromise = (async () => {
    try {
      const next = await ElectronBlocker.fromPrebuiltFull(async (url) => {
        const response = await fetch(url, {
          signal: AbortSignal.any([
            AbortSignal.timeout(20_000),
            updateAbort.signal,
          ]),
        });
        if (!response.ok) throw new Error("Filter list download failed.");
        return response;
      });
      if (stopping) return;
      await writeFile(`${cachePath()}.tmp`, next.serialize(), { mode: 0o600 });
      await rename(`${cachePath()}.tmp`, cachePath());
      if (stopping) return;
      attachEngine(next);
      status.updatedAt = Date.now();
      writeBrowserSetting("shieldsUpdatedAt", status.updatedAt);
      status.error = null;
    } catch (error) {
      if (stopping) return;
      console.warn("Unable to update Shields filter lists.", error);
      status.error =
        "Filter update failed. The last available filter lists remain active.";
    } finally {
      status.updating = false;
      updatePromise = undefined;
      notifyStatus();
    }
  })();
  return updatePromise;
}

export async function initializeContentBlocker() {
  preferences = {
    ...defaultShieldPreferences,
    ...readBrowserSetting<Partial<ShieldPreferences>>("shields", {}),
  };
  customEngine = preferences.customFilters
    ? ElectronBlocker.parse(preferences.customFilters)
    : undefined;
  status.updatedAt = readBrowserSetting<number | null>(
    "shieldsUpdatedAt",
    null,
  );
  for (const filename of [
    cachePath(),
    path.join(app.getAppPath(), "assets", "shields-engine.bin"),
  ]) {
    try {
      attachEngine(ElectronBlocker.deserialize(await readFile(filename)));
      break;
    } catch {
      /* Try the bundled engine if the cached version is missing/incompatible. */
    }
  }
  if (!engine) {
    status.error =
      "No filter lists are available. Use Update filters to enable protection.";
    await updateShieldLists();
  } else if (
    preferences.automaticUpdates &&
    (!status.updatedAt || Date.now() - status.updatedAt > 86_400_000)
  )
    void updateShieldLists();
  updateTimer = setInterval(() => {
    if (
      preferences.automaticUpdates &&
      (!status.updatedAt || Date.now() - status.updatedAt > 86_400_000)
    )
      void updateShieldLists();
  }, 60 * 60_000);
  updateTimer.unref();
  const preferenceSchema = z.object({
    enabled: z.boolean(),
    automaticUpdates: z.boolean(),
    disabledSites: z.array(z.string().max(253)).max(500),
    customFilters: z.string().max(100_000),
  });
  ipcMain.handle("shields:status", (event) => {
    requireApplication(event);
    return getShieldStatus();
  });
  ipcMain.handle("shields:update", (event) => {
    requireApplication(event);
    return updateShieldLists().then(getShieldStatus);
  });
  ipcMain.handle("shields:preferences", (event, value: unknown) => {
    requireApplication(event);
    const next = preferenceSchema.parse(value);
    next.disabledSites = [...new Set(next.disabledSites.map(normalizeSite))];
    const filters = next.customFilters
      ? ElectronBlocker.parse(next.customFilters)
      : undefined;
    writeBrowserSetting("shields", next);
    preferences = next;
    customEngine = filters;
    notifyStatus();
    return getShieldStatus();
  });
}

export function stopContentBlocker() {
  stopping = true;
  updateAbort.abort();
  clearTimeout(notificationTimer);
  clearInterval(updateTimer);
  if (engine?.isBlockingEnabled(session.defaultSession))
    engine.disableBlockingInSession(session.defaultSession);
  websiteContents.clear();
}
