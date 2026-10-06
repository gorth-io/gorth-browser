import assert from "node:assert/strict";
import { app, BrowserWindow } from "electron";
import { createServer } from "node:http";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import {
  initializeDatabase,
  closeDatabase,
  writeBrowserSetting,
  listArchivedTabs,
} from "@/services/browser-database";
import { getBrowserState, createTabView } from "@/main/windows/capital";
import {
  sleepTab,
  wakeTab,
  archiveBrowserTab,
} from "@/main/services/tab-lifecycle";
import {
  initializeContentBlocker,
  stopContentBlocker,
  getShieldStatus,
} from "@/main/services/content-blocker";
import { defaultShieldPreferences } from "@/lib/browser/shields";

const directory = mkdtempSync(path.join(tmpdir(), "gorth-lifecycle-native-"));
app.setPath("userData", directory);
app.setPath("sessionData", directory);
const timeout = setTimeout(() => {
  console.error("Native lifecycle test timed out");
  app.exit(1);
}, 60_000);
let window: BrowserWindow | undefined;
const hits = new Map<string, number>();
const server = createServer((request, response) => {
  const url = request.url ?? "/";
  hits.set(url, (hits.get(url) ?? 0) + 1);
  if (url.endsWith(".js")) {
    response.setHeader("content-type", "application/javascript");
    response.end("window.advertisementLoaded = true");
    return;
  }
  response.setHeader("content-type", "text/html");
  response.end(
    `<title>Fixture ${url}</title><input id="editor" value="initial"><div class="gorth-test-ad">Advertisement</div><a id="new-tab" href="/target" target="_blank">Open</a><script src="/gorth-test-ad.js"></script>`,
  );
});

void (async () => {
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    const origin = `http://127.0.0.1:${port}`;
    await app.whenReady();
    initializeDatabase(directory);
    writeBrowserSetting("shields", {
      ...defaultShieldPreferences,
      automaticUpdates: false,
      customFilters: "*/gorth-test-ad.js$script\n127.0.0.1##.gorth-test-ad",
    });
    copyFileSync(
      path.join(process.cwd(), "assets", "shields-engine.bin"),
      path.join(directory, "shields-engine.bin"),
    );
    await initializeContentBlocker();
    assert.equal(getShieldStatus().ready, true);
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "lifecycle-native-preload.cjs"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    const state = getBrowserState(window);
    await window.loadURL(
      "data:text/html,<title>Chrome</title><div class='gorth-test-ad'>Chrome is not filtered</div>",
    );
    await window.webContents.executeJavaScript(
      "window.fixture.onOpen(url => { window.lastRequestedUrl = url; })",
    );
    const add = async (id: string, url: string) => {
      state.tabMetadata.set(id, {
        id,
        title: id,
        url,
        faviconUrl: "",
        isMuted: false,
        isPinned: false,
        internalPage: null,
        lastActiveAt: Date.now() - 1_000_000,
      });
      const record = createTabView(window!, id);
      await record.view.webContents.loadURL(url);
      return record;
    };
    const record = await add("background", `${origin}/first`);
    await record.view.webContents.loadURL(`${origin}/second`);
    assert.equal(
      hits.get("/gorth-test-ad.js") ?? 0,
      0,
      "Custom network filter must cancel requests before the server receives them",
    );
    const waitUntil = async (check: () => Promise<boolean>) => {
      for (let i = 0; i < 40; i++) {
        if (await check()) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error("Cosmetic filter was not applied");
    };
    await waitUntil(() =>
      record.view.webContents.executeJavaScript(
        "getComputedStyle(document.querySelector('.gorth-test-ad')).display === 'none'",
      ),
    );
    assert.equal(
      await window.webContents.executeJavaScript(
        "getComputedStyle(document.querySelector('.gorth-test-ad')).display === 'none'",
      ),
      false,
      "Chrome must not receive cosmetic filters",
    );
    const oldContents = record.view.webContents;
    const oldId = oldContents.id;
    assert.equal(await sleepTab(window, "background"), true);
    assert.equal(
      oldContents.isDestroyed(),
      true,
      "Sleeping releases the actual renderer",
    );
    assert.equal(state.views.has("background"), false);
    assert.equal(state.tabMetadata.get("background")?.isSleeping, true);
    await wakeTab(window, "background");
    const woke = state.views.get("background")!.view.webContents;
    assert.notEqual(woke.id, oldId);
    assert.equal(woke.getURL(), `${origin}/second`);
    assert.equal(
      woke.navigationHistory.canGoBack(),
      true,
      "Wake preserves back/forward history",
    );
    state.activeTabId = "background";
    assert.equal(await sleepTab(window, "background"), false);
    state.activeTabId = "home";
    await woke.executeJavaScript(
      "document.querySelector('#editor').value = 'unsaved draft'",
    );
    assert.equal(
      await sleepTab(window, "background"),
      false,
      "Do not discard edited forms",
    );
    await woke.executeJavaScript(
      "document.querySelector('#editor').value = 'initial'",
    );
    state.tabMetadata.get("background")!.isPinned = true;
    assert.equal(
      await archiveBrowserTab(window, "background"),
      false,
      "Pinned tabs cannot be archived",
    );
    state.tabMetadata.get("background")!.isPinned = false;
    await woke.executeJavaScript("document.querySelector('#new-tab').click()");
    await waitUntil(() =>
      window!.webContents.executeJavaScript(
        `window.lastRequestedUrl === ${JSON.stringify(`${origin}/target`)}`,
      ),
    );
    assert.equal(
      woke.getURL(),
      `${origin}/second`,
      "target=_blank must not overwrite its source tab",
    );
    assert.equal(await archiveBrowserTab(window, "background"), true);
    assert.equal(listArchivedTabs().length, 1);
    assert.equal(state.views.has("background"), false);
    await window.webContents.executeJavaScript(
      `window.fixture.shields.save(${JSON.stringify({ ...defaultShieldPreferences, automaticUpdates: false, disabledSites: ["127.0.0.1"], customFilters: "*/gorth-test-ad.js$script\n127.0.0.1##.gorth-test-ad" })})`,
    );
    const allowed = await add("allowlisted", `${origin}/allowlisted`);
    assert.equal(
      hits.get("/gorth-test-ad.js"),
      1,
      "Site exception must bypass blocking",
    );
    assert.equal(
      await allowed.view.webContents.executeJavaScript(
        "getComputedStyle(document.querySelector('.gorth-test-ad')).display === 'none'",
      ),
      false,
    );
    console.log(
      "PASS: native sleep/wake/history, protected tabs, archive, target=_blank, network/cosmetic filters, chrome isolation and per-site exceptions",
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
    window?.destroy();
    stopContentBlocker();
    closeDatabase();
    server.close();
    rmSync(directory, { recursive: true, force: true });
    app.exit(process.exitCode ?? 0);
  }
})();
