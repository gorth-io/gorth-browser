import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { app, BrowserWindow } from "electron";
import ts from "typescript";
import { createWebview } from "@/main/windows/webview";
import { loadWebsite, canRecoverQuicFailure } from "@/main/services/navigation";

// Read the startup policy without importing main or opening the user's database.
const source = ts.createSourceFile(
  "app/main.ts",
  readFileSync("app/main.ts", "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const policyIndex = source.statements.findIndex(
  (statement) =>
    ts.isExpressionStatement(statement) &&
    ts.isCallExpression(statement.expression) &&
    statement.expression.expression.getText(source) ===
      "app.commandLine.appendSwitch" &&
    statement.expression.arguments[0]?.getText(source) === '"disable-quic"',
);
assert.equal(policyIndex, -1, "Main must not disable QUIC");
assert.equal(app.isReady(), false);
assert.equal(app.commandLine.hasSwitch("disable-quic"), false);
assert.equal(app.commandLine.hasSwitch("ignore-certificate-errors"), false);

const directory = mkdtempSync(path.join(tmpdir(), "gorth-network-test-"));
app.setPath("userData", directory);
app.setPath("sessionData", directory);
let window: BrowserWindow | undefined;
const timeout = setTimeout(() => {
  console.error("Website network test timed out");
  app.exit(1);
}, 60_000);
app.once("quit", () => {
  clearTimeout(timeout);
  rmSync(directory, { recursive: true, force: true });
});

void (async () => {
  try {
    await app.whenReady();
    assert.equal(app.commandLine.hasSwitch("disable-quic"), false);
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const { view } = createWebview(window);
    for (const url of ["https://www.google.com/", "https://www.youtube.com/"]) {
      // YouTube may replace its initial navigation with ?themeRefresh=1.
      const loadedPage = new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          view.webContents.off("did-finish-load", finish);
          view.webContents.off("did-fail-load", fail);
        };
        const finish = () => {
          cleanup();
          resolve();
        };
        const fail = (
          _event: Electron.Event,
          code: number,
          description: string,
          _url: string,
          isMainFrame: boolean,
        ) => {
          if (!isMainFrame || code === -3) return;
          if (canRecoverQuicFailure(view.webContents, code)) return;
          cleanup();
          reject(new Error(description + " (" + code + ")"));
        };
        view.webContents.on("did-finish-load", finish);
        view.webContents.on("did-fail-load", fail);
        void loadWebsite(view.webContents, url).catch((error: unknown) => {
          if (
            error &&
            typeof error === "object" &&
            "errno" in error &&
            error.errno === -3
          )
            return;
          cleanup();
          reject(error);
        });
      });
      await loadedPage;
      const loaded = new URL(view.webContents.getURL());
      assert.equal(loaded.protocol, "https:");
      assert.ok(view.webContents.getTitle().length > 0);
      console.log(
        "Website loaded:",
        loaded.hostname,
        "—",
        view.webContents.getTitle(),
        "protocol:",
        await view.webContents.executeJavaScript(
          'performance.getEntriesByType("navigation")[0]?.nextHopProtocol',
        ),
      );
    }
    view.webContents.close();
    window.destroy();
    app.quit();
  } catch (error) {
    console.error(error);
    window?.destroy();
    app.exit(1);
  }
})();
