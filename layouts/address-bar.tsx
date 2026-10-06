import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ComponentProps,
  type MouseEvent,
} from "react";
import {
  ArrowLeft,
  Archive,
  ArrowRight,
  Bookmark,
  BookOpen,
  Clock3,
  Columns2,
  Download,
  FlaskConical,
  Home,
  Menu,
  Keyboard,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  RotateCw,
  Search,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";

import type { BrowserTabItem } from "@/components/element/browser-tabs";
import { RecentDownloads } from "@/components/element/recent-downloads";
import { PortalPanel } from "@/providers/portal";
import { AddressBarForm } from "@/components/form/address-bar-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/providers/tooltip";
import { cn } from "@/lib/utils";
import { useFullScreen } from "@/hooks/use-full-screen";
import {
  getPortalMenuAnchor,
  getPortalMenuTheme,
  type BrowserMenuCommand,
} from "@/lib/browser/browser-menu";
import type { BrowserInternalPage } from "@/lib/browser/internal-pages";

const systemPageButtons = [
  { page: "archive", label: "Archive", icon: Archive },
  { page: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { page: "bookmarks", label: "Bookmarks", icon: BookOpen },
  { page: "history", label: "History", icon: Clock3 },
  { page: "downloads", label: "Downloads", icon: Download },
  { page: "extensions", label: "Extensions", icon: Puzzle },
  { page: "flags", label: "Experiments", icon: FlaskConical },
  { page: "settings", label: "Settings", icon: Settings },
] as const satisfies ReadonlyArray<{
  page: Exclude<BrowserInternalPage, "new-tab" | "error">;
  label: string;
  icon: typeof Settings;
}>;

interface AddressBarProps {
  verticalTabs: boolean;
  verticalCollapsed: boolean;
  onToggleVerticalSidebar: () => void;
  activeTab: BrowserTabItem;
  isBookmarked: boolean;
  isSidebarOpen: boolean;
  isSplit: boolean;
  canSplit: boolean;
  onBack: () => void;
  onBookmark: () => void;
  onCreateTab: () => void;
  onForward: () => void;
  onHome: () => void;
  onNavigate: (value: string) => void;
  onReload: () => void;
  onStop: () => void;
  onOpenInternal: (page: Exclude<BrowserInternalPage, "new-tab">) => void;
  onToggleSidebar: () => void;
  onToggleSplit: () => void;
}

function AddressBarButton({
  title,
  tooltipAlign = "start",
  ...props
}: ComponentProps<typeof Button> & {
  title: string;
  tooltipAlign?: "start" | "end";
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button {...props} />} />
      <TooltipContent
        side="bottom"
        align={tooltipAlign}
        className={cn(
          "w-[90px] min-w-[90px] max-w-[90px] whitespace-normal break-words",
          tooltipAlign === "end"
            ? "justify-end text-right"
            : "justify-start text-left",
        )}
      >
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

function AddressBar({
  verticalTabs,
  verticalCollapsed,
  onToggleVerticalSidebar,
  activeTab,
  isBookmarked,
  isSidebarOpen,
  isSplit,
  canSplit,
  onBack,
  onBookmark,
  onCreateTab,
  onForward,
  onHome,
  onNavigate,
  onReload,
  onStop,
  onOpenInternal,
  onToggleSidebar,
  onToggleSplit,
}: AddressBarProps) {
  const [value, setValue] = useState(activeTab.url);
  const [isFocused, setIsFocused] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0);
  const selectOnMouseUp = useRef(false);
  const isFullScreen = useFullScreen();
  const inputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const siteButtonRef = useRef<HTMLButtonElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const [downloadsOpen, setDownloadsOpen] = useState(false);

  const openSiteInfo = async () => {
    if (!siteButtonRef.current) return;
    const command = await window.electronAPI.siteInfo.open(
      activeTab.id,
      getPortalMenuAnchor(siteButtonRef.current),
      getPortalMenuTheme(),
    );
    if (command === "settings") onOpenInternal("settings");
  };

  const displayValue = isFocused
    ? value
    : activeTab.url
      .replace(/^https?:\/\/(?:www\.)?/i, "")
      .replace(/^([^/?#]+)\/$/, "$1");
  // Keep the real input for editing/selection; paint the same text above it.
  const urlParts = displayValue.match(
    /^(https?:\/\/|gorth:\/\/)?([^/?#\s]+)(.*)$/i,
  );
  const isAddress = /^(https?:\/\/|gorth:\/\/)/i.test(
    isFocused ? value : activeTab.url,
  );

  useLayoutEffect(() => {
    if (isFocused) {
      inputRef.current?.select();
      if (inputRef.current) inputRef.current.scrollLeft = 0;
      setScrollLeft(0);
    }
  }, [isFocused]);

  useEffect(() => setValue(activeTab.url), [activeTab.id, activeTab.url]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value.trim()) onNavigate(value);
  };

  const handleMenuCommand = (command: BrowserMenuCommand) => {
    const actions: Record<BrowserMenuCommand, () => void> = {
      "new-tab": onCreateTab,
      home: onHome,
      bookmark: onBookmark,
      bookmarks: () => onOpenInternal("bookmarks"),
      history: () => onOpenInternal("history"),
      downloads: () => onOpenInternal("downloads"),
      "toggle-sidebar": onToggleSidebar,
      "toggle-split": onToggleSplit,
      settings: () => onOpenInternal("settings"),
    };

    actions[command]();
  };

  const openBrowserMenu = async () => {
    if (!menuButtonRef.current) return;

    const command = await window.electronAPI.browserMenu.open(
      {
        canBookmark: activeTab.internalPage === null,
        canShowSidebar: true,
        canSplit,
        isSidebarOpen,
        isSplit,
      },
      getPortalMenuAnchor(menuButtonRef.current),
      getPortalMenuTheme(),
    );

    if (command) handleMenuCommand(command);
  };

  const openAddressBarContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const input = inputRef.current;
    const hasSelection = Boolean(
      input && input.selectionStart !== input.selectionEnd,
    );

    void window.electronAPI.addressBarMenu.open(
      {
        canCopy: hasSelection,
        canCut: hasSelection,
        canSelectAll: value.length > 0,
      },
      {
        height: 0,
        width: 0,
        x: event.clientX,
        y: event.clientY,
      },
      getPortalMenuTheme(),
    );
  };

  return (
    <nav
      className="app-drag relative z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 p-2.5 backdrop-blur-xl [&_button]:[-webkit-app-region:no-drag]"
      onContextMenu={openAddressBarContextMenu}
    >
      {verticalTabs &&
        window.electronAPI.windowState.isMacOS &&
        !isFullScreen && (
          <div aria-hidden="true" className="h-9 w-[70px] shrink-0" />
        )}
      {verticalTabs && (
        <AddressBarButton
          aria-label={
            verticalCollapsed
              ? "Expand vertical tabs"
              : "Collapse vertical tabs"
          }
          aria-expanded={!verticalCollapsed}
          title={
            verticalCollapsed
              ? "Expand vertical tabs"
              : "Collapse vertical tabs"
          }
          onClick={onToggleVerticalSidebar}
          size="icon"
          variant="ghost"
        >
          {verticalCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </AddressBarButton>
      )}
      <AddressBarButton
        aria-label="Back"
        disabled={!activeTab.canGoBack}
        onClick={onBack}
        size="icon"
        title="Back"
        variant="ghost"
      >
        <ArrowLeft />
      </AddressBarButton>
      <AddressBarButton
        aria-label="Forward"
        disabled={!activeTab.canGoForward}
        onClick={onForward}
        size="icon"
        title="Forward"
        variant="ghost"
      >
        <ArrowRight />
      </AddressBarButton>
      <AddressBarButton
        aria-label={activeTab.isLoading ? "Loading" : "Reload"}
        disabled={activeTab.internalPage !== null}
        onClick={activeTab.isLoading ? onStop : onReload}
        size="icon"
        title={activeTab.isLoading ? "Loading" : "Reload"}
        variant="ghost"
      >
        {activeTab.isLoading ? <X /> : <RotateCw />}
      </AddressBarButton>
      <AddressBarButton
        aria-label="Home"
        onClick={onHome}
        size="icon"
        title="Home"
        variant="ghost"
      >
        <Home />
      </AddressBarButton>
      <AddressBarButton
        aria-label="Split view"
        disabled={!canSplit}
        onClick={onToggleSplit}
        size="icon"
        title="Split view"
        variant={isSplit ? "secondary" : "ghost"}
      >
        <Columns2 />
      </AddressBarButton>
      <AddressBarButton
        aria-label="Bookmark this page"
        disabled={activeTab.internalPage !== null}
        onClick={onBookmark}
        size="icon"
        title="Bookmark"
        variant="ghost"
      >
        <Bookmark className={isBookmarked ? "fill-current" : undefined} />
      </AddressBarButton>

      <AddressBarButton
        aria-label="Site information"
        disabled={
          activeTab.internalPage !== null ||
          !/^https?:\/\//i.test(activeTab.url)
        }
        onClick={() => void openSiteInfo()}
        ref={siteButtonRef}
        size="icon"
        title="Information"
        variant="ghost"
      >
        <SlidersHorizontal />
      </AddressBarButton>

      <AddressBarForm onSubmit={handleSubmit}>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Address bar"
          className="h-9 select-text rounded-md bg-muted/60 pr-4 pl-9 text-transparent caret-foreground shadow-none transition-none selection:bg-primary/25 selection:text-transparent focus-visible:bg-background"
          onChange={(event) => setValue(event.target.value)}
          onPointerDown={(event) => {
            selectOnMouseUp.current =
              event.button === 0 &&
              document.activeElement !== event.currentTarget;
          }}
          onMouseUp={(event) => {
            if (!selectOnMouseUp.current) return;
            event.preventDefault();
            event.currentTarget.select();
            selectOnMouseUp.current = false;
          }}
          onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            selectOnMouseUp.current = false;
            setScrollLeft(0);
            setIsFocused(false);
            setValue(activeTab.url);
          }}
          placeholder="Search or enter address"
          ref={inputRef}
          value={displayValue}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-[17px] left-[37px] flex items-center overflow-hidden text-base md:text-sm"
        >
          <span
            className="whitespace-pre"
            style={{
              transform: `translateX(-${isFocused ? scrollLeft : 0}px)`,
            }}
          >
            {isAddress && urlParts ? (
              <>
                <span className="text-muted-foreground">{urlParts[1]}</span>
                <span className="text-foreground">{urlParts[2]}</span>
                <span className="text-muted-foreground">{urlParts[3]}</span>
              </>
            ) : (
              <span className="text-foreground">{displayValue}</span>
            )}
          </span>
        </div>
      </AddressBarForm>

      <div className="app-no-drag flex shrink-0 items-center gap-2">
        {systemPageButtons.map(({ page, label, icon: Icon }) => (
          <AddressBarButton
            aria-label={label}
            key={page}
            onClick={() =>
              page === "downloads"
                ? setDownloadsOpen(!downloadsOpen)
                : onOpenInternal(page)
            }
            ref={page === "downloads" ? downloadButtonRef : undefined}
            aria-expanded={page === "downloads" ? downloadsOpen : undefined}
            aria-haspopup={page === "downloads" ? "menu" : undefined}
            size="icon"
            title={label}
            tooltipAlign="end"
            variant={
              activeTab.internalPage === page ||
                (page === "settings" &&
                  activeTab.internalPage?.startsWith("settings/"))
                ? "secondary"
                : "ghost"
            }
          >
            <Icon />
          </AddressBarButton>
        ))}
      </div>

      {downloadsOpen && downloadButtonRef.current && (
        <PortalPanel
          anchor={getPortalMenuAnchor(downloadButtonRef.current)}
          align="end"
          onClose={() => setDownloadsOpen(false)}
        >
          <RecentDownloads
            onClose={() => setDownloadsOpen(false)}
            onShowAll={() => onOpenInternal("downloads")}
          />
        </PortalPanel>
      )}

      <AddressBarButton
        aria-label="Toggle sidebar"
        onClick={onToggleSidebar}
        size="icon"
        title="Sidebar"
        tooltipAlign="end"
        variant={isSidebarOpen ? "secondary" : "ghost"}
      >
        <PanelLeft />
      </AddressBarButton>

      <AddressBarButton
        aria-label="Open browser menu"
        onClick={() => void openBrowserMenu()}
        ref={menuButtonRef}
        size="icon"
        title="Menu"
        tooltipAlign="end"
        variant="ghost"
      >
        <Menu />
      </AddressBarButton>
    </nav>
  );
}

export { AddressBar };
