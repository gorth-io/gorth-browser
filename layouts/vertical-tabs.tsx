import { useRef, type ComponentProps } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { BrowserTabs } from "@/components/element/browser-tabs";
import { Button } from "@/components/ui/button";
import {
  getPortalMenuAnchor,
  getPortalMenuTheme,
} from "@/lib/browser/browser-menu";
import { cn } from "@/lib/utils";

interface VerticalTabsProps extends ComponentProps<typeof BrowserTabs> {
  onCreateTab: () => void;
}

function VerticalTabs({ onCreateTab, ...props }: VerticalTabsProps) {
  const listButtonRef = useRef<HTMLButtonElement>(null);
  const openTabList = async () => {
    if (!listButtonRef.current) return;
    const id = await window.electronAPI.tabs.openListMenu(
      props.activeTabId,
      props.tabs,
      getPortalMenuAnchor(listButtonRef.current),
      getPortalMenuTheme(),
    );
    if (id) props.onActivate(id);
  };
  return (
    <aside
      aria-label="Vertical tabs"
      className={cn(
        "app-drag flex shrink-0 flex-col items-center gap-2 bg-muted/50 p-2.5",
        props.collapsed ? "w-14" : "w-[200px]",
      )}
    >
      <BrowserTabs {...props} vertical />
      <div
        className={cn(
          "app-no-drag flex w-full shrink-0 items-center gap-2",
          props.collapsed && "flex-col",
        )}
      >
        <Button
          aria-label="Open new tab"
          title="New tab"
          size="icon"
          variant="ghost"
          onClick={onCreateTab}
        >
          <Plus />
        </Button>
        <Button
          aria-label="Show all tabs"
          title="All tabs"
          size="icon"
          variant="ghost"
          ref={listButtonRef}
          onClick={() => void openTabList()}
        >
          <ChevronDown />
        </Button>
      </div>
    </aside>
  );
}

export { VerticalTabs };
