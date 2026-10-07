import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import electron from "electron";

await build({
  entryPoints: ["tests/navigation.test.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".vite/navigation.test.cjs",
});
const unitResult = spawnSync(
  process.execPath,
  ["--test", ".vite/navigation.test.cjs"],
  {
    stdio: "inherit",
  },
);
if (unitResult.status !== 0) process.exit(unitResult.status ?? 1);

await build({
  entryPoints: ["tests/network-native.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron", "typescript"],
  outfile: ".vite/network-native.cjs",
});
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const result = spawnSync(electron, [".vite/network-native.cjs"], {
  stdio: "inherit",
  env: environment,
  timeout: 70_000,
});
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
