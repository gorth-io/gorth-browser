import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AuthScreen } from "@/components/element/auth-screen";
import { Titlebar } from "@/layouts/titlebar";
import { TooltipProvider } from "@/providers/tooltip";
import { TabIcon } from "@/components/element/tab-icon";
import {
  internalPageDefinitions,
  type BrowserInternalPage,
} from "@/lib/browser/internal-pages";
import type { AuthViewState } from "@/lib/auth/view-types";

declare global {
  interface Window {
    authUiErrors: string[];
    authUiTest: {
      cancelled: number;
      returned: number;
      open: () => void;
      finish: (completed: boolean) => void;
      showAllIcons: () => number;
    };
  }
}
let state: AuthViewState = {
  visible: true,
  mode: "login",
  loading: false,
  verifying: false,
  error: "",
  url: "http://localhost:3000/auth/sign-in",
};
const listeners = new Set<(state: AuthViewState) => void>();
Object.assign(window, {
  electronAPI: {
    windowState: {
      isMacOS: true,
      getIsFullScreen: async () => false,
      onFullScreenChanged: () => () => {},
    },
    auth: {
      onViewChanged: (listener: (value: AuthViewState) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      viewState: async () => state,
      setViewBounds: async () => {},
      setViewVisible: async () => {},
      reloadView: async () => {},
    },
  },
});
window.authUiErrors = [];
const root = createRoot(document.getElementById("root")!, {
  onUncaughtError: (error) => {
    window.authUiErrors.push(String(error));
  },
});
function BrowserAuthFixture() {
  const [view, setView] = useState(state);
  const [profile, setProfile] = useState(false);
  useEffect(() => {
    listeners.add(setView);
    return () => {
      listeners.delete(setView);
    };
  }, []);
  const page = profile ? "settings/profile" : view.visible ? null : "auth";
  const noop = () => {};
  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col">
        <Titlebar
          groups={[]}
          activeTabId="sso"
          showLogo
          tabs={[
            {
              id: "sso",
              title: "Gorth Account",
              url: profile ? "gorth://settings/profile" : "gorth://auth",
              internalPage: page,
              faviconUrl: "",
              isLoading: false,
              isMuted: false,
              isPinned: false,
              isHome: false,
              canGoBack: true,
              canGoForward: false,
            },
          ]}
          onActivateTab={noop}
          onCloseTab={noop}
          onCloseOtherTabs={noop}
          onCreateTab={noop}
          onReloadTab={noop}
          onToggleMuteTab={noop}
          onTogglePinTab={noop}
        />
        <main className="min-h-0 flex-1">
          {profile ? (
            <div data-route="gorth://settings/profile">Profile</div>
          ) : (
            <AuthScreen
              onReturn={() => {
                window.authUiTest.returned++;
                setProfile(true);
              }}
            />
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
let generation = 0;
function open() {
  state = { ...state, visible: true, completed: false };
  root.render(<BrowserAuthFixture key={++generation} />);
}
window.authUiTest = {
  cancelled: 0,
  returned: 0,
  open,
  finish: (completed) => {
    state = { ...state, visible: false, completed };
    for (const listener of listeners) listener(state);
  },
  showAllIcons: () => {
    const pages: BrowserInternalPage[] = [
      "new-tab",
      ...(Object.keys(
        internalPageDefinitions,
      ) as (keyof typeof internalPageDefinitions)[]),
    ];
    root.render(
      <div data-all-icons>
        {pages.map((page) => (
          <span key={page} data-icon-page={page}>
            <TabIcon internalPage={page} faviconUrl="" isLoading={false} />
          </span>
        ))}
      </div>,
    );
    return pages.length;
  },
};
open();
