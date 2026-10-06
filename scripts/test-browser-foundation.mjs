import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import electron from "electron";
await build({
  entryPoints: ["tests/browser-foundation.test.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron", "better-sqlite3"],
  outfile: ".vite/browser-foundation-test.cjs",
});
const result = spawnSync(
  electron,
  ["--test", ".vite/browser-foundation-test.cjs"],
  { stdio: "inherit", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } },
);
process.exitCode = result.status ?? 1;
