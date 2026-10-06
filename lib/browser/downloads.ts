export type DownloadState =
  "progressing" | "paused" | "completed" | "cancelled" | "interrupted";

export interface DownloadRecord {
  id: string;
  filename: string;
  url: string;
  savePath: string;
  mimeType: string;
  receivedBytes: number;
  totalBytes: number;
  state: DownloadState;
  startedAt: number;
  updatedAt: number;
}

export interface DownloadInfo extends DownloadRecord {
  isActive: boolean;
  canResume: boolean;
  bytesPerSecond: number;
}

export interface DownloadPreferences {
  directory: string;
  askWhereToSave: boolean;
}

export interface DownloadNotification {
  kind: "started" | "completed" | "interrupted";
  filename: string;
}

export function formatDownloadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** unit).toLocaleString(undefined, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}
