import { ListChecks } from "lucide-react";
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
      icon={ListChecks}
      title="Autofill and passwords"
      description="Manage saved form information and passwords."
    >
      <Card>
        <CardHeader>
          <CardTitle>Autofill and passwords</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
