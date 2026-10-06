import { Bookmark } from "lucide-react";
import type { NavMainItem } from "@/components/dashboard/interface";
export interface BrowserBookmark {
  id: string;
  title: string;
  url: string;
}
export type BrowserSidebarSide = "left" | "right";
export function bookmarkNavigation(
  bookmarks: BrowserBookmark[],
): NavMainItem[] {
  return bookmarks.map((bookmark) => ({
    title: bookmark.title,
    url: bookmark.url,
    icon: Bookmark,
  }));
}
