import { ShieldCheck } from "lucide-react";
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
      icon={ShieldCheck}
      title="Shields"
      description="Configure protection from trackers and unwanted content."
    >
      <Card>
        <CardHeader>
          <CardTitle>Shields</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
