import { BrowserWindow, ipcMain, screen } from "electron";
import { getWindowFromSender } from "@/main/windows/capital";

export function resizeFocusedWindow(width: number, height: number) {
  const target =
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (!target || target.isDestroyed()) return;

  const resize = () => {
    if (target.isDestroyed()) return;
    const { workArea } = screen.getDisplayMatching(target.getBounds());
    target.setBounds({
      x: workArea.x + Math.max(0, Math.floor((workArea.width - width) / 2)),
      y: workArea.y + Math.max(0, Math.floor((workArea.height - height) / 2)),
      width,
      height,
    });
    target.show();
    target.focus();
  };
  const leaveMaximized = () => {
    if (!target.isMaximized()) return resize();
    target.once("unmaximize", resize);
    target.unmaximize();
  };

  if (target.isMinimized()) target.restore();
  if (target.isFullScreen()) {
    target.once("leave-full-screen", leaveMaximized);
    target.setFullScreen(false);
  } else {
    leaveMaximized();
  }
}

export function registerWindowIpc() {
  ipcMain.handle("window:is-full-screen", (event) => {
    return getWindowFromSender(event.sender)?.isFullScreen() ?? false;
  });
}
