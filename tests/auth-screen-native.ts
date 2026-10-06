import assert from "node:assert/strict";
import { app, BrowserWindow } from "electron";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 720,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    try {
      const assets = path.resolve("dist/assets");
      const stylesheet = readdirSync(assets).find((name) =>
        /^index-.*\.css$/.test(name),
      )!;
      const css = readFileSync(path.join(assets, stylesheet), "utf8");
      const script = readFileSync(
        ".vite/auth-screen-renderer.js",
        "utf8",
      ).replace(/<\/script/gi, "<\\/script");
      await window.loadURL(
        'data:text/html,<div id="root" style="height:100vh"></div>',
      );
      await window.webContents.insertCSS(css);
      await window.webContents.executeJavaScript(script);
      const run = (source: string) =>
        window.webContents.executeJavaScript(source);
      const wait = async (expression: string) => {
        const deadline = Date.now() + 5000;
        while (!(await run(expression))) {
          assert(Date.now() < deadline, "UI state did not settle");
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
      };
      await wait('Boolean(document.querySelector("header input"))');
      const tab = await run(
        '(() => { const tab = document.querySelector("[role=tab]"); return { tag: tab.tagName, gap: getComputedStyle(tab).columnGap, selected: tab.getAttribute("aria-selected") }; })()',
      );
      assert.equal(tab.tag, "DIV");
      assert.equal(tab.gap, "8px");
      assert.equal(tab.selected, "true");
      const dimensions = await run(
        '(() => { const header = document.querySelector("section header"); const back = header.querySelector("button"); return { height: header.getBoundingClientRect().height, input: header.querySelector("input").getBoundingClientRect().height, text: back.textContent.trim(), label: back.getAttribute("aria-label") }; })()',
      );
      assert.equal(dimensions.height, 56);
      assert.equal(dimensions.input, 36);
      assert.equal(dimensions.text, "");
      assert.equal(dimensions.label, "Quay lại trang hồ sơ Gorth");
      await run('document.querySelector("section header button").click()');
      await wait('Boolean(document.querySelector("[data-route]"))');
      assert.equal(await run("window.authUiTest.cancelled"), 1);
      assert.equal(
        await run(
          'document.querySelector("[data-route]").getAttribute("data-route")',
        ),
        "gorth://settings/profile",
      );
      await run("window.authUiTest.open()");
      await wait('Boolean(document.querySelector("header input"))');
      await new Promise((resolve) => setTimeout(resolve, 100));
      await run("window.authUiTest.finish(false)");
      await new Promise((resolve) => setTimeout(resolve, 650));
      assert.deepEqual(
        await run("window.authUiErrors"),
        [],
        "Browser chrome must not crash when rendering gorth://auth",
      );
      assert(
        await run(
          'Boolean(document.querySelector("header.app-drag [data-tab-id=sso] svg"))',
        ),
        "Browser titlebar must survive the transition from SSO to gorth://auth",
      );
      assert.equal(
        await run("window.authUiTest.returned"),
        1,
        "Failure must not auto-navigate",
      );
      await run("window.authUiTest.finish(true)");
      await wait('Boolean(document.querySelector("[data-route]"))');
      assert.equal(await run("window.authUiTest.returned"), 2);
      assert.equal(
        await run(
          'getComputedStyle(document.querySelector("header.app-drag")).webkitAppRegion',
        ),
        "drag",
      );
      assert.equal(BrowserWindow.getAllWindows().length, 1);
      const iconCount = await run("window.authUiTest.showAllIcons()");
      await wait('Boolean(document.querySelector("[data-all-icons]"))');
      assert.equal(
        await run('document.querySelectorAll("[data-icon-page] svg").length'),
        iconCount,
      );
      assert.deepEqual(await run("window.authUiErrors"), []);
      console.info(
        "Auth renderer: real titlebar survives SSO → auth → profile, drag region preserved, all internal icons render, h-14/h-9 controls and no popup passed.",
      );
    } finally {
      window.destroy();
    }
  })
  .then(() => app.exit(0))
  .catch((error: unknown) => {
    console.error("Auth renderer regression failed (test fixture only).");
    console.error(error);
    app.exit(1);
  });
