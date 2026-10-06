import { useEffect, useState } from "react";
import {
  Download,
  File,
  FolderOpen,
  Pause,
  Play,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { PageShell, EmptyState } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatDownloadBytes,
  type DownloadInfo,
  type DownloadState,
} from "@/lib/browser/downloads";
import type { BrowserInternalPage } from "@/lib/browser/internal-pages";

const stateLabels: Record<DownloadState, string> = {
  progressing: "Downloading",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  interrupted: "Interrupted",
};

export function DownloadsPage({
  onOpenInternal,
}: {
  onOpenInternal: (page: Exclude<BrowserInternalPage, "new-tab">) => void;
}) {
  const [downloads, setDownloads] = useState<DownloadInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "finished">("all");
  const [busy, setBusy] = useState(new Set<string>());
  useEffect(() => {
    let cancelled = false;
    let request = 0;
    const refresh = async () => {
      const version = ++request;
      try {
        const result = await window.electronAPI.downloads.list();
        if (cancelled || version !== request) return;
        setDownloads(result);
        setLoadError("");
      } catch {
        if (!cancelled && version === request)
          setLoadError(
            "Unable to load downloads. Please reopen this page to try again.",
          );
      } finally {
        if (!cancelled && version === request) setLoading(false);
      }
    };
    const unsubscribe = window.electronAPI.downloads.onChanged(
      () => void refresh(),
    );
    const unsubscribeErrors =
      window.electronAPI.downloads.onError(setActionError);
    void refresh();
    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeErrors();
    };
  }, []);
  const run = async (id: string, action: () => Promise<void>) => {
    setBusy((current) => new Set(current).add(id));
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to perform this download action.",
      );
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };
  const visible = downloads.filter(
    (item) =>
      (filter === "all" ||
        (filter === "active" ? item.isActive : !item.isActive)) &&
      `${item.filename} ${item.url}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <PageShell
      icon={Download}
      title="Downloads"
      description="Manage files downloaded from websites."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            aria-label="Search downloads"
            placeholder="Search downloads"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button
          className="h-9"
          variant="outline"
          onClick={() => onOpenInternal("settings/downloads")}
        >
          <Settings className="size-4" />
          Download settings
        </Button>
        <Button
          className="h-9"
          variant="outline"
          disabled={
            busy.has("clear") || !downloads.some((item) => !item.isActive)
          }
          onClick={() =>
            void run("clear", () => window.electronAPI.downloads.clear())
          }
        >
          <Trash2 className="size-4" />
          Clear history
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "active", "finished"] as const).map((value) => (
          <Button
            key={value}
            className="h-9"
            variant={filter === value ? "default" : "outline"}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {value === "all"
              ? "All"
              : value === "active"
                ? "Downloading"
                : "Finished"}
          </Button>
        ))}
        <p className="text-xs text-muted-foreground">
          Removing history does not delete files.
        </p>
      </div>
      {(actionError || loadError) && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError || loadError}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading downloads…
        </p>
      ) : !visible.length ? (
        <EmptyState
          icon={Download}
          title={
            downloads.length ? "No matching downloads" : "No downloads yet"
          }
        >
          {downloads.length
            ? "Try a different search or filter."
            : "Downloaded files will appear here automatically."}
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {visible.map((item) => {
            const percent = item.totalBytes
              ? Math.min(
                  100,
                  Math.round((item.receivedBytes / item.totalBytes) * 100),
                )
              : null;
            const remaining =
              item.totalBytes && item.bytesPerSecond > 0
                ? Math.ceil(
                    Math.max(0, item.totalBytes - item.receivedBytes) /
                      item.bytesPerSecond,
                  )
                : null;
            const disabled = busy.has(item.id) || busy.has("clear");
            return (
              <Card key={item.id}>
                <CardContent className="flex gap-4 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <File className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className="min-w-0 flex-1 truncate font-medium"
                        title={item.filename}
                      >
                        {item.filename}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {stateLabels[item.state]}
                      </span>
                    </div>
                    <p
                      className="truncate text-xs text-muted-foreground"
                      title={item.url}
                    >
                      {item.url}
                    </p>
                    {item.isActive && (
                      <Progress
                        aria-label={`Download progress for ${item.filename}`}
                        value={percent}
                        className="[&_[data-slot=progress-indicator]]:duration-200"
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDownloadBytes(item.receivedBytes)}
                      {item.totalBytes > 0 &&
                        ` / ${formatDownloadBytes(item.totalBytes)}`}
                      {item.isActive && percent !== null && ` · ${percent}%`}
                      {item.state === "progressing" &&
                        item.bytesPerSecond > 0 &&
                        ` · ${formatDownloadBytes(item.bytesPerSecond)}/s`}
                      {item.state === "progressing" &&
                        remaining !== null &&
                        ` · ${remaining < 60 ? `${remaining}s` : `${Math.ceil(remaining / 60)} min`} remaining`}
                    </p>
                    {item.savePath && (
                      <p
                        className="truncate text-xs text-muted-foreground"
                        title={item.savePath}
                      >
                        {item.savePath}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {item.isActive && item.state === "progressing" && (
                        <Button
                          className="h-9"
                          variant="outline"
                          disabled={disabled}
                          onClick={() =>
                            void run(item.id, () =>
                              window.electronAPI.downloads.pause(item.id),
                            )
                          }
                        >
                          <Pause className="size-4" />
                          Pause
                        </Button>
                      )}
                      {item.isActive &&
                        (item.state === "paused" ||
                          item.state === "interrupted") &&
                        item.canResume && (
                          <Button
                            className="h-9"
                            variant="outline"
                            disabled={disabled}
                            onClick={() =>
                              void run(item.id, () =>
                                window.electronAPI.downloads.resume(item.id),
                              )
                            }
                          >
                            <Play className="size-4" />
                            Resume
                          </Button>
                        )}
                      {item.isActive && (
                        <Button
                          className="h-9"
                          variant="outline"
                          disabled={disabled}
                          onClick={() =>
                            void run(item.id, () =>
                              window.electronAPI.downloads.cancel(item.id),
                            )
                          }
                        >
                          <X className="size-4" />
                          Cancel
                        </Button>
                      )}
                      {!item.isActive &&
                        (item.state === "interrupted" ||
                          item.state === "cancelled") &&
                        /^https?:\/\//i.test(item.url) && (
                          <Button
                            className="h-9"
                            variant="outline"
                            disabled={disabled}
                            onClick={() =>
                              void run(item.id, () =>
                                window.electronAPI.downloads.retry(item.id),
                              )
                            }
                          >
                            <RotateCcw className="size-4" />
                            Retry
                          </Button>
                        )}
                      {item.state === "completed" && (
                        <>
                          <Button
                            className="h-9"
                            variant="outline"
                            disabled={disabled}
                            onClick={() =>
                              void run(item.id, () =>
                                window.electronAPI.downloads.open(item.id),
                              )
                            }
                          >
                            <File className="size-4" />
                            Open file
                          </Button>
                          <Button
                            className="h-9"
                            variant="outline"
                            disabled={disabled}
                            onClick={() =>
                              void run(item.id, () =>
                                window.electronAPI.downloads.reveal(item.id),
                              )
                            }
                          >
                            <FolderOpen className="size-4" />
                            Show in folder
                          </Button>
                        </>
                      )}
                      {!item.isActive && (
                        <Button
                          className="h-9"
                          variant="ghost"
                          disabled={disabled}
                          onClick={() =>
                            void run(item.id, () =>
                              window.electronAPI.downloads.remove(item.id),
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                          Remove from history
                        </Button>
                      )}
                      <span className="self-center text-xs text-muted-foreground">
                        {new Date(item.startedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
