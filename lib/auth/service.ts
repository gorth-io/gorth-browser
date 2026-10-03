import { BrowserWindow, ipcMain, shell } from "electron";
import { readVault, writeVault, vaultExists } from "./vault";
import { gorthIssuer } from "@/lib/utils/environment";
import { gorthBinding, loginGorth, refreshGorth, revokeGorth } from "./gorth";
import { AuthHttpError } from "./http";
import type { AuthResult, AuthSession, AuthSnapshot } from "./types";

let session: AuthSession | null = null;
let unlocked = false;
let operation: AbortController | null = null;
function snapshot(): AuthSnapshot {
  return {
    user: session
      ? {
          id: session.id,
          name: session.name,
          email: session.email,
          username: session.username,
          expiresAt: session.tokens.expiresAt,
          needsLogin:
            session.tokens.expiresAt <= Date.now() ||
            session.tokens.binding !== gorthBinding(),
        }
      : null,
    locked: !unlocked && vaultExists(),
    configured: !!gorthIssuer,
    busy: !!operation,
  };
}
function changed() {
  for (const window of BrowserWindow.getAllWindows())
    if (!window.webContents.isDestroyed())
      window.webContents.send("auth:changed", snapshot());
}
async function unlock() {
  if (unlocked) return;
  session = await readVault();
  unlocked = true;
}
async function save(next: AuthSession | null) {
  await writeVault(next);
  session = next;
  changed();
}
export function cancelAuth() {
  operation?.abort();
}
export function registerAuthIpc() {
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (
      !window ||
      window.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new Error("Untrusted auth sender");
  };
  ipcMain.handle("auth:snapshot", (event): AuthResult => {
    trusted(event);
    return { snapshot: snapshot() };
  });
  ipcMain.handle(
    "auth:command",
    async (event, action: unknown): Promise<AuthResult> => {
      trusted(event);
      if (action === "cancel") {
        cancelAuth();
        return { snapshot: snapshot() };
      }
      if (
        typeof action !== "string" ||
        !["login", "unlock", "logout", "refresh"].includes(action)
      )
        return { snapshot: snapshot(), error: "Invalid account action." };
      if (operation)
        return {
          snapshot: snapshot(),
          error: "An account operation is already running.",
        };
      const controller = new AbortController();
      operation = controller;
      changed();
      try {
        await unlock();
        controller.signal.throwIfAborted();
        if (action === "login") {
          const next = await loginGorth(
            (url) => shell.openExternal(url),
            controller.signal,
          );
          controller.signal.throwIfAborted();
          await save(next);
        }
        if (action === "logout") {
          const previous = session;
          await save(null);
          if (previous) await revokeGorth(previous.tokens, controller.signal);
        }
        if (
          (action === "refresh" ||
            (action === "unlock" &&
              session?.tokens.refreshToken &&
              session.tokens.binding === gorthBinding() &&
              session.tokens.expiresAt <= Date.now() + 30_000)) &&
          session
        ) {
          const next = await refreshGorth(session, controller.signal);
          controller.signal.throwIfAborted();
          await save(next);
        }
        return { snapshot: { ...snapshot(), busy: false } };
      } catch (error) {
        if (
          error instanceof AuthHttpError &&
          ["invalid_grant", "invalid_token"].includes(error.code)
        ) {
          session = null;
          try {
            await save(null);
          } catch {
            /* Preserve vault if the keychain is unavailable. */
          }
        }
        return {
          snapshot: { ...snapshot(), busy: false },
          error: controller.signal.aborted
            ? "Sign-in cancelled."
            : error instanceof Error
              ? error.message
              : "Sign-in failed.",
        };
      } finally {
        if (operation === controller) operation = null;
        changed();
      }
    },
  );
}
