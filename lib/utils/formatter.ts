export function formatFileSize(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0 B";
  if (value < 1024) return `${Math.round(value)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value;
  let index = -1;
  do {
    size /= 1024;
    index += 1;
  } while (size >= 1024 && index < units.length - 1);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(value: Date | number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

/** Full local date/time, preserving the display used by history and downloads. */
export function formatDateTime(value: Date | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString();
}

export function formatInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "G"
  );
}

/** Download sizes use locale-aware grouping and at most one decimal. */
export function formatDownloadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.max(
    0,
    Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1),
  );
  return `${(bytes / 1024 ** unit).toLocaleString(undefined, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}

export function formatTransferRate(bytesPerSecond: number): string {
  return `${formatDownloadBytes(bytesPerSecond)}/s`;
}

/** The download manager supplies an already rounded estimate in seconds. */
export function formatRemainingTime(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${Math.ceil(seconds / 60)} min`;
}

/** Display only; never use the shortened address for navigation or validation. */
export function formatAddress(value: string): string {
  return value
    .replace(/^https?:\/\/(?:www\.)?/i, "")
    .replace(/^([^/?#]+)\/$/, "$1");
}
