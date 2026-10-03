import { useCallback, useEffect, useState } from "react";
import type { AuthAction, AuthSnapshot } from "@/lib/auth/types";

export function useAuth() {
  const [state, setState] = useState<AuthSnapshot>();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
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
    if (action !== "cancel") setRunning(true);
    setError("");
    try {
      const result = await window.electronAPI.auth.command(action);
      setState(result.snapshot);
      setError(result.error ?? "");
    } catch {
      setError("Account operation failed.");
    } finally {
      if (action !== "cancel") setRunning(false);
    }
  }, []);
  return { state, error, busy: running || !!state?.busy, run };
}
