import { Search } from "lucide-react";
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
      icon={Search}
      title="Search engine"
      description="Choose how searches are handled."
    >
      <Card>
        <CardHeader>
          <CardTitle>Default search engine</CardTitle>
          <CardDescription>
            Address bar searches currently use Google.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
