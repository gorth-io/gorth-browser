import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import electron from "electron";

await build({
  entryPoints: ["tests/tab-groups.test.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3", "electron"],
  outfile: ".vite/tab-groups-test.cjs",
});
// Native SQLite is built for Electron's ABI, not the shell's Node version.
const result = spawnSync(electron, ["--test", ".vite/tab-groups-test.cjs"], {
  stdio: "inherit",
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
});
process.exitCode = result.status ?? 1;
