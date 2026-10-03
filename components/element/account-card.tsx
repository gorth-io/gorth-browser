import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export function AccountCard() {
  const { state, error, busy, run } = useAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gorth account</CardTitle>
        <CardDescription>
          {state?.user
            ? state.user.name
            : "Sign in securely through Gorth SSO in your system browser."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state?.user?.email && (
          <p className="text-sm text-muted-foreground">{state.user.email}</p>
        )}
        {state?.user?.needsLogin && (
          <p role="status" className="text-sm text-muted-foreground">
            Your session has expired or its SSO configuration changed. Refresh
            or sign in again.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {state && !state.configured && (
          <p className="text-sm text-muted-foreground">
            Configure VITE_GORTH_SSO_ISSUER to enable sign-in.
          </p>
        )}
        {state?.locked && (
          <Button disabled={busy} onClick={() => void run("unlock")}>
            Unlock saved session
          </Button>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !state?.configured}
            onClick={() => void run("login")}
          >
            {state?.user ? "Switch Gorth account" : "Sign in with Gorth"}
          </Button>
          {state?.user && (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run("refresh")}
              >
                Refresh session
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run("logout")}
              >
                Sign out of this app
              </Button>
            </>
          )}
          {busy && (
            <Button variant="outline" onClick={() => void run("cancel")}>
              Cancel
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Saved sessions stay encrypted. Unlocking may require your system
          keychain password. Signing out here does not sign out of Gorth in
          other apps.
        </p>
      </CardContent>
    </Card>
  );
}
