import { createContext, useContext, useEffect, useState } from "react";
import { PortalPanel, type PortalAnchor } from "@/providers/portal";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ClipboardPaste,
  Columns2,
  Copy,
  Cookie,
  ChevronRight,
  Shield,
  Download,
  ExternalLink,
  History,
  Home,
  Image as ImageIcon,
  Inspect,
  Link2,
  Pin,
  PinOff,
  PanelLeft,
  Plus,
  Redo2,
  RotateCw,
  Scissors,
  Settings,
  TerminalSquare,
  TextCursorInput,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import {
  PopoverMenuItem,
  PopoverMenuLabel,
  PopoverMenuSeparator,
} from "@/components/element/popover-menu";
import { Button } from "@/components/ui/button";
import { TabIcon } from "@/components/element/tab-icon";
import type {
  AddressBarContextMenuCommand,
  AddressBarContextPortalState,
  BrowserMenuCommand,
  BrowserMenuPortalState,
  PageContextMenuCommand,
  PageContextPortalState,
  PortalMenuState,
  TabContextMenuCommand,
  TabContextPortalState,
  TabListPortalState,
  TitlebarContextMenuCommand,
  TitlebarContextPortalState,
} from "@/lib/browser/browser-menu";

const SelectionContext = createContext<(value: string | null) => void>(
  () => {},
);
function useSelectItem() {
  return useContext(SelectionContext);
}

function BrowserMenuItems({ state }: { state: BrowserMenuPortalState }) {
  const selectPortalItem = useSelectItem();
  const { menu } = state;
  const select = (command: BrowserMenuCommand) => selectPortalItem(command);

  return (
    <>
      <PopoverMenuLabel>Browser</PopoverMenuLabel>
      <PopoverMenuSeparator />
      <PopoverMenuItem onClick={() => select("new-tab")}>
        <Plus /> New tab
      </PopoverMenuItem>
      <PopoverMenuItem onClick={() => select("home")}>
        <Home /> Home
      </PopoverMenuItem>
      <PopoverMenuItem
        disabled={!menu.canBookmark}
        onClick={() => select("bookmark")}
      >
        <Bookmark /> Bookmark this page
      </PopoverMenuItem>
      <PopoverMenuSeparator />
      <PopoverMenuItem onClick={() => select("bookmarks")}>
        <BookOpen /> Bookmarks
      </PopoverMenuItem>
      <PopoverMenuItem onClick={() => select("history")}>
        <History /> History
      </PopoverMenuItem>
      <PopoverMenuItem onClick={() => select("downloads")}>
        <Download /> Downloads
      </PopoverMenuItem>
      <PopoverMenuSeparator />
      <PopoverMenuItem
        disabled={!menu.canShowSidebar}
        onClick={() => select("toggle-sidebar")}
      >
        <PanelLeft /> {menu.isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
      </PopoverMenuItem>
      <PopoverMenuItem
        disabled={!menu.canSplit}
        onClick={() => select("toggle-split")}
      >
        <Columns2 /> {menu.isSplit ? "Exit split view" : "Open split view"}
      </PopoverMenuItem>
      <PopoverMenuItem onClick={() => select("settings")}>
        <Settings /> Settings
      </PopoverMenuItem>
    </>
  );
}

function AddressBarContextItems({
  state,
}: {
  state: AddressBarContextPortalState;
}) {
  const selectPortalItem = useSelectItem();
  const select = (command: AddressBarContextMenuCommand) =>
    selectPortalItem(command);

  return (
    <>
      <PopoverMenuLabel>Address bar</PopoverMenuLabel>
      <PopoverMenuSeparator />
      <PopoverMenuItem onClick={() => select("undo")}>
        <Undo2 /> Undo
      </PopoverMenuItem>
      <PopoverMenuItem onClick={() => select("redo")}>
        <Redo2 /> Redo
      </PopoverMenuItem>
      <PopoverMenuSeparator />
      <PopoverMenuItem disabled={!state.canCut} onClick={() => select("cut")}>
        <Scissors /> Cut
      </PopoverMenuItem>
      <PopoverMenuItem disabled={!state.canCopy} onClick={() => select("copy")}>
        <Copy /> Copy
      </PopoverMenuItem>
      <PopoverMenuItem onClick={() => select("paste")}>
        <ClipboardPaste /> Paste
      </PopoverMenuItem>
      <PopoverMenuSeparator />
      <PopoverMenuItem
        disabled={!state.canSelectAll}
        onClick={() => select("select-all")}
      >
        <TextCursorInput /> Select all
      </PopoverMenuItem>
    </>
  );
}

function TabListItems({ state }: { state: TabListPortalState }) {
  const selectPortalItem = useSelectItem();
  return (
    <>
      <PopoverMenuLabel>All tabs ({state.tabs.length})</PopoverMenuLabel>
      <PopoverMenuSeparator />
      <div>
        {state.tabs.map((tab) => (
          <PopoverMenuItem
            className="h-9"
            key={tab.id}
            onClick={() => selectPortalItem(tab.id)}
          >
            <TabIcon {...tab} />
            <span className="min-w-0 flex-1 truncate">{tab.title}</span>
            {tab.id === state.activeTabId && <Check className="size-4" />}
          </PopoverMenuItem>
        ))}
      </div>
    </>
  );
}

function TabContextItems({ state }: { state: TabContextPortalState }) {
  const selectPortalItem = useSelectItem();
  const select = (command: TabContextMenuCommand) => selectPortalItem(command);

  return (
    <>
      <PopoverMenuLabel>
        <span className="block truncate">{state.title}</span>
      </PopoverMenuLabel>
      <PopoverMenuSeparator />
      <PopoverMenuItem
        disabled={!state.canReload}
        onClick={() => select("reload-tab")}
      >
        <RotateCw /> Reload tab
      </PopoverMenuItem>
      <PopoverMenuItem onClick={() => select("toggle-mute-tab")}>
        {state.isMuted ? <Volume2 /> : <VolumeX />}
        {state.isMuted ? "Unmute tab" : "Mute tab"}
      </PopoverMenuItem>
      <PopoverMenuItem onClick={() => select("toggle-pin-tab")}>
        {state.isPinned ? <PinOff /> : <Pin />}
        {state.isPinned ? "Unpin tab" : "Pin tab"}
      </PopoverMenuItem>
      <PopoverMenuSeparator />
      <PopoverMenuItem onClick={() => select("close-tab")}>
        <X /> Close tab
      </PopoverMenuItem>
      <PopoverMenuItem
        disabled={!state.canCloseOtherTabs}
        onClick={() => select("close-other-tabs")}
      >
        <X /> Close other tabs
      </PopoverMenuItem>
    </>
  );
}

function PageContextItems({ state }: { state: PageContextPortalState }) {
  const selectPortalItem = useSelectItem();
  const select = (command: PageContextMenuCommand) => selectPortalItem(command);
  const hasSpecialContent = Boolean(state.linkUrl || state.imageUrl);
  const canOpenImage = /^https?:\/\//i.test(state.imageUrl);

  return (
    <>
      <PopoverMenuLabel>Web page</PopoverMenuLabel>
      <PopoverMenuSeparator />
      {state.linkUrl && (
        <>
          <PopoverMenuItem onClick={() => select("open-link-new-tab")}>
            <ExternalLink /> Open link in new tab
          </PopoverMenuItem>
          <PopoverMenuItem onClick={() => select("copy-link-address")}>
            <Link2 /> Copy link address
          </PopoverMenuItem>
          <PopoverMenuSeparator />
        </>
      )}
      {state.imageUrl && (
        <>
          <PopoverMenuItem
            disabled={!canOpenImage}
            onClick={() => select("open-image-new-tab")}
          >
            <ExternalLink /> Open image in new tab
          </PopoverMenuItem>
          <PopoverMenuItem onClick={() => select("copy-image")}>
            <ImageIcon /> Copy image
          </PopoverMenuItem>
          <PopoverMenuItem onClick={() => select("copy-image-address")}>
            <Link2 /> Copy image address
          </PopoverMenuItem>
          <PopoverMenuSeparator />
        </>
      )}
      {!hasSpecialContent && (
        <>
          <PopoverMenuItem
            disabled={!state.canGoBack}
            onClick={() => select("back")}
          >
            <ArrowLeft /> Back
          </PopoverMenuItem>
          <PopoverMenuItem
            disabled={!state.canGoForward}
            onClick={() => select("forward")}
          >
            <ArrowRight /> Forward
          </PopoverMenuItem>
          <PopoverMenuItem
            disabled={!state.canReload}
            onClick={() => select("reload")}
          >
            <RotateCw /> Reload
          </PopoverMenuItem>
          <PopoverMenuSeparator />
        </>
      )}
      {state.selectionText && !state.isEditable && (
        <>
          <PopoverMenuItem onClick={() => select("copy-selection")}>
            <Copy /> Copy selection
          </PopoverMenuItem>
          <PopoverMenuSeparator />
        </>
      )}
      {state.isEditable && (
        <>
          <PopoverMenuItem
            disabled={!state.canUndo}
            onClick={() => select("undo")}
          >
            <Undo2 /> Undo
          </PopoverMenuItem>
          <PopoverMenuItem
            disabled={!state.canRedo}
            onClick={() => select("redo")}
          >
            <Redo2 /> Redo
          </PopoverMenuItem>
          <PopoverMenuSeparator />
          <PopoverMenuItem
            disabled={!state.canCut}
            onClick={() => select("cut")}
          >
            <Scissors /> Cut
          </PopoverMenuItem>
          <PopoverMenuItem
            disabled={!state.canCopy}
            onClick={() => select("copy")}
          >
            <Copy /> Copy
          </PopoverMenuItem>
          <PopoverMenuItem
            disabled={!state.canPaste}
            onClick={() => select("paste")}
          >
            <ClipboardPaste /> Paste
          </PopoverMenuItem>
          <PopoverMenuItem
            disabled={!state.canSelectAll}
            onClick={() => select("select-all")}
          >
            <TextCursorInput /> Select all
          </PopoverMenuItem>
          <PopoverMenuSeparator />
        </>
      )}
      <PopoverMenuItem onClick={() => select("open-devtools")}>
        <TerminalSquare /> Developer tools
      </PopoverMenuItem>
      <PopoverMenuItem onClick={() => select("inspect-element")}>
        <Inspect /> Inspect element
      </PopoverMenuItem>
    </>
  );
}

function TitlebarContextItems({
  state,
}: {
  state: TitlebarContextPortalState;
}) {
  const selectPortalItem = useSelectItem();
  const select = (command: TitlebarContextMenuCommand) =>
    selectPortalItem(command);

  return (
    <>
      <PopoverMenuLabel>Title bar</PopoverMenuLabel>
      <PopoverMenuSeparator />
      <PopoverMenuItem onClick={() => select("new-tab")}>
        <Plus /> New tab
      </PopoverMenuItem>
      <PopoverMenuItem
        disabled={!state.canReload}
        onClick={() => select("reload-tab")}
      >
        <RotateCw /> Reload tab
      </PopoverMenuItem>
      <PopoverMenuItem onClick={() => select("toggle-mute-tab")}>
        {state.isMuted ? <Volume2 /> : <VolumeX />}
        {state.isMuted ? "Unmute tab" : "Mute tab"}
      </PopoverMenuItem>
      <PopoverMenuSeparator />
      <PopoverMenuItem
        disabled={!state.canClose}
        onClick={() => select("close-tab")}
      >
        <X /> Close tab
      </PopoverMenuItem>
    </>
  );
}

function SiteInfoItems({
  state,
}: {
  state: Extract<PortalMenuState, { kind: "site-info" }>;
}) {
  const selectPortalItem = useSelectItem();
  const [section, setSection] = useState<"connection" | "cookies" | null>(null);
  return (
    <>
      <div className="flex items-center gap-1 px-2 py-1">
        <span
          className="min-w-0 flex-1 truncate text-xs font-semibold"
          title={state.hostname}
        >
          {state.hostname}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-9 shrink-0"
          aria-label="Close site information"
          onClick={() => selectPortalItem(null)}
        >
          <X className="size-4" />
        </Button>
      </div>
      <PopoverMenuItem
        aria-expanded={section === "connection"}
        onClick={() =>
          setSection(section === "connection" ? null : "connection")
        }
      >
        <Shield /> {state.https ? "HTTPS connection" : "Not secure"}
        <ChevronRight className="ml-auto" />
      </PopoverMenuItem>
      {section === "connection" && (
        <p className="px-2 py-2 text-xs text-muted-foreground">
          {state.https
            ? "This page uses HTTPS. This does not guarantee that the website is trustworthy."
            : "This page uses HTTP. Information sent to this website is not encrypted."}
        </p>
      )}
      <PopoverMenuItem
        aria-expanded={section === "cookies"}
        onClick={() => setSection(section === "cookies" ? null : "cookies")}
      >
        <Cookie /> Cookies and data
        <ChevronRight className="ml-auto" />
      </PopoverMenuItem>
      {section === "cookies" && (
        <p className="px-2 py-2 text-xs text-muted-foreground">
          {state.cookieCount === null
            ? "Cookie information is unavailable."
            : `${state.cookieCount} cookies apply to this URL.`}{" "}
          Other site storage is not included.
        </p>
      )}
      <PopoverMenuItem onClick={() => selectPortalItem("settings")}>
        <Settings /> Browser settings
        <ExternalLink className="ml-auto" />
      </PopoverMenuItem>
    </>
  );
}

function PortalMenuItems({ state }: { state: PortalMenuState }) {
  switch (state.kind) {
    case "site-info":
      return <SiteInfoItems state={state} />;
    case "address-bar-context":
      return <AddressBarContextItems state={state} />;
    case "browser-menu":
      return <BrowserMenuItems state={state} />;
    case "tab-list":
      return <TabListItems state={state} />;
    case "tab-context":
      return <TabContextItems state={state} />;
    case "page-context":
      return <PageContextItems state={state} />;
    case "titlebar-context":
      return <TitlebarContextItems state={state} />;
  }
}

type Request = { id: number; state: PortalMenuState; anchor: PortalAnchor };
export function MenuPortal() {
  const [request, setRequest] = useState<Request | null>(null);
  useEffect(() => window.electronAPI.menuPortal.onRequest(setRequest), []);
  if (!request) return null;
  const select = (value: string | null) => {
    setRequest(null);
    window.electronAPI.menuPortal.result(request.id, value);
  };
  return (
    <SelectionContext.Provider value={select}>
      <PortalPanel
        key={request.id}
        anchor={request.anchor}
        align={
          request.state.kind.includes("context") ||
          request.state.kind === "site-info"
            ? "start"
            : "end"
        }
        onClose={() => select(null)}
      >
        <PortalMenuItems state={request.state} />
      </PortalPanel>
    </SelectionContext.Provider>
  );
}
