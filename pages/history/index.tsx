import { Clock3, Trash2 } from "lucide-react";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, dataTableFeatures } from "@/components/custom/data-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/utils/formatter";
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
  const columns = useMemo<
    ColumnDef<typeof dataTableFeatures, BrowserHistoryItem>[]
  >(
    () => [
      {
        accessorKey: "title",
        header: "Website",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <LinkActionsPopover
              className="min-w-0"
              onClear={onClear}
              onNavigate={() => onNavigate(item.url)}
              onOpenInNewTab={() => onOpenInNewTab(item.url)}
              onRemove={() => onRemove(item.id)}
              removeLabel="Delete from history"
              url={item.url}
            >
              <Button
                className="h-9 max-w-96 justify-start px-0"
                variant="ghost"
                onClick={() => onNavigate(item.url)}
              >
                <Clock3 className="size-4 shrink-0" />
                <span className="truncate">{item.title}</span>
              </Button>
              <p className="max-w-96 truncate text-xs text-muted-foreground">
                {item.url}
              </p>
            </LinkActionsPopover>
          );
        },
      },
      {
        accessorKey: "visitedAt",
        header: "Visited",
        cell: ({ row }) => formatDateTime(row.original.visitedAt),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            size="icon"
            variant="ghost"
            className="size-9"
            aria-label="Delete from history"
            onClick={() => onRemove(row.original.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        ),
      },
    ],
    [onClear, onNavigate, onOpenInNewTab, onRemove],
  );
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
          <CardContent>
            <DataTable
              data={history}
              columns={columns}
              getSearchText={getHistorySearchText}
              searchLabel="Search history"
              emptyLabel="No matching websites."
            />
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
function getHistorySearchText(item: BrowserHistoryItem) {
  return item.title + " " + item.url;
}
