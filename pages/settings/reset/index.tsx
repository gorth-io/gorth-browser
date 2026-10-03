import { RotateCcw } from "lucide-react";
import { PageShell } from "@/pages/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
export function SettingsSectionPage() {
  return (
    <PageShell
      icon={RotateCcw}
      title="Reset settings"
      description="Restore browser preferences."
    >
      <Card>
        <CardHeader>
          <CardTitle>Reset settings</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
