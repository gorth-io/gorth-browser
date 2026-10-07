import assert from "node:assert/strict";
import { test } from "node:test";
import { createTRPCClient, httpLink } from "@trpc/client";
import {
  desktopRouter,
  type DesktopContext,
  type DesktopRouter,
} from "@/main/rpc/router";
import { handleRpcRequest } from "@/main/rpc/transport";
import { isRpcRendererUrl } from "@/main/rpc/sender";
import {
  defaultBrowserPreferences,
  type PersistedTabGroup,
} from "@/lib/browser/persistence";
import { createInternalRouter } from "@/lib/browser/router";

function client(context: DesktopContext) {
  return createTRPCClient<DesktopRouter>({
    links: [
      httpLink({
        url: "https://desktop.invalid/trpc",
        fetch: async (url, options) => {
          const result = await handleRpcRequest(
            desktopRouter,
            {
              url: String(url),
              method: options?.method ?? "GET",
              ...(typeof options?.body === "string"
                ? { body: options.body }
                : {}),
            },
            context,
          );
          return new Response(result.body, {
            status: result.status,
            headers: { "content-type": "application/json" },
          });
        },
      }),
    ],
  });
}
test("browser RPC restores snapshots, saves/deletes groups and validates input", async () => {
  let groups: PersistedTabGroup[] = [];
  const context: DesktopContext = {
    load: () => ({
      activeTabId: null,
      splitTabId: null,
      tabs: [],
      bookmarks: [],
      history: [],
      preferences: defaultBrowserPreferences,
      groups,
    }),
    listGroups: () => groups,
    saveGroup: (group) => {
      groups = [group];
      return groups;
    },
    deleteGroup: (id) => {
      groups = groups.filter((group) => group.id !== id);
      return groups;
    },
  };
  const rpc = client(context);
  assert.deepEqual(
    (await rpc.session.load.query()).preferences,
    defaultBrowserPreferences,
  );
  const group = {
    id: "group",
    name: "Research",
    mode: "split" as const,
    tabIds: ["one", "two"],
  };
  assert.deepEqual(await rpc.groups.save.mutate(group), [group]);
  assert.deepEqual(await rpc.groups.list.query(), [group]);
  for (const invalid of [
    { ...group, tabIds: ["one"] },
    { ...group, tabIds: ["one", "one"] },
    { ...group, name: "" },
  ])
    await assert.rejects(rpc.groups.save.mutate(invalid));
  assert.deepEqual(await rpc.groups.delete.mutate("group"), []);
  const wrongMethod = await handleRpcRequest(
    desktopRouter,
    { url: "https://desktop.invalid/trpc/groups.delete", method: "GET" },
    context,
  );
  assert.equal(wrongMethod.status, 405);
});
test("all browser internal routes resolve without changing shell URL", async () => {
  const router = createInternalRouter("settings/help", () => null);
  await router.load();
  assert.equal(router.state.matches.at(-1)?.status, "success");
  assert.equal(router.state.location.pathname, "/settings/help");
  router.history.push("/history");
  router.update({});
  await router.load();
  assert.equal(router.state.matches.at(-1)?.status, "success");
  assert.equal(router.state.location.pathname, "/history");
});
test("RPC only accepts bounded requests to the local adapter endpoint", async () => {
  for (const input of [
    null,
    {},
    { url: "https://attacker.example/trpc/session.load", method: "GET" },
    { url: "file:///trpc/session.load", method: "GET" },
    { url: "https://desktop.invalid/trpc/session.load", method: "DELETE" },
    {
      url: "https://desktop.invalid/trpc/session.load",
      method: "GET",
      body: "{}",
    },
    {
      url: "https://desktop.invalid/trpc/session.load",
      method: "GET",
      headers: {},
    },
    {
      url: "https://user:pass@desktop.invalid/trpc/session.load",
      method: "GET",
    },
    {
      url: "https://desktop.invalid/trpc/session.load#fragment",
      method: "GET",
    },
    {
      url: "https://desktop.invalid/trpc/session.load",
      method: "POST",
      body: "a".repeat(8_000_001),
    },
  ]) {
    const result = await handleRpcRequest(desktopRouter, input, {});
    assert.equal(result.status, 400);
    assert.equal(JSON.parse(result.body).error.data.code, "BAD_REQUEST");
  }
});
test("RPC renderer URL cannot be a remote site, auth page, portal, or wrong file", () => {
  const expected = "http://127.0.0.1:5501/assets/index.html";
  assert(isRpcRendererUrl(expected, expected));
  assert(isRpcRendererUrl(expected + "?theme=dark", expected));
  for (const value of [
    "about:blank",
    "https://google.com",
    "http://127.0.0.1:5501/auth/callback",
    "http://127.0.0.1:5502/assets/index.html",
    "http://user:pass@127.0.0.1:5501/assets/index.html",
  ])
    assert(!isRpcRendererUrl(value, expected));
  assert(
    isRpcRendererUrl(
      "file:///app/assets/index.html",
      "file:///app/assets/index.html",
    ),
  );
  assert(
    !isRpcRendererUrl(
      "file:///other/index.html",
      "file:///app/assets/index.html",
    ),
  );
  assert(
    !isRpcRendererUrl(
      "file://attacker/app/assets/index.html",
      "file:///app/assets/index.html",
    ),
  );
});
