import { Beaker } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { type SpecialPageProps, PageShell } from "@/pages/shared";
function FlagsPage({
  flags,
  onFlagsChange,
}: Pick<SpecialPageProps, "flags" | "onFlagsChange">) {
  const items = [
    {
      id: "memorySaver" as const,
      title: "Memory saver",
      description: "Reduce resource usage for inactive tabs.",
    },
    {
      id: "smoothScrolling" as const,
      title: "Smooth scrolling",
      description: "Enable smooth scrolling for web content.",
    },
  ];
  return (
    <PageShell
      description="Experimental features may change or be removed."
      icon={Beaker}
      title="Gorth Flags"
    >
      <Card>
        <CardHeader>
          <CardTitle>Experimental features</CardTitle>
          <CardDescription>
            Some changes may require restarting the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {items.map((item) => (
            <div
              className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0"
              key={item.id}
            >
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <Switch
                checked={flags[item.id]}
                onCheckedChange={(checked) =>
                  onFlagsChange({ ...flags, [item.id]: checked })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
export { FlagsPage };
