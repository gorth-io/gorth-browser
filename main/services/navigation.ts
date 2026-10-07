import type { WebContents } from "electron";

interface NavigationAttempt {
  canRetryQuic: boolean;
}

type NavigationContents = Pick<WebContents, "loadURL" | "isDestroyed">;
const attempts = new WeakMap<NavigationContents, NavigationAttempt>();

/** Delay the error page only while an explicit GET load has a retry available. */
export function canRecoverQuicFailure(
  contents: NavigationContents,
  code: number,
): boolean {
  return code === -356 && attempts.get(contents)?.canRetryQuic === true;
}

/** Keep Chromium's normal protocol negotiation; never replay form submissions. */
export async function loadWebsite(
  contents: NavigationContents,
  url: string,
): Promise<void> {
  const attempt: NavigationAttempt = { canRetryQuic: true };
  attempts.set(contents, attempt);
  try {
    try {
      await contents.loadURL(url);
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("errno" in error) ||
        error.errno !== -356 ||
        contents.isDestroyed() ||
        attempts.get(contents) !== attempt
      )
        throw error;
      // A failed QUIC transaction may leave a stale transport/Alt-Svc choice.
      // A single new GET gives Chromium another negotiation attempt, not a loop.
      attempt.canRetryQuic = false;
      await contents.loadURL(url);
    }
  } finally {
    if (attempts.get(contents) === attempt) attempts.delete(contents);
  }
}
