import { BookOpen, Settings } from "lucide-react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  bookmarkNavigation,
  type BrowserBookmark,
  type BrowserSidebarSide,
} from "@/components/dashboard/bookmarks";
import {
  settingsPagesFirst,
  settingsPagesSecond,
  settingsPages,
} from "@/lib/browser/settings-pages";
import type { BrowserInternalPage } from "@/lib/browser/internal-pages";

interface SettingsDashboardProps {
  variant: "settings";
  page: BrowserInternalPage;
  onOpenInternal: (page: Exclude<BrowserInternalPage, "new-tab">) => void;
}
interface BookmarksDashboardProps {
  variant: "bookmarks";
  bookmarks: BrowserBookmark[];
  side: BrowserSidebarSide;
  onClose: () => void;
  onNavigate: (url: string) => void;
}
export function Dashboard(
  props: SettingsDashboardProps | BookmarksDashboardProps,
) {
  if (props.variant === "settings") {
    return (
      <AppSidebar
        collapsible="none"
        pathname={props.page}
        onNavigate={(url) => {
          const page = settingsPages.find((item) => item.id === url);
          if (page) props.onOpenInternal(page.id);
        }}
        data={{
          brand: {
            name: "Settings",
            icon: Settings,
            url: "settings/get-started",
          },
          navMain: settingsPagesFirst.map((item) => ({
            title: item.title,
            url: item.id,
            icon: item.icon,
          })),
          navSecondary: settingsPagesSecond.map((item) => ({
            title: item.title,
            url: item.id,
            icon: item.icon,
          })),
        }}
      />
    );
  }
  return (
    <SidebarProvider
      open
      onOpenChange={() => {}}
      className={`relative z-40 min-h-0 w-64 shrink-0 ${props.side === "right" ? "border-l" : "border-r"}`}
    >
      <AppSidebar
        collapsible="none"
        className="min-h-0"
        pathname=""
        onNavigate={props.onNavigate}
        onClose={props.onClose}
        empty={
          <p className="px-4 py-6 text-center text-xs leading-5 text-muted-foreground">
            No bookmarks yet. Select the bookmark button beside the address bar
            to add one.
          </p>
        }
        data={{
          brand: {
            name: "Bookmarks",
            icon: BookOpen,
            url: "gorth://bookmarks",
          },
          navMain: bookmarkNavigation(props.bookmarks),
        }}
      />
    </SidebarProvider>
  );
}
