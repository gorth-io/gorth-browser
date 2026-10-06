import { z } from "zod";
import {
  parseInternalPage,
  type BrowserInternalPage,
} from "@/lib/browser/internal-pages";
const id = z.string().min(1).max(128);
const url = z.string().max(32768);
const internalPage = z
  .custom<BrowserInternalPage>(
    (value) =>
      typeof value === "string" &&
      parseInternalPage(`gorth://${value}`) === value,
  )
  .nullable();
export const persistedTabSchema = z.object({
  id,
  title: z.string().max(8192),
  url,
  faviconUrl: url,
  isMuted: z.boolean(),
  isPinned: z.boolean(),
  internalPage,
  isSleeping: z.boolean().optional(),
  lastActiveAt: z.number().finite().nonnegative().optional(),
  navigation: z
    .object({
      entries: z
        .array(z.object({ url, title: z.string().max(8192) }))
        .min(1)
        .max(1000),
      activeIndex: z.number().int().min(0),
    })
    .refine((value) => value.activeIndex < value.entries.length)
    .optional(),
});
export const browserSnapshotSchema = z
  .object({
    activeTabId: id.nullable(),
    splitTabId: id.nullable(),
    tabs: z.array(persistedTabSchema).max(500),
    groups: z
      .array(
        z.object({
          id,
          name: z.string().max(80),
          mode: z.enum(["normal", "split", "glance"]),
          tabIds: z.array(id).max(500),
        }),
      )
      .max(500),
    bookmarks: z
      .array(z.object({ id, title: z.string().max(8192), url }))
      .max(10000),
    history: z
      .array(
        z.object({
          id,
          tabId: id,
          title: z.string().max(8192),
          url,
          visitedAt: z.number().finite(),
        }),
      )
      .max(10000),
    preferences: z.object({
      flags: z.record(z.string(), z.boolean()),
      sidebarSide: z.enum(["left", "right"]),
      showTitlebarLogo: z.boolean(),
      theme: z.enum(["dark", "light", "system"]),
      verticalCollapsed: z.boolean(),
      verticalTabs: z.boolean(),
      sleepAfterMinutes: z.number().int().min(1).max(1440),
      archiveAfterDays: z.number().int().min(0).max(365),
    }),
  })
  .refine(
    (snapshot) =>
      new Set(snapshot.tabs.map((tab) => tab.id)).size === snapshot.tabs.length,
    "Duplicate tab ids.",
  );
