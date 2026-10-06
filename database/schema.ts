import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { DownloadState } from "@/lib/browser/downloads";

const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

const settings = sqliteTable(
  "settings",
  {
    profileId: text("profile_id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.key] })],
);

const tabs = sqliteTable("tabs", {
  windowId: text("window_id").notNull().default("main"),
  lifecycle: text("lifecycle").notNull().default("{}"),
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  faviconUrl: text("favicon_url").notNull(),
  isMuted: integer("is_muted", { mode: "boolean" }).notNull(),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull(),
  internalPage: text("internal_page"),
  isActive: integer("is_active", { mode: "boolean" }).notNull(),
});

const tabGroups = sqliteTable("tab_groups", {
  windowId: text("window_id").notNull().default("main"),
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Tab group"),
  profileId: text("profile_id").notNull(),
  mode: text("mode").notNull(),
  position: integer("position").notNull(),
});

const tabGroupMembers = sqliteTable(
  "tab_group_members",
  {
    groupId: text("group_id").notNull(),
    tabId: text("tab_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.tabId] })],
);

const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  position: integer("position").notNull(),
});

const history = sqliteTable(
  "history",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    tabId: text("tab_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    visitedAt: integer("visited_at").notNull(),
  },
  (table) => [index("history_visited_at_idx").on(sql`${table.visitedAt} DESC`)],
);

const recentlyClosed = sqliteTable(
  "recently_closed",
  {
    windowId: text("window_id").notNull().default("main"),
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    tabJson: text("tab_json").notNull(),
    closedAt: integer("closed_at").notNull(),
  },
  (table) => [index("recently_closed_at_idx").on(sql`${table.closedAt} DESC`)],
);

const windows = sqliteTable("windows", {
  isOpen: integer("is_open", { mode: "boolean" }).notNull().default(true),
  id: text("id").primaryKey(),
  x: integer("x"),
  y: integer("y"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  isMaximized: integer("is_maximized", { mode: "boolean" }).notNull(),
});

export const archivedTabs = sqliteTable("archived_tabs", {
  id: text("id").primaryKey(),
  windowId: text("window_id").notNull(),
  tabJson: text("tab_json").notNull(),
  archivedAt: integer("archived_at").notNull(),
});

const downloads = sqliteTable(
  "downloads",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    filename: text("filename").notNull(),
    url: text("url").notNull(),
    savePath: text("save_path").notNull(),
    mimeType: text("mime_type").notNull(),
    receivedBytes: integer("received_bytes").notNull(),
    totalBytes: integer("total_bytes").notNull(),
    state: text("state").$type<DownloadState>().notNull(),
    startedAt: integer("started_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("downloads_started_at_idx").on(table.startedAt)],
);

export {
  downloads,
  bookmarks,
  history,
  profiles,
  recentlyClosed,
  settings,
  tabGroupMembers,
  tabGroups,
  tabs,
  windows,
};

/** Public SSO identity cache, separate from browser profiles/game accounts. */
export const userProfiles = sqliteTable("user_profiles", {
  ssoUserId: text("sso_user_id").primaryKey().notNull(),
  name: text("name").notNull(),
  username: text("username"),
  email: text("email"),
  image: text("image"),
  emailVerified: integer("email_verified", { mode: "boolean" }),
  createdAt: integer("created_at").notNull(),
  syncedAt: integer("synced_at").notNull(),
});
