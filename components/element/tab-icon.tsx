import {
  Bookmark,
  CircleAlert,
  Clock3,
  Download,
  FlaskConical,
  Globe2,
  House,
  LoaderCircle,
  Puzzle,
  Settings,
  CircleHelp,
  Rocket,
  Sparkles,
} from "lucide-react";
import type { BrowserInternalPage } from "@/lib/browser/internal-pages";

const internalIcons = {
  help: CircleHelp,
  welcome: Rocket,
  "whats-new": Sparkles,
  error: CircleAlert,
  "new-tab": House,
  settings: Settings,
  downloads: Download,
  bookmarks: Bookmark,
  history: Clock3,
  flags: FlaskConical,
  extensions: Puzzle,
};

function TabIcon({
  internalPage,
  faviconUrl,
  isLoading,
}: {
  internalPage: BrowserInternalPage | null;
  faviconUrl: string;
  isLoading: boolean;
}) {
  if (internalPage) {
    const Icon = internalPage.startsWith("settings/")
      ? Settings
      : internalIcons[internalPage as keyof typeof internalIcons];
    return <Icon className="size-4 shrink-0" />;
  }
  if (isLoading)
    return <LoaderCircle className="size-4 shrink-0 animate-spin" />;
  if (faviconUrl)
    return (
      <img alt="" className="size-4 shrink-0 rounded-sm" src={faviconUrl} />
    );
  return <Globe2 className="size-4 shrink-0" />;
}

export { TabIcon };
