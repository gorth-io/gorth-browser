import { History, Maximize, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageShell, type SpecialPageProps } from "@/pages/shared";

const features = [
  {
    icon: History,
    title: "Pick up where you left off",
    description:
      "Your tabs and window position are restored when you return. Reopen a recently closed tab with Cmd/Ctrl+Shift+T.",
  },
  {
    icon: Search,
    title: "Find in page",
    description:
      "Press Cmd/Ctrl+F to search the current page, see the match count, and move between results.",
  },
  {
    icon: Maximize,
    title: "More ways to browse",
    description:
      "Use vertical tabs and split view, or enter a website's fullscreen mode for more room.",
  },
  {
    icon: Sparkles,
    title: "Settings, organized",
    description:
      "Explore the settings sidebar, customize your appearance, and access welcome and feature highlights from Help.",
  },
];

function WhatsNewPage({
  onOpenInternal,
}: Pick<SpecialPageProps, "onOpenInternal">) {
  return (
    <PageShell
      icon={Sparkles}
      title="What's new in Gorth"
      description="Discover what's available in your browser."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="size-4 shrink-0" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => onOpenInternal("settings")}>
          Explore settings
        </Button>
        <Button variant="outline" onClick={() => onOpenInternal("welcome")}>
          Welcome
        </Button>
        <Button variant="ghost" onClick={() => onOpenInternal("help")}>
          Help
        </Button>
      </div>
    </PageShell>
  );
}

export { WhatsNewPage };
