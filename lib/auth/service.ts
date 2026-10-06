import { upsertUserProfile } from "@/services/user-profile";
import { BrowserWindow, ipcMain } from "electron";
import {
  openAuthView,
  closeAuthView,
  clearAuthBrowserSession,
  registerAuthViewIpc,
} from "@/main/services/auth-view";
import { readVault, writeVault, vaultExists } from "./vault";
import {
  ssoIssuer,
  ssoOAuthClientId,
  ssoRedirectUri,
} from "@/lib/utils/environment";
import { gorthBinding, loginGorth, refreshGorth, revokeGorth } from "./gorth";
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
          image: session.image,
          emailVerified: session.emailVerified,
          expiresAt: session.tokens.expiresAt,
          canRefresh:
            !!session.tokens.refreshToken &&
            session.tokens.binding === gorthBinding(),
          needsLogin:
            session.tokens.expiresAt <= Date.now() ||
            session.tokens.binding !== gorthBinding(),
        }
      : null,
    locked: !unlocked && vaultExists(),
    configured: !!(ssoIssuer && ssoOAuthClientId && ssoRedirectUri),
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
  unlocked = true;
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
    return window;
  };
  registerAuthViewIpc(trusted);
  ipcMain.handle("auth:snapshot", (event): AuthResult => {
    trusted(event);
    return { snapshot: snapshot() };
  });
  ipcMain.handle(
    "auth:command",
    async (event, action: unknown): Promise<AuthResult> => {
      const owner = trusted(event);
      if (action === "cancel") {
        cancelAuth();
        return { snapshot: snapshot() };
      }
      if (
        typeof action !== "string" ||
        !["login", "register", "unlock", "logout", "refresh"].includes(action)
      )
        return { snapshot: snapshot(), error: "Invalid account action." };
      if (operation)
        return {
          snapshot: snapshot(),
          error: "An account operation is already running.",
        };
      const controller = new AbortController();
      let completed = false;
      operation = controller;
      changed();
      try {
        // A fresh OAuth login replaces the browser session; it must not decrypt
        // an old (possibly inaccessible) vault before opening the SSO page.
        if (action !== "login" && action !== "register") await unlock();
        controller.signal.throwIfAborted();
        if (action === "login" || action === "register") {
          const next = await loginGorth(
            (url, receiveCallback) =>
              openAuthView(owner, url, receiveCallback, controller, action),
            controller.signal,
            action,
          );
          controller.signal.throwIfAborted();
          upsertUserProfile(next);
          await save(next);
          completed = true;
        }
        if (action === "logout") {
          const previous = session;
          await save(null);
          await clearAuthBrowserSession();
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
          upsertUserProfile(next);
          await save(next);
        }
        return { snapshot: { ...snapshot(), busy: false } };
      } catch (error) {
        if (
          unlocked &&
          (action === "refresh" ||
            (action === "unlock" &&
              session &&
              session.tokens.expiresAt <= Date.now() + 30_000))
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
        closeAuthView(owner, completed);
        if (operation === controller) operation = null;
        changed();
      }
    },
  );
}

export function getAuthenticatedUserId() {
  const current = snapshot().user;
  return unlocked && current && !current.needsLogin ? current.id : null;
}
