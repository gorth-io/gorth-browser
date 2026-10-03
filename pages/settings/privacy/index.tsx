import { LockKeyhole } from "lucide-react";
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
      icon={LockKeyhole}
      title="Privacy and security"
      description="Manage privacy and browsing data."
    >
      <Card>
        <CardHeader>
          <CardTitle>Privacy and security</CardTitle>
          <CardDescription>
            These preferences are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageShell>
  );
}
