import type { SpecialPageProps } from "./shared";
import { ShortcutsPage } from "./shortcuts";
import { Wrapper } from "@/layouts/wrapper";
import { SettingsPage } from "./settings";
import { BookmarksPage } from "./bookmarks";
import { HistoryPage } from "./history";
import { DownloadsPage } from "./downloads";
import { ExtensionsPage } from "./extensions";
import { FlagsPage } from "./flags";
import { ErrorPage } from "./error";
import { HelpPage } from "./help";
import { WelcomePage } from "./welcome";
import { WhatsNewPage } from "./whats-new";
import { ArchivePage } from "./archive";
import { AuthScreen } from "@/components/element/auth-screen";
export type { BrowserHistoryItem } from "./shared";
export function SpecialPage(props: SpecialPageProps) {
  if (props.page === "settings" || props.page.startsWith("settings/"))
    return <SettingsPage {...props} />;
  switch (props.page) {
    case "auth":
      return (
        <AuthScreen
          onReturn={() => props.onNavigate("gorth://settings/profile")}
        />
      );
    case "archive":
      return <ArchivePage onRestore={props.onRestoreArchivedTab} />;
    case "shortcuts":
      return (
        <Wrapper>
          <ShortcutsPage />
        </Wrapper>
      );
    case "help":
      return <HelpPage onOpenInternal={props.onOpenInternal} />;
    case "welcome":
      return <WelcomePage onOpenInternal={props.onOpenInternal} />;
    case "whats-new":
      return <WhatsNewPage onOpenInternal={props.onOpenInternal} />;
    case "bookmarks":
      return (
        <BookmarksPage
          groups={props.groups}
          tabs={props.tabs}
          onSaveGroup={props.onSaveGroup}
          onDeleteGroup={props.onDeleteGroup}
          onOpenGroup={props.onOpenGroup}
          bookmarks={props.bookmarks}
          onNavigate={props.onNavigate}
          onOpenInNewTab={props.onOpenInNewTab}
          onRemove={props.onRemoveBookmark}
        />
      );
    case "history":
      return (
        <HistoryPage
          history={props.history}
          onNavigate={props.onNavigate}
          onOpenInNewTab={props.onOpenInNewTab}
          onRemove={props.onRemoveHistoryItem}
          onClear={props.onClearHistory}
        />
      );
    case "downloads":
      return <DownloadsPage onOpenInternal={props.onOpenInternal} />;
    case "extensions":
      return <ExtensionsPage />;
    case "flags":
      return <FlagsPage {...props} />;
    case "error":
      return <ErrorPage {...props} />;
  }
}
