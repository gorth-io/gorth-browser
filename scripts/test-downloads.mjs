import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
import electron from "electron";

const native = process.argv.includes("--native");
const output = native
  ? ".vite/downloads-native-test.cjs"
  : ".vite/downloads-test.cjs";
await build({
  entryPoints: [
    native ? "tests/downloads-native.test.ts" : "tests/downloads.test.ts",
  ],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3", "electron"],
  alias: native
    ? {
        "@/main/windows/capital": path.resolve(
          "tests/download-windows-mock.ts",
        ),
      }
    : {},
  outfile: output,
});
const env = { ...process.env };
if (native) delete env.ELECTRON_RUN_AS_NODE;
else env.ELECTRON_RUN_AS_NODE = "1";
const result = spawnSync(electron, native ? [output] : ["--test", output], {
  stdio: "inherit",
  env,
});
process.exitCode = result.status ?? 1;
