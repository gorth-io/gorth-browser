import { useState } from "react";
import { Gamepad2, RefreshCw, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type SpecialPageProps, PageShell } from "@/pages/shared";
function ErrorPage({
  errorCode,
  errorDescription,
  errorUrl,
  onRetry,
}: Pick<
  SpecialPageProps,
  "errorCode" | "errorDescription" | "errorUrl" | "onRetry"
>) {
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState(12);
  const hitTarget = () => {
    setScore((value) => value + 1);
    setTarget((value) => (value * 7 + 11) % 25);
  };
  return (
    <PageShell
      description={errorUrl || "The requested website could not be reached."}
      icon={Gamepad2}
      title="This page is unavailable"
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Unable to connect</CardTitle>
            <CardDescription>
              {errorDescription || "Check your connection and try again."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-mono text-xs text-muted-foreground">
              Error {errorCode ?? "unknown"}
            </p>
            <Button onClick={onRetry}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Offline rocket <Badge variant="secondary">Score {score}</Badge>
            </CardTitle>
            <CardDescription>
              Catch the rocket while you wait for the network.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid aspect-square grid-cols-5 gap-1 rounded-lg bg-muted p-2">
              {Array.from({ length: 25 }, (_, index) =>
                index === target ? (
                  <Button
                    aria-label="Catch rocket"
                    className="size-full"
                    key={index}
                    onClick={hitTarget}
                    size="icon"
                    variant="secondary"
                  >
                    <Rocket />
                  </Button>
                ) : (
                  <div key={index} />
                ),
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
export { ErrorPage };
