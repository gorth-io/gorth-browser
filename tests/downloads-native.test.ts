import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { app, BrowserWindow, session } from "electron";
import {
  initializeDatabase,
  closeDatabase,
  saveDownloadPreferences,
  loadDownloads,
} from "@/services/browser-database";
import {
  installDownloadManager,
  shutdownDownloadManager,
  getDownloads,
  controlDownload,
  removeDownload,
  clearDownloadHistory,
  retryDownload,
  openDownload,
} from "@/main/services/downloads";

const directory = mkdtempSync(path.join(tmpdir(), "gorth-download-native-"));
const profile = path.join(directory, "profile");
const destination = path.join(directory, "files");
mkdirSync(profile);
mkdirSync(destination);
app.setPath("userData", profile);
app.setPath("sessionData", profile);

async function waitFor<T>(
  read: () => T | undefined | false,
  timeout = 10000,
): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Download test timed out.");
}

async function run() {
  await app.whenReady();
  initializeDatabase(profile);
  saveDownloadPreferences({ directory: destination, askWhereToSave: false });
  installDownloadManager(session.defaultSession);
  const server = createServer((request, response) => {
    const slow = request.url?.startsWith("/slow");
    const total = slow ? 2 * 1024 * 1024 : 16384;
    const start = Number(
      request.headers.range?.match(/bytes=(\d+)-/)?.[1] ?? 0,
    );
    response.writeHead(start ? 206 : 200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${slow ? "slow.bin" : "file.bin"}"`,
      "Content-Length": total - start,
      "Accept-Ranges": "bytes",
      ETag: '"gorth-test-v1"',
      "Last-Modified": "Mon, 01 Jan 2024 00:00:00 GMT",
      ...(start
        ? { "Content-Range": `bytes ${start}-${total - 1}/${total}` }
        : {}),
    });
    if (!slow) {
      response.end(Buffer.alloc(total - start, 7));
      return;
    }
    let offset = start;
    const timer = setInterval(() => {
      const size = Math.min(32768, total - offset);
      response.write(Buffer.alloc(size, 7));
      offset += size;
      if (offset >= total) {
        clearInterval(timer);
        response.end();
      }
    }, 30);
    response.once("close", () => clearInterval(timer));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await window.loadURL("about:blank");
    window.webContents.downloadURL(`http://127.0.0.1:${port}/file`);
    const first = await waitFor(() =>
      getDownloads().find((item) => item.state === "completed"),
    );
    assert.equal(readFileSync(first.savePath).length, 16384);
    window.webContents.downloadURL(`http://127.0.0.1:${port}/file`);
    const second = await waitFor(() =>
      getDownloads().find(
        (item) => item.state === "completed" && item.id !== first.id,
      ),
    );
    assert.notEqual(first.savePath, second.savePath);
    assert.equal(second.filename, "file (1).bin");
    window.webContents.downloadURL(`http://127.0.0.1:${port}/slow`);
    const slow = await waitFor(() =>
      getDownloads().find((item) => item.isActive && item.receivedBytes > 0),
    );
    controlDownload(slow.id, "pause");
    assert.equal(
      getDownloads().find((item) => item.id === slow.id)?.state,
      "paused",
    );
    assert.throws(() => removeDownload(slow.id));
    clearDownloadHistory();
    assert.equal(getDownloads().length, 1);
    assert.ok(existsSync(first.savePath));
    controlDownload(slow.id, "resume");
    await waitFor(() =>
      getDownloads().find(
        (item) => item.id === slow.id && item.state === "completed",
      ),
    );
    window.webContents.downloadURL(`http://127.0.0.1:${port}/slow?cancel`);
    const cancelled = await waitFor(() =>
      getDownloads().find((item) => item.isActive && item.receivedBytes > 0),
    );
    controlDownload(cancelled.id, "cancel");
    await waitFor(() =>
      getDownloads().find(
        (item) => item.id === cancelled.id && item.state === "cancelled",
      ),
    );
    retryDownload(cancelled.id, window);
    await waitFor(() => getDownloads().find((item) => item.isActive));
    await waitFor(
      () =>
        getDownloads().filter((item) => item.state === "completed").length ===
        2,
    );
    removeDownload(slow.id);
    assert.ok(existsSync(slow.savePath));
    assert.equal(loadDownloads().length, 2);
    await assert.rejects(
      () => openDownload(cancelled.id, window, false),
      /not completed/,
    );
    console.log(
      "PASS: real Electron downloads, unique filenames, pause/resume, cancel/retry, persisted history and non-destructive removal.",
    );
  } finally {
    shutdownDownloadManager();
    closeDatabase();
    window.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

run()
  .then(() => {
    rmSync(directory, { recursive: true, force: true });
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    shutdownDownloadManager();
    closeDatabase();
    app.exit(1);
  });
