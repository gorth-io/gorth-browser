import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthAction, AuthSnapshot } from "@/lib/auth/types";

export function useAuthController() {
  const [state, setState] = useState<AuthSnapshot>();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const operation = useRef(false);
  useEffect(() => {
    let active = true;
    const accept = (value: AuthSnapshot) => {
      if (active) setState(value);
    };
    const unsubscribe = window.electronAPI.auth.onChanged(accept);
    const update = () => {
      void window.electronAPI.auth
        .snapshot()
        .then((result) => accept(result.snapshot))
        .catch(() => {
          if (active) setError("Could not read account status.");
        })
        .finally(() => {
          if (active) setReady(true);
        });
    };
    update();
    // Snapshot never decrypts the vault or makes network requests.
    const timer = setInterval(update, 30_000);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, []);
  const run = useCallback(async (action: AuthAction) => {
    if (action !== "cancel") {
      if (operation.current) return false;
      operation.current = true;
      setRunning(true);
    }
    setError("");
    try {
      const result = await window.electronAPI.auth.command(action);
      setState(result.snapshot);
      setError(result.error ?? "");
      return !result.error;
    } catch {
      setError("Account operation failed.");
      return false;
    } finally {
      if (action !== "cancel") {
        operation.current = false;
        setRunning(false);
      }
    }
  }, []);
  const current = useRef(state);
  useEffect(() => {
    current.current = state;
  }, [state]);
  useEffect(() => {
    const refreshIfNeeded = () => {
      const snapshot = current.current;
      if (
        snapshot?.user &&
        snapshot.user.canRefresh &&
        !snapshot.locked &&
        !snapshot.busy &&
        !operation.current &&
        snapshot.user.expiresAt <= Date.now() + 60_000
      )
        void run("refresh");
    };
    const timer = setInterval(refreshIfNeeded, 30_000);
    window.addEventListener("focus", refreshIfNeeded);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshIfNeeded);
    };
  }, [run]);
  const account = state?.user ?? null;
  const refresh = useCallback(async () => {
    if (!(await run("refresh"))) return null;
    try {
      const result = await window.electronAPI.auth.snapshot();
      setState(result.snapshot);
      return result.snapshot.user;
    } catch {
      setError("Không đọc được phiên Gorth sau khi làm mới.");
      return null;
    }
  }, [run]);
  return {
    state,
    error,
    busy: running || !!state?.busy,
    run,
    ready,
    account,
    username: account?.username ?? null,
    authenticated: !!account && !account.needsLogin,
    loading: !ready || running || !!state?.busy,
    locked: !!state?.locked,
    login: () => run("login"),
    register: () => run("register"),
    logout: () => run("logout"),
    unlock: () => run("unlock"),
    cancel: () => run("cancel"),
    refresh,
  };
}
