import { Clock3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  type BrowserHistoryItem,
  PageShell,
  EmptyState,
  LinkActionsPopover,
} from "@/pages/shared";
function HistoryPage({
  history,
  onClear,
  onNavigate,
  onOpenInNewTab,
  onRemove,
}: {
  history: BrowserHistoryItem[];
  onClear: () => void;
  onNavigate: (url: string) => void;
  onOpenInNewTab: (url: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <PageShell
      description="Websites opened during this session."
      icon={Clock3}
      title="History"
    >
      {history.length ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>{history.length} items</CardDescription>
            </div>
            <Button onClick={onClear} size="sm" variant="outline">
              <Trash2 /> Clear all
            </Button>
          </CardHeader>
          <Separator />
          <CardContent className="divide-y p-0">
            {history.map((item) => (
              <LinkActionsPopover
                className="flex items-center gap-2 px-4 py-3"
                key={item.id}
                onClear={onClear}
                onNavigate={() => onNavigate(item.url)}
                onOpenInNewTab={() => onOpenInNewTab(item.url)}
                onRemove={() => onRemove(item.id)}
                removeLabel="Delete from history"
                url={item.url}
              >
                <Button
                  className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-none px-0 py-0 text-left hover:bg-transparent"
                  onClick={() => onNavigate(item.url)}
                  variant="ghost"
                >
                  <Clock3 className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.url}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.visitedAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </Button>
              </LinkActionsPopover>
            ))}
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={Clock3} title="No history yet">
          Websites you visit will appear here.
        </EmptyState>
      )}
    </PageShell>
  );
}
export { HistoryPage };
