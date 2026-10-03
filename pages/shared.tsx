import { useState, type ReactNode } from "react";
import {
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import type {
  BrowserBookmark,
  BrowserSidebarSide,
} from "@/components/element/browser-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PopoverMenuItem,
  PopoverMenuSeparator,
} from "@/components/element/popover-menu";
import { PortalPanel, type PortalAnchor } from "@/providers/portal";
import { type BrowserInternalPage } from "@/lib/browser/internal-pages";
import type { Theme } from "@/lib/theme";
import { Wrapper } from "@/layouts/wrapper";
interface BrowserHistoryItem {
  id: string;
  tabId: string;
  title: string;
  url: string;
  visitedAt: number;
}

interface SpecialPageProps {
  errorCode?: number;
  errorDescription?: string;
  errorUrl?: string;
  flags: Record<string, boolean>;
  onFlagsChange: (flags: Record<string, boolean>) => void;
  onRetry: () => void;
  onThemeChange: (theme: Theme) => void;
  verticalTabs: boolean;
  onVerticalTabsChange: (enabled: boolean) => void;
  bookmarks: BrowserBookmark[];
  history: BrowserHistoryItem[];
  page: Exclude<BrowserInternalPage, "new-tab">;
  onClearHistory: () => void;
  onNavigate: (url: string) => void;
  onOpenInNewTab: (url: string) => void;
  onOpenInternal: (page: Exclude<BrowserInternalPage, "new-tab">) => void;
  onRemoveBookmark: (id: string) => void;
  onRemoveHistoryItem: (id: string) => void;
  onSidebarSideChange: (side: BrowserSidebarSide) => void;
  onShowTitlebarLogoChange: (show: boolean) => void;
  sidebarSide: BrowserSidebarSide;
  showTitlebarLogo: boolean;
  theme: Theme;
}

interface PageShellProps {
  children: ReactNode;
  description: string;
  icon: typeof Settings;
  title: string;
}

function PageShell({
  children,
  description,
  icon: Icon,
  title,
}: PageShellProps) {
  return (
    <Wrapper>
      <header className="mb-8 flex items-center gap-4">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Icon className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </Wrapper>
  );
}

function EmptyState({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  icon: typeof Download;
  title: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {children}
        </p>
      </CardContent>
    </Card>
  );
}

function LinkActionsPopover({
  children,
  className,
  onClear,
  onNavigate,
  onOpenInNewTab,
  onRemove,
  removeLabel,
  url,
}: {
  children: ReactNode;
  className: string;
  onClear?: () => void;
  onNavigate: () => void;
  onOpenInNewTab: () => void;
  onRemove: () => void;
  removeLabel: string;
  url: string;
}) {
  const [anchor, setAnchor] = useState<PortalAnchor | null>(null);
  const runAction = (action: () => void) => {
    setAnchor(null);
    action();
  };

  return (
    <>
      <div
        className={className}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setAnchor({
            x: event.clientX,
            y: event.clientY,
            width: 0,
            height: 0,
          });
        }}
      >
        {children}
        <Button
          aria-label="Open actions"
          aria-expanded={anchor !== null}
          aria-haspopup="menu"
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setAnchor(anchor ? null : bounds);
          }}
          size="icon-sm"
          title="More actions"
          variant="ghost"
        >
          <MoreHorizontal />
        </Button>
      </div>
      {anchor && (
        <PortalPanel
          anchor={anchor}
          align={anchor.width ? "end" : "start"}
          onClose={() => setAnchor(null)}
        >
          <PopoverMenuItem onClick={() => runAction(onNavigate)}>
            <ExternalLink /> Open
          </PopoverMenuItem>
          <PopoverMenuItem onClick={() => runAction(onOpenInNewTab)}>
            <Plus /> Open in new tab
          </PopoverMenuItem>
          <PopoverMenuSeparator />
          <PopoverMenuItem
            onClick={() =>
              runAction(() => {
                void window.electronAPI.clipboard.writeText(url);
              })
            }
          >
            <Copy /> Copy link address
          </PopoverMenuItem>
          <PopoverMenuSeparator />
          <PopoverMenuItem destructive onClick={() => runAction(onRemove)}>
            <Trash2 /> {removeLabel}
          </PopoverMenuItem>
          {onClear && (
            <PopoverMenuItem destructive onClick={() => runAction(onClear)}>
              <Trash2 /> Clear all history
            </PopoverMenuItem>
          )}
        </PortalPanel>
      )}
    </>
  );
}
export { PageShell, EmptyState, LinkActionsPopover };
export type { BrowserHistoryItem, SpecialPageProps };
