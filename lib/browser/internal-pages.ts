import { settingsPageDefinitions } from "./settings-definitions";
import { urlSchema } from "@/lib/utils/schema";

interface InternalPageDefinition {
  title: string;
  url: string;
}

const internalPageDefinitions = {
  auth: { title: "Gorth Account", url: "gorth://auth" },
  archive: { title: "Archived tabs", url: "gorth://archive" },
  shortcuts: { title: "Keyboard shortcuts", url: "gorth://shortcuts" },
  help: { title: "Help", url: "gorth://help" },
  welcome: { title: "Welcome to Gorth", url: "gorth://welcome" },
  "whats-new": { title: "What's new", url: "gorth://whats-new" },
  error: { title: "Page unavailable", url: "gorth://error" },
  settings: { title: "Settings", url: "gorth://settings" },
  downloads: { title: "Downloads", url: "gorth://downloads" },
  bookmarks: { title: "Bookmarks", url: "gorth://bookmarks" },
  history: { title: "History", url: "gorth://history" },
  flags: { title: "Experiments", url: "gorth://flags" },
  extensions: { title: "Extensions", url: "gorth://extensions" },
  ...settingsPageDefinitions,
} as const satisfies Record<string, InternalPageDefinition>;

type BrowserInternalPage = "new-tab" | keyof typeof internalPageDefinitions;

function parseInternalPage(value: string): BrowserInternalPage | null {
  try {
    const url = new URL(urlSchema.parse(value));
    if (url.protocol !== "gorth:") return null;

    const hostname = url.hostname.toLowerCase();
    if (hostname === "about") return "settings/help";
    if (hostname === "settings" && url.pathname.replace(/\/$/, "")) {
      const page = `settings${url.pathname.replace(/\/$/, "").toLowerCase()}`;
      return page in settingsPageDefinitions
        ? (page as keyof typeof settingsPageDefinitions)
        : null;
    }
    if (hostname === "new-tab" || hostname === "newtab") return "new-tab";
    if (hostname in internalPageDefinitions) {
      return hostname as keyof typeof internalPageDefinitions;
    }
  } catch {
    return null;
  }

  return null;
}

function getInternalPageUrl(page: BrowserInternalPage) {
  return page === "new-tab" ? "" : internalPageDefinitions[page].url;
}

function getInternalPageTitle(page: BrowserInternalPage) {
  return page === "new-tab" ? "Home" : internalPageDefinitions[page].title;
}

export {
  getInternalPageTitle,
  getInternalPageUrl,
  internalPageDefinitions,
  parseInternalPage,
};
export type { BrowserInternalPage, InternalPageDefinition };
