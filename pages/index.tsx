import type { SpecialPageProps } from "./shared";
import { createContext, useContext, useState } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { createInternalRouter } from "@/lib/browser/router";
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
const pageRenderers = {
  auth: (props: SpecialPageProps) => (
    <AuthScreen onReturn={() => props.onNavigate("gorth://settings/profile")} />
  ),
  archive: (props: SpecialPageProps) => (
    <ArchivePage onRestore={props.onRestoreArchivedTab} />
  ),
  shortcuts: () => (
    <Wrapper>
      <ShortcutsPage />
    </Wrapper>
  ),
  help: (props: SpecialPageProps) => (
    <HelpPage onOpenInternal={props.onOpenInternal} />
  ),
  welcome: (props: SpecialPageProps) => (
    <WelcomePage onOpenInternal={props.onOpenInternal} />
  ),
  "whats-new": (props: SpecialPageProps) => (
    <WhatsNewPage onOpenInternal={props.onOpenInternal} />
  ),
  bookmarks: (props: SpecialPageProps) => (
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
  ),
  history: (props: SpecialPageProps) => (
    <HistoryPage
      history={props.history}
      onNavigate={props.onNavigate}
      onOpenInNewTab={props.onOpenInNewTab}
      onRemove={props.onRemoveHistoryItem}
      onClear={props.onClearHistory}
    />
  ),
  downloads: (props: SpecialPageProps) => (
    <DownloadsPage onOpenInternal={props.onOpenInternal} />
  ),
  extensions: () => <ExtensionsPage />,
  flags: (props: SpecialPageProps) => <FlagsPage {...props} />,
  error: (props: SpecialPageProps) => <ErrorPage {...props} />,
};
const pageContext = createContext<SpecialPageProps | null>(null);

function InternalPage() {
  const props = useContext(pageContext);
  if (!props) throw new Error("Missing internal page context");
  if (props.page === "settings" || props.page.startsWith("settings/"))
    return <SettingsPage {...props} />;
  const render = pageRenderers[props.page as keyof typeof pageRenderers];
  return render(props);
}

function InternalRouter({ page }: { page: SpecialPageProps["page"] }) {
  const [router] = useState(() => createInternalRouter(page, InternalPage));
  return <RouterProvider router={router} />;
}

export function SpecialPage(props: SpecialPageProps) {
  // Electron remains the owner of tab history and external URLs.
  // Each internal page uses memory history, never file:// or dev-server navigation.
  return (
    <pageContext.Provider value={props}>
      <InternalRouter key={props.page} page={props.page} />
    </pageContext.Provider>
  );
}
