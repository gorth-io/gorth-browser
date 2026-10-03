import { Settings } from "lucide-react";
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
      icon={Settings}
      title="System"
      description="Manage browser system preferences."
    >
      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
