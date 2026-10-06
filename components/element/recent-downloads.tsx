import { useEffect, useState } from "react";
import { Download, FolderOpen } from "lucide-react";
import { PopoverMenuItem } from "@/components/element/popover-menu";
import { Separator } from "@/components/ui/separator";
import type { DownloadInfo } from "@/lib/browser/downloads";

export function RecentDownloads({
  onShowAll,
  onClose,
}: {
  onShowAll: () => void;
  onClose: () => void;
}) {
  const [downloads, setDownloads] = useState<DownloadInfo[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let revision = 0;
    const refresh = async () => {
      const current = ++revision;
      try {
        const records = await window.electronAPI.downloads.list();
        if (!disposed && current === revision) {
          setDownloads(
            records.sort((a, b) => b.startedAt - a.startedAt).slice(0, 4),
          );
          setError("");
        }
      } catch {
        if (!disposed) setError("Unable to load downloads");
      }
    };
    const unsubscribe = window.electronAPI.downloads.onChanged(
      () => void refresh(),
    );
    void refresh();
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const open = async (download: DownloadInfo) => {
    try {
      if (download.state === "completed")
        await window.electronAPI.downloads.open(download.id);
      else {
        onShowAll();
      }
      onClose();
    } catch {
      setError("Unable to open download");
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 4 }, (_, index) => {
        const download = downloads[index];
        return (
          <PopoverMenuItem
            key={download?.id ?? index}
            className="h-9"
            disabled={!download}
            aria-label={
              download
                ? `${download.filename} (${download.state})`
                : "No recent download"
            }
            onClick={() => download && void open(download)}
          >
            <Download />
            <span className="min-w-0 flex-1 truncate">
              {download?.filename ??
                (index === 0 ? error || "No recent downloads" : "—")}
            </span>
          </PopoverMenuItem>
        );
      })}
      <Separator />
      <PopoverMenuItem
        className="h-9"
        onClick={() => {
          onClose();
          onShowAll();
        }}
      >
        <FolderOpen /> Show all
      </PopoverMenuItem>
      {error && downloads.length > 0 && (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}
    </div>
  );
}
