import { screen } from "electron";
import { loadWindowState } from "@/database/client";

export function getRestoredWindowOptions() {
  const saved = loadWindowState();
  if (!saved) return { width: 1920, height: 1080, shouldMaximize: false };
  const bounds = {
    x: saved.x ?? 0,
    y: saved.y ?? 0,
    width: Math.max(1280, saved.width),
    height: Math.max(720, saved.height),
  };
  const display = screen.getDisplayMatching(bounds);
  const visible =
    saved.x !== null &&
    saved.y !== null &&
    bounds.x < display.workArea.x + display.workArea.width - 80 &&
    bounds.y < display.workArea.y + display.workArea.height - 80 &&
    bounds.x + bounds.width > display.workArea.x + 80 &&
    bounds.y + bounds.height > display.workArea.y + 80;
  return {
    width: bounds.width,
    height: bounds.height,
    ...(visible ? { x: bounds.x, y: bounds.y } : {}),
    shouldMaximize: saved.isMaximized,
  };
}
