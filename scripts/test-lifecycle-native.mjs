import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import electron from "electron";
await build({
  entryPoints: ["tests/lifecycle-native-preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: ".vite/lifecycle-native-preload.cjs",
});
await build({
  entryPoints: ["tests/lifecycle-native.test.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron", "better-sqlite3", "@ghostery/adblocker-electron"],
  outfile: ".vite/lifecycle-native-test.cjs",
});
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const result = spawnSync(electron, [".vite/lifecycle-native-test.cjs"], {
  stdio: "inherit",
  env,
  timeout: 70_000,
});
process.exitCode = result.status ?? 1;
