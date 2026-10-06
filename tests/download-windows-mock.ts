import { BrowserWindow } from "electron";
export function getBrowserWindows() {
  return BrowserWindow.getAllWindows();
}
