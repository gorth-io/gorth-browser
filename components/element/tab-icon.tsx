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
  Keyboard,
  Archive,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { BrowserInternalPage } from "@/lib/browser/internal-pages";

const internalIcons = {
  auth: UserRound,
  archive: Archive,
  shortcuts: Keyboard,
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
} satisfies Record<
  Exclude<BrowserInternalPage, `settings/${string}`>,
  LucideIcon
>;

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
      : (internalIcons[internalPage as keyof typeof internalIcons] ?? Globe2);
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
