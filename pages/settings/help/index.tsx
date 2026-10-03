import { ExternalLink, Info, Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  internalPageDefinitions,
  type BrowserInternalPage,
} from "@/lib/browser/internal-pages";
import { type SpecialPageProps, PageShell } from "@/pages/shared";
function AboutPage({
  onOpenInternal,
}: {
  onOpenInternal: SpecialPageProps["onOpenInternal"];
}) {
  return (
    <PageShell
      description="Internal addresses supported by the browser."
      icon={Info}
      title="Gorth Browser"
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Gorth</CardTitle>
            <CardDescription>
              Get started and make the browser your own.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => onOpenInternal("welcome")} variant="outline">
              <Rocket className="size-4" /> Open welcome
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What's new</CardTitle>
            <CardDescription>
              Explore the features available in Gorth Browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => onOpenInternal("whats-new")}
              variant="outline"
            >
              <Sparkles className="size-4" /> See what's new
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Gorth URLs</CardTitle>
          <CardDescription>
            Like chrome://, each hostname maps to an approved internal page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(internalPageDefinitions).map(([page, definition]) => (
            <Button
              className="w-full justify-between"
              key={definition.url}
              onClick={() =>
                onOpenInternal(page as Exclude<BrowserInternalPage, "new-tab">)
              }
              variant="secondary"
            >
              <code className="text-sm">{definition.url}</code>
              <ExternalLink className="size-4 text-muted-foreground" />
            </Button>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
export { AboutPage };
