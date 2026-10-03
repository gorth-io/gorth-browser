import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TabIcon } from "@/components/element/tab-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/providers/tooltip";
import { cn } from "@/lib/utils";
import type { BrowserInternalPage } from "@/lib/browser/internal-pages";
import {
  getPortalMenuTheme,
  type PortalMenuAnchor,
  type TabContextMenuCommand,
} from "@/lib/browser/browser-menu";

interface BrowserTabItem {
  errorCode?: number;
  errorDescription?: string;
  errorUrl?: string;
  isPinned: boolean;
  id: string;
  title: string;
  url: string;
  faviconUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  isMuted: boolean;
  isHome: boolean;
  internalPage: BrowserInternalPage | null;
}

interface BrowserTabsProps {
  vertical?: boolean;
  collapsed?: boolean;
  activeTabId: string;
  tabs: BrowserTabItem[];
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onReload: (tabId: string) => void;
  onToggleMute: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
}

function BrowserTabs({
  vertical = false,
  collapsed = false,
  activeTabId,
  tabs,
  onActivate,
  onClose,
  onCloseOtherTabs,
  onReload,
  onToggleMute,
  onTogglePin,
}: BrowserTabsProps) {
  const tabListRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    isOverflowing: false,
  });

  const updateScrollState = useCallback(() => {
    const tabList = tabListRef.current;
    if (!tabList) return;

    setScrollState((currentState) => {
      const controlsWidth = currentState.isOverflowing ? 88 : 0;
      const isOverflowing =
        tabList.scrollWidth - tabList.clientWidth - controlsWidth > 1;
      const maximumScrollLeft = tabList.scrollWidth - tabList.clientWidth;

      return {
        canScrollLeft: isOverflowing && tabList.scrollLeft > 1,
        canScrollRight:
          isOverflowing && tabList.scrollLeft < maximumScrollLeft - 1,
        isOverflowing,
      };
    });
  }, []);

  useEffect(() => {
    const tabList = tabListRef.current;
    if (!tabList) return;

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(tabList);
    tabList.addEventListener("scroll", updateScrollState, { passive: true });
    const frame = requestAnimationFrame(updateScrollState);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      tabList.removeEventListener("scroll", updateScrollState);
    };
  }, [tabs, updateScrollState]);

  useEffect(() => {
    const activeTab = tabListRef.current?.querySelector<HTMLElement>(
      `[data-tab-id="${CSS.escape(activeTabId)}"]`,
    );
    activeTab?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeTabId, vertical, collapsed]);

  const scrollTabs = (direction: -1 | 1) => {
    const tabList = tabListRef.current;
    if (!tabList) return;

    tabList.scrollBy({
      behavior: "smooth",
      left: direction * Math.max(160, tabList.clientWidth * 0.7),
    });
  };

  const openTabContextMenu = async (
    tab: BrowserTabItem,
    anchor: PortalMenuAnchor,
  ) => {
    const command = (await window.electronAPI.tabs.openContextMenu(
      tab.title,
      tab.isMuted,
      tab.isPinned,
      tab.internalPage === null,
      tabs.length > 1,
      anchor,
      getPortalMenuTheme(),
    )) as TabContextMenuCommand | null;

    if (!command) return;

    const actions: Record<TabContextMenuCommand, () => void> = {
      "reload-tab": () => onReload(tab.id),
      "toggle-mute-tab": () => onToggleMute(tab.id),
      "toggle-pin-tab": () => onTogglePin(tab.id),
      "close-tab": () => onClose(tab.id),
      "close-other-tabs": () => onCloseOtherTabs(tab.id),
    };

    actions[command]();
  };

  return (
    <div
      className={cn(
        "app-drag flex min-h-0 min-w-0 flex-1 items-center gap-2",
        vertical && "w-full flex-col",
      )}
    >
      <div
        aria-label="Open tabs"
        className={cn(
          "app-drag flex min-h-0 min-w-0 flex-1 items-center gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          vertical
            ? "w-full flex-col items-start overflow-x-hidden overflow-y-auto"
            : "overflow-x-auto",
        )}
        ref={tabListRef}
        role="tablist"
        aria-orientation={vertical ? "vertical" : "horizontal"}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const iconOnly = collapsed || tab.isPinned;

          return (
            <div
              className={cn(
                "app-no-drag group relative flex h-9 items-center gap-1 rounded-lg border p-1 transition-colors",
                iconOnly
                  ? "size-9 shrink-0 border-0"
                  : vertical
                    ? "w-[180px] shrink-0"
                    : "min-w-24 basis-[180px] max-w-[180px] flex-1",
                isActive
                  ? "border-border/70 bg-background/90 text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground",
              )}
              data-tab-id={tab.id}
              key={tab.id}
              onMouseDown={(event) => {
                if (event.button === 1) event.preventDefault();
              }}
              onAuxClick={(event) => {
                if (event.button !== 1) return;
                event.preventDefault();
                event.stopPropagation();
                onClose(tab.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void openTabContextMenu(tab, {
                  height: 0,
                  width: 0,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-selected={isActive}
                      aria-label={tab.title}
                      className={cn(
                        "absolute inset-0 h-full w-full justify-start gap-1 overflow-hidden px-2 text-xs font-normal",
                        iconOnly
                          ? "justify-center p-0"
                          : isActive
                            ? "pr-16"
                            : "group-hover:pr-16",
                      )}
                      onClick={() => onActivate(tab.id)}
                      role="tab"
                      size={iconOnly ? "icon" : "sm"}
                      variant="ghost"
                    />
                  }
                >
                  <TabIcon {...tab} />
                  {!iconOnly && (
                    <span className="min-w-0 truncate">{tab.title}</span>
                  )}
                </TooltipTrigger>
                <TooltipContent
                  className="w-[180px]"
                  side={vertical ? "right" : "bottom"}
                >
                  <span className="line-clamp-2 min-w-0 break-words">{tab.title}</span>
                </TooltipContent>
              </Tooltip>

              {!iconOnly && (
                <>
                  <Button
                    aria-label={
                      tab.isMuted ? `Unmute ${tab.title}` : `Mute ${tab.title}`
                    }
                    className={cn(
                      "relative z-10 ml-auto size-6",
                      !isActive && "invisible group-hover:visible",
                    )}
                    onClick={() => onToggleMute(tab.id)}
                    size="icon-xs"
                    title={tab.isMuted ? "Unmute tab" : "Mute tab"}
                    variant="ghost"
                  >
                    {tab.isMuted ? <VolumeX /> : <Volume2 />}
                  </Button>

                  <Button
                    aria-label={`Close ${tab.title}`}
                    className={cn(
                      "relative z-10 size-6",
                      !isActive && "invisible group-hover:visible",
                    )}
                    disabled={tabs.length === 1}
                    onClick={() => onClose(tab.id)}
                    size="icon-xs"
                    title="Close tab"
                    variant="ghost"
                  >
                    <X />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {!vertical && scrollState.isOverflowing && (
        <div className="app-no-drag flex shrink-0 items-center gap-2">
          <Button
            aria-label="Scroll tabs left"
            disabled={!scrollState.canScrollLeft}
            onClick={() => scrollTabs(-1)}
            size="icon"
            title="Previous tabs"
            variant="ghost"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label="Scroll tabs right"
            disabled={!scrollState.canScrollRight}
            onClick={() => scrollTabs(1)}
            size="icon"
            title="Next tabs"
            variant="ghost"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export { BrowserTabs };
export type { BrowserTabItem };
