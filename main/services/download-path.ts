import path from "node:path";
import { lstatSync } from "node:fs";

export function getSafeDownloadName(filename: string): string {
  let name = Array.from(
    path.win32.basename(path.posix.basename(filename)),
    (character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
        ? "_"
        : character,
  )
    .join("")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/[ .]+$/, "")
    .trim();
  if (!name || name === "." || name === "..") name = "download";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
    name = `download-${name}`;
  // Leave room for collision suffixes within common filesystem filename limits.
  while (Buffer.byteLength(name) > 220) name = name.slice(0, -1);
  return name;
}

export function getAvailableDownloadPath(
  directory: string,
  filename: string,
  reserved: ReadonlySet<string>,
): string {
  const safeName = getSafeDownloadName(filename);
  const extension = path.extname(safeName);
  const stem = path.basename(safeName, extension);
  let candidate = path.join(directory, safeName);
  let suffix = 1;
  while (
    [...reserved].some((entry) =>
      process.platform === "linux"
        ? entry === candidate
        : entry.toLowerCase() === candidate.toLowerCase(),
    ) ||
    lstatSync(candidate, { throwIfNoEntry: false })
  ) {
    candidate = path.join(directory, `${stem} (${suffix++})${extension}`);
  }
  return candidate;
}
