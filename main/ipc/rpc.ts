import { ipcMain } from "electron";
import { getWindowFromSender, getBrowserState } from "@/main/windows/capital";
import {
  loadBrowserSnapshot,
  loadTabGroups,
  saveTabGroup,
  deleteTabGroup,
} from "@/services/browser-database";
import { restoreTabSession } from "@/main/services/tab-lifecycle";
import { desktopRouter } from "@/main/rpc/router";
import { handleRpcRequest } from "@/main/rpc/transport";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";
export function registerRpcIpc() {
  ipcMain.handle("desktop:rpc", (event, input: unknown) => {
    const window = getWindowFromSender(event.sender);
    if (
      !window ||
      event.senderFrame !== event.sender.mainFrame ||
      !isRpcRendererUrl(event.sender.getURL(), getRpcRendererUrl())
    )
      throw new Error("Untrusted desktop RPC sender.");
    const sessionId = getBrowserState(window).sessionId;
    return handleRpcRequest(desktopRouter, input, {
      load: () => restoreTabSession(window, loadBrowserSnapshot(sessionId)),
      listGroups: () => loadTabGroups(sessionId),
      saveGroup: (group) => saveTabGroup(group, sessionId),
      deleteGroup: (id) => deleteTabGroup(id, sessionId),
    } satisfies import("@/main/rpc/router").DesktopContext);
  });
}
