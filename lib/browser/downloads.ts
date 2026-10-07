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
