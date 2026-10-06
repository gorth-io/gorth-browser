// Generate the offline-capable bundled full Ghostery/uBlock filter engine.
import { ElectronBlocker } from "@ghostery/adblocker-electron";
import { writeFile } from "node:fs/promises";
const engine = await ElectronBlocker.fromPrebuiltFull(async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok)
    throw new Error(`Filter download failed: ${response.status}`);
  return response;
});
await writeFile(
  new URL("../assets/shields-engine.bin", import.meta.url),
  engine.serialize(),
);
console.log("Bundled Shields engine generated.");
