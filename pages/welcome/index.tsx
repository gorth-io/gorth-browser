import { Palette, Rocket, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageShell, type SpecialPageProps } from "@/pages/shared";

function WelcomePage({
  onOpenInternal,
}: Pick<SpecialPageProps, "onOpenInternal">) {
  return (
    <PageShell
      icon={Rocket}
      title="Welcome to Gorth Browser"
      description="A space for your everyday browsing."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Make it yours</CardTitle>
            <CardDescription>
              Choose a color theme, switch to vertical tabs, and position your
              bookmarks sidebar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => onOpenInternal("settings/appearance")}>
              <Palette className="size-4" /> Customize appearance
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Start exploring</CardTitle>
            <CardDescription>
              Type an address or a search in the address bar. Use Cmd/Ctrl+T to
              open a new tab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => onOpenInternal("settings/search")}
            >
              <Search className="size-4" /> Search settings
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onOpenInternal("whats-new")}>
          <Sparkles className="size-4" /> What's new
        </Button>
        <Button variant="ghost" onClick={() => onOpenInternal("help")}>
          Help
        </Button>
      </div>
    </PageShell>
  );
}

export { WelcomePage };
