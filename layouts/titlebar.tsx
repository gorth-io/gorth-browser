import { useRef, type MouseEvent } from "react";
import { useFullScreen } from "@/hooks/use-full-screen";
import { ChevronDown, Plus, Zap } from "lucide-react";

import {
  BrowserTabs,
  type BrowserTabItem,
} from "@/components/element/browser-tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getPortalMenuAnchor,
  getPortalMenuTheme,
  type TitlebarContextMenuCommand,
} from "@/lib/browser/browser-menu";

interface TitlebarProps {
  activeTabId: string;
  showLogo: boolean;
  tabs: BrowserTabItem[];
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCreateTab: () => void;
  onReloadTab: (tabId: string) => void;
  onToggleMuteTab: (tabId: string) => void;
  onTogglePinTab: (tabId: string) => void;
}

function Titlebar({
  activeTabId,
  showLogo,
  tabs,
  onActivateTab,
  onCloseTab,
  onCloseOtherTabs,
  onCreateTab,
  onReloadTab,
  onToggleMuteTab,
  onTogglePinTab,
}: TitlebarProps) {
  const isFullScreen = useFullScreen();
  const tabMenuButtonRef = useRef<HTMLButtonElement>(null);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  const openTabListMenu = async () => {
    if (!tabMenuButtonRef.current) return;

    const selectedTabId = await window.electronAPI.tabs.openListMenu(
      activeTabId,
      tabs.map(
        ({ faviconUrl, id, isLoading, isMuted, title, internalPage }) => ({
          internalPage,
          faviconUrl,
          id,
          isLoading,
          isMuted,
          title,
        }),
      ),
      getPortalMenuAnchor(tabMenuButtonRef.current),
      getPortalMenuTheme(),
    );

    if (selectedTabId) onActivateTab(selectedTabId);
  };

  const openTitlebarContextMenu = async (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!activeTab) return;

    const command = await window.electronAPI.titlebarMenu.open(
      {
        canClose: tabs.length > 1,
        canReload: activeTab.internalPage === null,
        isMuted: activeTab.isMuted,
      },
      {
        height: 0,
        width: 0,
        x: event.clientX,
        y: event.clientY,
      },
      getPortalMenuTheme(),
    );

    if (!command) return;

    const actions: Record<TitlebarContextMenuCommand, () => void> = {
      "new-tab": onCreateTab,
      "reload-tab": () => onReloadTab(activeTab.id),
      "toggle-mute-tab": () => onToggleMuteTab(activeTab.id),
      "close-tab": () => onCloseTab(activeTab.id),
    };

    actions[command]();
  };

  return (
    <header
      className="app-drag relative z-50 flex h-14 shrink-0 items-center border-b bg-sidebar backdrop-blur-xl"
      onContextMenu={(event) => void openTitlebarContextMenu(event)}
    >
      <div
        aria-hidden="true"
        className={cn(
          "h-full shrink-0 transition-[width] duration-200",
          window.electronAPI.windowState.isMacOS && !isFullScreen
            ? "w-24 border-r"
            : "w-0",
        )}
      />

      <div className="app-drag flex h-full min-w-0 flex-1 items-center p-2.5">
        {showLogo && (
          <div className="mr-2 flex shrink-0 items-center">
            <Zap className="size-5 fill-violet-500 text-violet-500" />
          </div>
        )}

        <BrowserTabs
          activeTabId={activeTabId}
          tabs={tabs}
          onActivate={onActivateTab}
          onClose={onCloseTab}
          onCloseOtherTabs={onCloseOtherTabs}
          onReload={onReloadTab}
          onToggleMute={onToggleMuteTab}
          onTogglePin={onTogglePinTab}
        />

        <Button
          aria-label="Open new tab"
          className="app-no-drag ml-2"
          onClick={onCreateTab}
          size="icon"
          title="New tab"
          variant="ghost"
        >
          <Plus className="size-4" />
        </Button>

        <Button
          aria-label="Show all tabs"
          className="app-no-drag ml-2"
          onClick={() => void openTabListMenu()}
          ref={tabMenuButtonRef}
          size="icon"
          title="All tabs"
          variant="ghost"
        >
          <ChevronDown className="size-4" />
        </Button>
      </div>
    </header>
  );
}

export { Titlebar };
