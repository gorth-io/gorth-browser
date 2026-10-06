import { Bookmark } from "lucide-react";
import type { BrowserBookmark } from "@/components/dashboard/bookmarks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell, EmptyState, LinkActionsPopover } from "@/pages/shared";
import {
  TabGroups,
  type TabGroupsProps,
} from "@/components/element/tab-groups";
function BookmarksPage({
  bookmarks,
  onNavigate,
  onOpenInNewTab,
  onRemove,
  ...groupProps
}: {
  bookmarks: BrowserBookmark[];
  onNavigate: (url: string) => void;
  onOpenInNewTab: (url: string) => void;
  onRemove: (id: string) => void;
} & TabGroupsProps) {
  return (
    <PageShell
      description="Pages you saved for quick access."
      icon={Bookmark}
      title="Bookmarks"
    >
      <TabGroups {...groupProps} />
      {bookmarks.length ? (
        <Card>
          <CardContent className="divide-y p-0">
            {bookmarks.map((item) => (
              <LinkActionsPopover
                className="flex items-center gap-3 px-4 py-3"
                key={item.id}
                onNavigate={() => onNavigate(item.url)}
                onOpenInNewTab={() => onOpenInNewTab(item.url)}
                onRemove={() => onRemove(item.id)}
                removeLabel="Remove bookmark"
                url={item.url}
              >
                <Bookmark className="size-4 fill-current" />
                <Button
                  className="h-auto min-w-0 flex-1 justify-start px-0 text-left"
                  onClick={() => onNavigate(item.url)}
                  variant="ghost"
                >
                  <span className="block truncate text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.url}
                  </span>
                </Button>
              </LinkActionsPopover>
            ))}
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={Bookmark} title="No bookmarks yet">
          Select the star beside the address bar to save a website.
        </EmptyState>
      )}
    </PageShell>
  );
}
export { BookmarksPage };
