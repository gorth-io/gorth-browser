import { useEffect, useState } from "react";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell, EmptyState } from "@/pages/shared";
import type { ArchiveEntry } from "@/lib/browser/lifecycle";
import type { PersistedTab } from "@/lib/browser/persistence";
export function ArchivePage({
  onRestore,
}: {
  onRestore: (tab: PersistedTab) => void;
}) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [error, setError] = useState("");
  const refresh = () =>
    window.electronAPI.lifecycle
      .list()
      .then(setEntries)
      .catch(() => setError("Unable to load archived tabs."));
  useEffect(() => {
    void refresh();
    return window.electronAPI.lifecycle.onArchived(() => void refresh());
  }, []);
  const run = async (entry: ArchiveEntry, restore: boolean) => {
    try {
      if (restore) {
        const tab = await window.electronAPI.lifecycle.restore(entry.id);
        if (tab) onRestore(tab);
      } else await window.electronAPI.lifecycle.delete(entry.id);
      await refresh();
    } catch {
      setError("Unable to update this archived tab.");
    }
  };
  return (
    <PageShell
      icon={Archive}
      title="Archived tabs"
      description="Restore inactive tabs saved in your browser database."
    >
      {error && (
        <p role="alert" className="mb-4 text-destructive">
          {error}
        </p>
      )}
      {!entries.length ? (
        <EmptyState icon={Archive} title="No archived tabs">
          Archive an inactive tab from its menu, or enable automatic archiving
          in System settings.
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="divide-y">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{entry.tab.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {entry.tab.url}
                  </p>
                </div>
                <Button
                  className="h-9"
                  variant="outline"
                  onClick={() => void run(entry, true)}
                >
                  <RotateCcw className="size-4" />
                  Restore
                </Button>
                <Button
                  className="size-9"
                  variant="ghost"
                  size="icon"
                  aria-label="Delete archived tab"
                  onClick={() => void run(entry, false)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
